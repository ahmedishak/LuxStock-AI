"use client";

import { useMemo, useState } from "react";
import type {
  ActivityEvent,
  CategoryRollup,
  InventoryRow,
} from "@/lib/api";
import { RiskDonut } from "./risk-donut";

export type { ActivityEvent, CategoryRollup, InventoryRow };

export type SettingsState = {
  maison: string;
  buyerName: string;
  threshold: number;
  language: "en" | "fr" | "it";
};

function statusLabel(status: string) {
  if (status === "critical") return "Critical";
  if (status === "watch") return "Watch";
  return "Healthy";
}

function statusClass(status: string) {
  if (status === "critical") return "text-red-300 border-red-400/30 bg-red-400/10";
  if (status === "watch") return "text-gold border-gold/30 bg-gold-soft";
  return "text-emerald border-emerald/30 bg-emerald-soft";
}

function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="lux-panel px-6 py-16 text-center">
      <p className="font-display text-xl text-foreground">No weekly file loaded</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 border border-gold/45 bg-gold-soft px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function InventoryAnalyticsView({
  inventory,
  skuCount,
  totalUnits,
  totalStock,
  avgCoverage,
  statusBreakdown,
  categories,
  fileName,
  insight,
  onTryDemo,
}: {
  inventory: InventoryRow[];
  skuCount: number;
  totalUnits: number;
  totalStock: number;
  avgCoverage: number;
  statusBreakdown: { critical: number; watch: number; healthy: number };
  categories: CategoryRollup[];
  fileName: string | null;
  insight: string | null;
  onTryDemo: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "watch" | "healthy">(
    "all",
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.product.toLowerCase().includes(q) ||
        (row.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [inventory, query, statusFilter]);

  if (!inventory.length) {
    return (
      <EmptyState
        message="Upload a CSV on Overview, or load the sample week, to populate sell-through, cover, and SKU health."
        actionLabel="Load sample week"
        onAction={onTryDemo}
      />
    );
  }

  const movers = [...inventory].sort((a, b) => b.units - a.units).slice(0, 5);
  const maxUnits = Math.max(...movers.map((row) => row.units), 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
          Assortment pulse
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
          Inventory Analytics
        </h2>
        <p className="mt-2 text-sm text-muted">
          {fileName ? `Source · ${fileName}` : "Latest weekly sell-through"}
        </p>
      </div>

      {insight && (
        <div className="lux-panel border-gold/20 px-5 py-4 text-sm leading-relaxed text-foreground/90">
          <span className="mr-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-gold">
            Insight
          </span>
          {insight}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active SKUs", value: skuCount.toLocaleString() },
          { label: "Units sold", value: totalUnits.toLocaleString() },
          { label: "Units on hand", value: totalStock.toLocaleString() },
          { label: "Avg cover", value: `${avgCoverage} wks` },
        ].map((card) => (
          <article key={card.label} className="lux-panel px-5 py-5">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
              {card.label}
            </p>
            <p className="mt-3 font-display text-3xl text-foreground">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="lux-panel px-5 py-5">
          <h3 className="font-display text-xl text-foreground">Risk mix</h3>
          <p className="mt-1 text-xs text-muted">Share of SKUs by stock health</p>
          <div className="mt-5">
            <RiskDonut
              critical={statusBreakdown.critical}
              watch={statusBreakdown.watch}
              healthy={statusBreakdown.healthy}
            />
          </div>
        </section>

        <section className="lux-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-display text-xl text-foreground">Top movers</h3>
          </div>
          <ul className="divide-y divide-border px-5 py-2">
            {movers.map((row) => (
              <li key={row.product} className="py-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="truncate text-sm text-foreground">{row.product}</p>
                  <p className="shrink-0 font-display text-base text-gold">
                    {row.units.toLocaleString()}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden bg-border/40">
                  <div
                    className="h-full bg-gold/70 transition-all duration-700"
                    style={{ width: `${(row.units / maxUnits) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {categories.length > 0 && (
        <section className="lux-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-display text-xl text-foreground">By category</h3>
          </div>
          <ul className="divide-y divide-border">
            {categories.map((row) => (
              <li
                key={row.category}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm text-foreground">{row.category}</p>
                  <p className="text-xs text-muted">
                    {row.skus} SKUs
                    {row.critical > 0 ? ` · ${row.critical} critical` : ""}
                    {row.revenue_at_risk
                      ? ` · $${row.revenue_at_risk.toLocaleString()} at risk`
                      : ""}
                  </p>
                </div>
                <p className="font-display text-lg text-foreground/90">
                  {row.units.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-0 flex-1">
          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            Search SKUs
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Product or category"
            className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["all", "critical", "watch", "healthy"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.14em] ${
                statusFilter === key
                  ? "border-gold/50 text-gold"
                  : "border-border text-muted hover:border-gold/35 hover:text-foreground"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <section className="lux-panel overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[0.68rem] uppercase tracking-[0.16em] text-muted">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">Units</th>
              <th className="px-3 py-3 font-medium">Stock</th>
              <th className="px-3 py-3 font-medium">Cover</th>
              <th className="px-3 py-3 font-medium">Sell-thru</th>
              <th className="px-3 py-3 font-medium">Risk</th>
              <th className="px-3 py-3 font-medium">R@R</th>
              <th className="px-3 py-3 font-medium">Reorder</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={`${row.product}-${row.category ?? ""}`}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-5 py-3 text-foreground">
                  <p>{row.product}</p>
                  {row.category && (
                    <p className="text-xs text-muted">{row.category}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-muted">{row.units.toLocaleString()}</td>
                <td className="px-3 py-3 text-muted">{row.stock.toLocaleString()}</td>
                <td className="px-3 py-3 text-muted">
                  {row.coverage_weeks != null ? `${row.coverage_weeks} wks` : "—"}
                </td>
                <td className="px-3 py-3 text-muted">
                  {row.sell_through != null
                    ? `${Math.round(row.sell_through * 100)}%`
                    : "—"}
                </td>
                <td className="px-3 py-3 text-foreground/80">{row.risk_score ?? "—"}</td>
                <td className="px-3 py-3 text-gold">
                  {row.revenue_at_risk
                    ? `$${row.revenue_at_risk.toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-3 py-3 text-gold">
                  {row.recommended_qty ? `+${row.recommended_qty}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="px-5 py-8 text-sm text-muted">No SKUs match that filter.</p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        Scoring: critical if on-hand ≤ threshold; watch if ≤ 2× threshold. Cover =
        on-hand / weekly units. Risk floors at 75 (critical) and 45 (watch). Reorder
        targets 3 weeks of cover if critical, otherwise 2. Revenue at risk = weekly
        units × unit retail, critical SKUs only.
      </p>
    </div>
  );
}

export function ReorderAlertsView({
  alerts,
  onOpenDraft,
  onTryDemo,
  onExport,
}: {
  alerts: InventoryRow[];
  onOpenDraft: (product: string, qty?: number) => void;
  onTryDemo: () => void;
  onExport: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "critical" | "watch">("all");

  if (!alerts.length) {
    return (
      <EmptyState
        message="No reorder alerts yet. Load the sample week or upload a CSV to flag critically low and watch-list SKUs."
        actionLabel="Load sample week"
        onAction={onTryDemo}
      />
    );
  }

  const critical = alerts.filter((row) => row.status === "critical");
  const watch = alerts.filter((row) => row.status === "watch");
  const visible =
    filter === "all" ? alerts : alerts.filter((row) => row.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
            Atelier exceptions
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
            Reorder Alerts
          </h2>
          <p className="mt-2 text-sm text-muted">
            {critical.length} critical · {watch.length} on watch · qty targets based on
            sell-through cover
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "critical", "watch"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.14em] ${
                filter === key
                  ? "border-gold/50 text-gold"
                  : "border-border text-muted hover:border-gold/35"
              }`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={onExport}
            className="border border-border px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:border-gold/45"
          >
            Export alerts CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {visible.map((row) => (
          <article key={`${row.product}-${row.category ?? ""}`} className="lux-panel px-5 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                  {typeof row.risk_score === "number" && (
                    <span className="text-[0.68rem] uppercase tracking-[0.12em] text-muted">
                      Risk {row.risk_score}
                    </span>
                  )}
                  {!!row.revenue_at_risk && (
                    <span className="text-[0.68rem] uppercase tracking-[0.12em] text-gold">
                      ${row.revenue_at_risk.toLocaleString()} at risk
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-display text-2xl text-foreground">
                  {row.product}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {row.reason ||
                    `${row.stock} on hand · ${row.units.toLocaleString()} sold this week`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenDraft(row.product, row.recommended_qty)}
                className="shrink-0 border border-gold/45 bg-gold-soft px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold"
              >
                Draft supplier email
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SettingsView({
  settings,
  fileName,
  activity,
  scoringLive,
  onChange,
  onReset,
  onTryDemo,
}: {
  settings: SettingsState;
  fileName: string | null;
  activity: ActivityEvent[];
  scoringLive: boolean;
  onChange: (next: SettingsState) => void;
  onReset: () => void;
  onTryDemo: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
          Maison controls
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
          Settings
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Threshold is a live merchandising control: changing it re-scores the loaded
          week without another upload. Brand voice applies the next time a draft is
          generated.
        </p>
      </div>

      <div className="lux-panel grid gap-6 px-5 py-6 sm:px-6">
        <label className="block">
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Maison / brand name
          </span>
          <input
            value={settings.maison}
            onChange={(e) => onChange({ ...settings, maison: e.target.value })}
            className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50"
          />
        </label>

        <label className="block">
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Buyer name
          </span>
          <input
            value={settings.buyerName}
            onChange={(e) => onChange({ ...settings, buyerName: e.target.value })}
            className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50"
            placeholder="Merchandising desk"
          />
        </label>

        <label className="block">
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Supplier draft language
          </span>
          <select
            value={settings.language}
            onChange={(e) =>
              onChange({
                ...settings,
                language: e.target.value as SettingsState["language"],
              })
            }
            className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="it">Italian</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Critical stock threshold
          </span>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.threshold}
            onChange={(e) =>
              onChange({
                ...settings,
                threshold: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50"
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            SKUs at or below this on-hand quantity are flagged critical. Watch is twice
            that level.
            {scoringLive
              ? " Re-scoring the loaded week now."
              : " Applies on the next upload if no week is loaded."}
          </p>
        </label>
      </div>

      <div className="lux-panel flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-foreground">
            Current file · {fileName ?? "None loaded"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Refresh resets analytics, or load the sample week instantly.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onTryDemo}
            className="border border-gold/45 bg-gold-soft px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold"
          >
            Load sample week
          </button>
          <button
            type="button"
            onClick={onReset}
            className="border border-border px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:border-gold/45"
          >
            Refresh & upload another
          </button>
        </div>
      </div>

      <section className="lux-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-display text-xl text-foreground">Activity trail</h3>
          <p className="mt-1 text-xs text-muted">
            Uploads and approvals for this API process (also kept in this browser)
          </p>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            No actions yet. Analyze a week or approve a supplier draft to log an audit
            event.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((event) => (
              <li key={event.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">{event.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(event.timestamp).toLocaleString()} · {event.status}
                      {event.preview ? ` · ${event.preview}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.12em] text-gold">
                    {event.product}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
