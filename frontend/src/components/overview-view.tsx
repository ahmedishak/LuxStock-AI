"use client";

import type { ColumnMap, PriorityAction } from "@/lib/api";

type KpiCard = {
  title: string;
  value: string;
  hint: string;
  accent: "gold" | "emerald";
};

type PipelineStage = "idle" | "parsing" | "scoring" | "drafting" | "ready";

export function OverviewView({
  fileName,
  isUploading,
  isDragging,
  pipelineStage,
  inputKey,
  insight,
  revenueAtRisk,
  expediteUnits,
  priceSource,
  columnMap,
  sanitized,
  kpis,
  priorityActions,
  onTryDemo,
  onOpenDraft,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onFile,
}: {
  fileName: string | null;
  isUploading: boolean;
  isDragging: boolean;
  pipelineStage: PipelineStage;
  inputKey: number;
  insight: string | null;
  revenueAtRisk: number;
  expediteUnits: number;
  priceSource: string | null;
  columnMap: ColumnMap | null;
  sanitized: string[];
  kpis: KpiCard[];
  priorityActions: PriorityAction[];
  onTryDemo: () => void;
  onOpenDraft: (product?: string, qty?: number) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  onDragEnter: (e: React.DragEvent<HTMLLabelElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLLabelElement>) => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <>
      {!fileName && !isUploading && (
        <section className="lux-panel animate-lux-fade-up border-gold/15 px-6 py-6 sm:px-8">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
            Weekly merchandising desk
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
            Score the week, then act on the exceptions
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            LuxStock reads sell-through, flags stockout risk, prices the revenue at
            stake, and drafts the supplier email. Load the sample week or drop your
            own CSV. Press{" "}
            <kbd className="border border-border px-1.5 py-0.5 text-[0.7rem] text-foreground/80">
              Shift+D
            </kbd>{" "}
            to demo,{" "}
            <kbd className="border border-border px-1.5 py-0.5 text-[0.7rem] text-foreground/80">
              ?
            </kbd>{" "}
            for shortcuts.
          </p>
          <button
            type="button"
            onClick={onTryDemo}
            className="mt-5 border border-gold/45 bg-gold-soft px-4 py-2.5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold transition-colors hover:border-gold"
          >
            Load sample week
          </button>
        </section>
      )}

      <section className="animate-lux-fade-up-delay-1">
        <label
          htmlFor="csv-upload"
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`lux-panel relative flex flex-col items-center justify-center gap-4 px-6 py-14 text-center transition-[border-color,background,opacity] duration-300 sm:py-16 ${
            isUploading
              ? "pointer-events-none cursor-wait opacity-80"
              : "animate-lux-pulse cursor-pointer"
          } ${isDragging ? "border-gold bg-gold-soft" : "hover:border-gold/40"}`}
        >
          <input
            key={inputKey}
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={isUploading}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div
            className={`flex h-14 w-14 items-center justify-center border transition-colors duration-300 ${
              isDragging || fileName || isUploading
                ? "border-gold text-gold"
                : "border-border text-muted"
            }`}
          >
            {isUploading ? (
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold"
                aria-hidden
              />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 16V4M12 4l-4 4M12 4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          <div>
            <p className="font-display text-xl font-medium tracking-wide text-foreground sm:text-2xl">
              Upload weekly sell-through (CSV)
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              {isUploading
                ? "Scoring stock, cover, and revenue at risk…"
                : fileName
                  ? "Drop a new file, or press Refresh, to run another week."
                  : "Columns detected automatically: product, units, stock, category, optional unit_retail. "}
              {!isUploading && !fileName && (
                <span className="text-foreground/70">.csv</span>
              )}
            </p>
          </div>

          {isUploading ||
          pipelineStage === "parsing" ||
          pipelineStage === "scoring" ||
          pipelineStage === "drafting" ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-gold" aria-live="polite">
                {pipelineStage === "parsing" && "1/3 Parsing CSV…"}
                {pipelineStage === "scoring" && "2/3 Scoring stockout risk…"}
                {pipelineStage === "drafting" && "3/3 Drafting supplier email…"}
                {isUploading &&
                  pipelineStage === "idle" &&
                  `Uploading${fileName ? ` · ${fileName}` : "…"}`}
              </p>
              <div className="flex gap-1.5">
                {(["parsing", "scoring", "drafting"] as const).map((stage) => {
                  const order = {
                    parsing: 1,
                    scoring: 2,
                    drafting: 3,
                    ready: 4,
                    idle: 0,
                  };
                  const current = order[pipelineStage] || (isUploading ? 1 : 0);
                  const active = current >= order[stage];
                  return (
                    <span
                      key={stage}
                      className={`h-1 w-8 ${active ? "bg-gold" : "bg-border"}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : fileName ? (
            <p className="text-sm text-emerald">
              Loaded · <span className="text-foreground">{fileName}</span>
            </p>
          ) : (
            <span className="border border-border px-4 py-2 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-muted">
              Select file
            </span>
          )}
        </label>
      </section>

      {insight && (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="lux-panel animate-lux-fade-up-delay-1 border-gold/20 px-5 py-4">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-gold">
              Merchandising insight
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {insight}
            </p>
            {columnMap && (
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
                Mapped{" "}
                {[
                  columnMap.product && `product←${columnMap.product}`,
                  columnMap.units && `units←${columnMap.units}`,
                  columnMap.stock && `stock←${columnMap.stock}`,
                  columnMap.price
                    ? `price←${columnMap.price}`
                    : "price←category heuristic",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {sanitized.length ? ` · dropped ${sanitized.join(", ")}` : ""}
              </p>
            )}
          </div>
          <article className="lux-panel animate-lux-fade-up-delay-2 px-5 py-4">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">
              Weekly revenue at risk
            </p>
            <p className="mt-2 font-display text-3xl text-gold">
              ${revenueAtRisk.toLocaleString()}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {expediteUnits
                ? `Expedite ${expediteUnits.toLocaleString()} units to cover critical SKUs. `
                : "No critical expedite quantity. "}
              {priceSource === "column"
                ? "Priced from unit_retail in the file."
                : "Priced with category AUR heuristic (no price column)."}
            </p>
          </article>
        </section>
      )}

      {priorityActions.length > 0 && (
        <section className="lux-panel px-5 py-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-gold">
                Next actions
              </p>
              <h2 className="mt-1 font-display text-2xl text-foreground">
                Desk for this week
              </h2>
            </div>
            <p className="text-xs text-muted">Exception-first, not a SKU dump</p>
          </div>
          <ol className="mt-4 divide-y divide-border">
            {priorityActions.map((action, index) => (
              <li
                key={action.product}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                    {String(index + 1).padStart(2, "0")} · {action.status} · risk{" "}
                    {action.risk_score}
                  </p>
                  <p className="mt-1 font-display text-xl text-foreground">
                    {action.product}
                  </p>
                  <p className="mt-1 text-sm text-muted">{action.reason}</p>
                  {action.revenue_at_risk > 0 && (
                    <p className="mt-1 text-sm text-gold">
                      ${action.revenue_at_risk.toLocaleString()} at risk · +
                      {action.recommended_qty} units
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDraft(action.product, action.recommended_qty)}
                  className="shrink-0 border border-gold/45 bg-gold-soft px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-gold transition-colors hover:border-gold"
                >
                  Draft supplier email
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Key performance indicators"
      >
        {kpis.map((kpi, index) => {
          const isDraftCard = kpi.title === "Pending Supplier Drafts";
          const cardClass = `lux-panel group px-5 py-6 text-left transition-colors duration-300 hover:border-gold/35 ${
            index === 0
              ? "animate-lux-fade-up-delay-1"
              : index === 1
                ? "animate-lux-fade-up-delay-2"
                : "animate-lux-fade-up-delay-3"
          } ${index === 2 ? "sm:col-span-2 lg:col-span-1" : ""} ${
            isDraftCard
              ? "w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              : ""
          }`;

          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted">
                  {kpi.title}
                </h2>
                <span
                  className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    kpi.accent === "emerald" ? "bg-emerald" : "bg-gold"
                  }`}
                  aria-hidden
                />
              </div>
              <p className="mt-5 break-words font-display text-4xl font-medium tracking-tight text-foreground">
                {kpi.value}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{kpi.hint}</p>
            </>
          );

          if (isDraftCard) {
            return (
              <button
                key={kpi.title}
                type="button"
                onClick={() => onOpenDraft()}
                className={cardClass}
                aria-haspopup="dialog"
              >
                {body}
              </button>
            );
          }

          return (
            <article key={kpi.title} className={cardClass}>
              {body}
            </article>
          );
        })}
      </section>
    </>
  );
}
