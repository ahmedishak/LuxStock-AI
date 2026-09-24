"use client";

import { useEffect, useRef, useState } from "react";
import { ApiHealthBadge } from "./api-health-badge";
import {
  InventoryAnalyticsView,
  ReorderAlertsView,
  SettingsView,
  type ActivityEvent,
  type CategoryRollup,
  type InventoryRow,
  type SettingsState,
} from "./dashboard-views";
import { OverviewView } from "./overview-view";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { SupplierDraftPanel } from "./supplier-draft-panel";
import {
  approveSupplierDraft,
  exportAlertsCsv,
  fetchActivity,
  fetchSupplierDraft as requestSupplierDraft,
  rescoreInventory,
  uploadCsv,
  type ColumnMap,
  type PriorityAction,
  type UploadResponse,
} from "@/lib/api";

const DEMO_CSV_URL = "/sample-week.csv";
const SESSION_KEY = "luxstock-session-v2";
const SETTINGS_KEY = "luxstock-settings";
const ACTIVITY_KEY = "luxstock-activity";

type PipelineStage = "idle" | "parsing" | "scoring" | "drafting" | "ready";

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Inventory Analytics" },
  { id: "alerts", label: "Reorder Alerts" },
  { id: "settings", label: "Settings" },
] as const;

type NavId = (typeof navItems)[number]["id"];

type KpiCard = {
  title: string;
  value: string;
  hint: string;
  accent: "gold" | "emerald";
};

type DraftContext = {
  stockoutItem: string;
  trendingItem: string;
  recommendedQty?: number;
  category?: string;
  coverageWeeks?: number | null;
  revenueAtRisk?: number;
  unitsSold?: number;
  stockOnHand?: number;
  riskScore?: number;
  reason?: string;
};

type SessionState = {
  kpis: KpiCard[];
  fileName: string | null;
  inventory: InventoryRow[];
  alerts: InventoryRow[];
  categories: CategoryRollup[];
  skuCount: number;
  totalUnits: number;
  totalStock: number;
  avgCoverage: number;
  insight: string | null;
  revenueAtRisk: number;
  expediteUnits: number;
  priceSource: string | null;
  columnMap: ColumnMap | null;
  sanitized: string[];
  priorityActions: PriorityAction[];
  scoredThreshold: number;
  statusBreakdown: { critical: number; watch: number; healthy: number };
  draftContext: DraftContext | null;
  supplierDraft: string | null;
};

const initialKpis: KpiCard[] = [
  {
    title: "Stockout Risk Items",
    value: "—",
    hint: "Awaiting weekly sales upload",
    accent: "gold",
  },
  {
    title: "Top Trending Product",
    value: "—",
    hint: "Trend signals unlock after CSV",
    accent: "emerald",
  },
  {
    title: "Pending Supplier Drafts",
    value: "—",
    hint: "No drafts prepared yet",
    accent: "gold",
  },
];

const defaultSettings: SettingsState = {
  maison: "LuxStock Atelier",
  buyerName: "Merchandising desk",
  threshold: 5,
  language: "en",
};

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function kpisFrom(payload: UploadResponse): KpiCard[] {
  return [
    {
      title: "Stockout Risk Items",
      value: payload.stockout_risk_items?.value ?? "—",
      hint:
        payload.stockout_risk_items?.hint ??
        "SKUs flagged from weekly sell-through",
      accent: "gold",
    },
    {
      title: "Top Trending Product",
      value: payload.top_trending_product?.value ?? "—",
      hint:
        payload.top_trending_product?.hint ??
        "Lead product from uploaded assortment",
      accent: "emerald",
    },
    {
      title: "Pending Supplier Drafts",
      value: payload.pending_supplier_drafts?.value ?? "—",
      hint: payload.pending_supplier_drafts?.hint ?? "Click to review supplier email",
      accent: "gold",
    },
  ];
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState<NavId>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiCard[]>(initialKpis);
  const [supplierDraft, setSupplierDraft] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftContext, setDraftContext] = useState<DraftContext | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [alerts, setAlerts] = useState<InventoryRow[]>([]);
  const [categories, setCategories] = useState<CategoryRollup[]>([]);
  const [skuCount, setSkuCount] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [avgCoverage, setAvgCoverage] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [revenueAtRisk, setRevenueAtRisk] = useState(0);
  const [expediteUnits, setExpediteUnits] = useState(0);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [sanitized, setSanitized] = useState<string[]>([]);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [scoredThreshold, setScoredThreshold] = useState(defaultSettings.threshold);
  const [statusBreakdown, setStatusBreakdown] = useState({
    critical: 0,
    watch: 0,
    healthy: 0,
  });
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [inputKey, setInputKey] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const inventoryRef = useRef<InventoryRow[]>([]);
  inventoryRef.current = inventory;

  function applyPayload(payload: UploadResponse, nextFileName?: string | null) {
    const stockoutItem =
      payload.high_risk_item ||
      payload.stockout_risk_items?.hint?.replace(/^Highest risk:\s*/i, "") ||
      "";
    const trendingItem =
      payload.top_trending_item || payload.top_trending_product?.value || "";
    const recommendedQty = payload.high_risk_recommended_qty ?? undefined;
    const matched = (payload.inventory ?? []).find((row) => row.product === stockoutItem);

    if (stockoutItem && trendingItem) {
      setDraftContext({
        stockoutItem,
        trendingItem,
        recommendedQty,
        category: matched?.category,
        coverageWeeks: matched?.coverage_weeks,
        revenueAtRisk: matched?.revenue_at_risk,
        unitsSold: matched?.units,
        stockOnHand: matched?.stock,
        riskScore: matched?.risk_score,
        reason: matched?.reason,
      });
    }

    setInventory(payload.inventory ?? []);
    setAlerts(payload.alerts ?? []);
    setCategories(payload.categories ?? []);
    setSkuCount(payload.sku_count ?? payload.inventory?.length ?? 0);
    setTotalUnits(payload.total_units ?? 0);
    setTotalStock(payload.total_stock ?? 0);
    setAvgCoverage(payload.avg_coverage_weeks ?? 0);
    setInsight(payload.insight ?? null);
    setRevenueAtRisk(payload.revenue_at_risk ?? 0);
    setExpediteUnits(payload.expedite_units ?? 0);
    setPriceSource(payload.price_source ?? null);
    setColumnMap(payload.column_map ?? null);
    setSanitized(payload.sanitized_columns_dropped ?? []);
    setPriorityActions(payload.priority_actions ?? []);
    setStatusBreakdown(
      payload.status_breakdown ?? { critical: 0, watch: 0, healthy: 0 },
    );
    setKpis(kpisFrom(payload));
    if (typeof payload.threshold === "number") {
      setScoredThreshold(payload.threshold);
    }
    if (nextFileName !== undefined) setFileName(nextFileName);
  }

  useEffect(() => {
    /* Web Storage hydrate — one-shot, not an external subscription. */
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedSettings = readJson<SettingsState>(SETTINGS_KEY);
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings });
    }
    const savedSession = readJson<SessionState>(SESSION_KEY);
    if (savedSession) {
      setKpis(savedSession.kpis ?? initialKpis);
      setFileName(savedSession.fileName ?? null);
      setInventory(savedSession.inventory ?? []);
      setAlerts(savedSession.alerts ?? []);
      setCategories(savedSession.categories ?? []);
      setSkuCount(savedSession.skuCount ?? 0);
      setTotalUnits(savedSession.totalUnits ?? 0);
      setTotalStock(savedSession.totalStock ?? 0);
      setAvgCoverage(savedSession.avgCoverage ?? 0);
      setInsight(savedSession.insight ?? null);
      setRevenueAtRisk(savedSession.revenueAtRisk ?? 0);
      setExpediteUnits(savedSession.expediteUnits ?? 0);
      setPriceSource(savedSession.priceSource ?? null);
      setColumnMap(savedSession.columnMap ?? null);
      setSanitized(savedSession.sanitized ?? []);
      setPriorityActions(savedSession.priorityActions ?? []);
      setScoredThreshold(
        savedSession.scoredThreshold ??
          savedSettings?.threshold ??
          defaultSettings.threshold,
      );
      setStatusBreakdown(
        savedSession.statusBreakdown ?? { critical: 0, watch: 0, healthy: 0 },
      );
      setDraftContext(savedSession.draftContext ?? null);
      setSupplierDraft(savedSession.supplierDraft ?? null);
    }
    const savedActivity = readJson<ActivityEvent[]>(ACTIVITY_KEY);
    if (savedActivity) setActivity(savedActivity);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    void fetchActivity().then((events) => {
      if (events.length) {
        setActivity((prev) => {
          const ids = new Set(events.map((event) => event.id));
          return [...events, ...prev.filter((event) => !ids.has(event.id))].slice(0, 20);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const session: SessionState = {
      kpis,
      fileName,
      inventory,
      alerts,
      categories,
      skuCount,
      totalUnits,
      totalStock,
      avgCoverage,
      insight,
      revenueAtRisk,
      expediteUnits,
      priceSource,
      columnMap,
      sanitized,
      priorityActions,
      scoredThreshold,
      statusBreakdown,
      draftContext,
      supplierDraft,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [
    hydrated,
    kpis,
    fileName,
    inventory,
    alerts,
    categories,
    skuCount,
    totalUnits,
    totalStock,
    avgCoverage,
    insight,
    revenueAtRisk,
    expediteUnits,
    priceSource,
    columnMap,
    sanitized,
    priorityActions,
    scoredThreshold,
    statusBreakdown,
    draftContext,
    supplierDraft,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 20)));
  }, [activity, hydrated]);

  useEffect(() => {
    if (!hydrated || !inventoryRef.current.length) return;
    if (settings.threshold === scoredThreshold) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        setIsRescoring(true);
        try {
          const payload = await rescoreInventory(
            settings.threshold,
            inventoryRef.current,
          );
          applyPayload(payload);
          setScoredThreshold(settings.threshold);
          setSuccessToast(`Re-scored at threshold ${settings.threshold}`);
          window.setTimeout(() => setSuccessToast(null), 2500);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Could not re-score this week.",
          );
        } finally {
          setIsRescoring(false);
        }
      })();
    }, 450);
    return () => window.clearTimeout(handle);
  }, [hydrated, settings.threshold, scoredThreshold]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }
      if (event.key === "Escape") {
        setDraftOpen(false);
        setShortcutsOpen(false);
        setMobileOpen(false);
        return;
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void loadDemoWeek();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void loadDemoWeek();
        return;
      }
      if (event.key === "1") setActiveNav("overview");
      if (event.key === "2") setActiveNav("analytics");
      if (event.key === "3") setActiveNav("alerts");
      if (event.key === "4") setActiveNav("settings");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetWeek() {
    setKpis(initialKpis);
    setFileName(null);
    setInventory([]);
    setAlerts([]);
    setCategories([]);
    setSkuCount(0);
    setTotalUnits(0);
    setTotalStock(0);
    setAvgCoverage(0);
    setInsight(null);
    setRevenueAtRisk(0);
    setExpediteUnits(0);
    setPriceSource(null);
    setColumnMap(null);
    setSanitized([]);
    setPriorityActions([]);
    setStatusBreakdown({ critical: 0, watch: 0, healthy: 0 });
    setDraftContext(null);
    setSupplierDraft(null);
    setCopied(false);
    setApproved(false);
    setDraftOpen(false);
    setError(null);
    setSuccessToast(null);
    setPipelineStage("idle");
    setIsDragging(false);
    setInputKey((key) => key + 1);
    sessionStorage.removeItem(SESSION_KEY);
    setActiveNav("overview");
  }

  async function fetchSupplierDraft(context: DraftContext): Promise<string | null> {
    setIsDraftLoading(true);
    setApproved(false);
    setPipelineStage("drafting");
    try {
      const draft = await requestSupplierDraft({
        stockout_item: context.stockoutItem,
        trending_item: context.trendingItem,
        maison: settings.maison,
        buyer_name: settings.buyerName,
        recommended_qty: context.recommendedQty ?? null,
        language: settings.language,
        category: context.category ?? null,
        coverage_weeks: context.coverageWeeks ?? null,
        revenue_at_risk: context.revenueAtRisk ?? null,
        units_sold: context.unitsSold ?? null,
        stock_on_hand: context.stockOnHand ?? null,
        risk_score: context.riskScore ?? null,
      });
      setSupplierDraft(draft);
      setPipelineStage("ready");
      return draft;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate supplier draft.";
      setError(message);
      setPipelineStage("ready");
      return null;
    } finally {
      setIsDraftLoading(false);
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || isUploading) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsUploading(true);
    setPipelineStage("parsing");
    setSupplierDraft(null);
    setDraftContext(null);
    setCopied(false);
    setApproved(false);
    setInputKey((key) => key + 1);

    try {
      setPipelineStage("scoring");
      const payload = await uploadCsv(file, settings.threshold);
      applyPayload(payload, file.name);
      setScoredThreshold(settings.threshold);
      setSuccessToast(`Analyzed ${payload.sku_count ?? 0} SKUs from ${file.name}`);
      window.setTimeout(() => setSuccessToast(null), 3200);

      const stockoutItem = payload.high_risk_item || "";
      const trendingItem =
        payload.top_trending_item || payload.top_trending_product?.value || "";
      const matched = (payload.inventory ?? []).find(
        (row) => row.product === stockoutItem,
      );
      if (payload.supplier_draft?.trim()) {
        setSupplierDraft(payload.supplier_draft.trim());
        setPipelineStage("ready");
      } else if (stockoutItem && trendingItem) {
        void fetchSupplierDraft({
          stockoutItem,
          trendingItem,
          recommendedQty: payload.high_risk_recommended_qty ?? undefined,
          category: matched?.category,
          coverageWeeks: matched?.coverage_weeks,
          revenueAtRisk: matched?.revenue_at_risk,
          unitsSold: matched?.units,
          stockOnHand: matched?.stock,
          riskScore: matched?.risk_score,
          reason: matched?.reason,
        });
      } else {
        setPipelineStage("ready");
      }
      setActiveNav("overview");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(message);
      setPipelineStage("idle");
    } finally {
      setIsUploading(false);
    }
  }

  async function loadDemoWeek() {
    try {
      const response = await fetch(DEMO_CSV_URL);
      if (!response.ok) throw new Error("Could not load demo CSV.");
      const blob = await response.blob();
      const file = new File([blob], "sample-week.csv", { type: "text/csv" });
      await uploadFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo load failed.");
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    void uploadFile(e.dataTransfer.files?.[0]);
  }

  async function copyDraft() {
    if (!supplierDraft) return;
    try {
      await navigator.clipboard.writeText(supplierDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function approveDraft() {
    if (!supplierDraft || !draftContext || isApproving) return;
    setIsApproving(true);
    try {
      const event = await approveSupplierDraft(
        draftContext.stockoutItem,
        supplierDraft,
        {
          recommended_qty: draftContext.recommendedQty,
          revenue_at_risk: draftContext.revenueAtRisk,
        },
      );
      setActivity((prev) => [event, ...prev].slice(0, 20));
      setApproved(true);
      setSuccessToast("Draft approved — queued for supplier send");
      window.setTimeout(() => setSuccessToast(null), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setIsApproving(false);
    }
  }

  function contextFor(stockoutItem: string, qty?: number): DraftContext | null {
    const trendingItem =
      draftContext?.trendingItem ||
      kpis.find((card) => card.title === "Top Trending Product")?.value ||
      "";
    const matched = inventory.find((row) => row.product === stockoutItem);
    if (!stockoutItem || !trendingItem || trendingItem === "—") return null;
    return {
      stockoutItem,
      trendingItem,
      recommendedQty: qty ?? matched?.recommended_qty ?? draftContext?.recommendedQty,
      category: matched?.category,
      coverageWeeks: matched?.coverage_weeks,
      revenueAtRisk: matched?.revenue_at_risk,
      unitsSold: matched?.units,
      stockOnHand: matched?.stock,
      riskScore: matched?.risk_score,
      reason: matched?.reason,
    };
  }

  function openDraftPanel(stockoutOverride?: string, qty?: number) {
    const stockoutItem = stockoutOverride || draftContext?.stockoutItem || "";
    const next = contextFor(stockoutItem, qty);
    if (!next) {
      setError("Upload a CSV first to generate a supplier draft.");
      return;
    }
    setDraftContext(next);
    setDraftOpen(true);
    if (
      !supplierDraft ||
      (stockoutOverride && stockoutOverride !== draftContext?.stockoutItem)
    ) {
      setSupplierDraft(null);
      void fetchSupplierDraft(next);
    }
  }

  const pageCopy: Record<NavId, { kicker: string; title: string }> = {
    overview: {
      kicker: "Weekly intelligence",
      title: "LuxStock AI — Merchandising Copilot",
    },
    analytics: {
      kicker: "Assortment pulse",
      title: "Inventory Analytics",
    },
    alerts: {
      kicker: "Atelier exceptions",
      title: "Reorder Alerts",
    },
    settings: {
      kicker: "Maison controls",
      title: "Settings",
    },
  };

  const alertCount = alerts.length;

  return (
    <div className="lux-grain relative flex min-h-screen text-foreground">
      {error && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-50 max-w-sm border border-red-400/40 bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <p>{error}</p>
            <button
              type="button"
              className="text-muted transition-colors hover:text-foreground"
              aria-label="Dismiss error"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {successToast && (
        <div
          role="status"
          className="fixed bottom-6 left-6 z-50 max-w-sm border border-emerald/40 bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-lg"
        >
          {successToast}
        </div>
      )}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[16.5rem] flex-col border-r border-border bg-surface/95 backdrop-blur-md transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border px-6 pb-6 pt-8">
          <p className="font-display text-[1.65rem] font-semibold leading-none tracking-[0.02em] text-foreground">
            LuxStock <span className="text-gold">AI</span>
          </p>
          <p className="mt-2 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted">
            {settings.maison}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-6" aria-label="Main">
          {navItems.map((item) => {
            const active = activeNav === item.id;
            const badge =
              item.id === "alerts" && alertCount
                ? String(alertCount)
                : item.id === "analytics" && skuCount
                  ? String(skuCount)
                  : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileOpen(false);
                }}
                className={`group relative px-4 py-3 text-left text-[0.92rem] tracking-wide transition-colors duration-200 ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`absolute inset-y-2 left-0 w-[2px] rounded-full transition-all duration-300 ${
                    active
                      ? "bg-gold opacity-100"
                      : "bg-emerald opacity-0 group-hover:opacity-40"
                  }`}
                />
                <span className="flex items-center justify-between gap-2">
                  {item.label}
                  {badge && (
                    <span className="border border-border px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-gold">
                      {badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border px-6 py-5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            Maison atelier
          </p>
          <p className="mt-1 text-sm text-foreground/80">Beauty · Fashion</p>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="mt-3 text-[0.65rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold"
          >
            Keyboard · ?
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 py-4 sm:px-8 sm:py-5">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center border border-border text-foreground transition-colors hover:border-gold/50 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <span className="sr-only">Menu</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M2 4.5h14M2 9h14M2 13.5h14"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </button>

            <div className="min-w-0 flex-1 animate-lux-fade-up">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold">
                {pageCopy[activeNav].kicker}
                {isRescoring ? " · re-scoring" : ""}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-medium tracking-tight text-foreground sm:text-[1.85rem]">
                {pageCopy[activeNav].title}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ApiHealthBadge />
              <button
                type="button"
                onClick={resetWeek}
                className="border border-border px-3 py-2 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:border-gold/45 hover:text-foreground"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
          {activeNav === "overview" && (
            <OverviewView
              fileName={fileName}
              isUploading={isUploading}
              isDragging={isDragging}
              pipelineStage={pipelineStage}
              inputKey={inputKey}
              insight={insight}
              revenueAtRisk={revenueAtRisk}
              expediteUnits={expediteUnits}
              priceSource={priceSource}
              columnMap={columnMap}
              sanitized={sanitized}
              kpis={kpis}
              priorityActions={priorityActions}
              onTryDemo={() => void loadDemoWeek()}
              onOpenDraft={(product, qty) => openDraftPanel(product, qty)}
              onDrop={onDrop}
              onDragEnter={(e) => {
                e.preventDefault();
                if (!isUploading) setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isUploading) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onFile={(file) => void uploadFile(file)}
            />
          )}

          {activeNav === "analytics" && (
            <InventoryAnalyticsView
              inventory={inventory}
              skuCount={skuCount}
              totalUnits={totalUnits}
              totalStock={totalStock}
              avgCoverage={avgCoverage}
              statusBreakdown={statusBreakdown}
              categories={categories}
              fileName={fileName}
              insight={insight}
              onTryDemo={() => void loadDemoWeek()}
            />
          )}

          {activeNav === "alerts" && (
            <ReorderAlertsView
              alerts={alerts}
              onOpenDraft={(product, qty) => openDraftPanel(product, qty)}
              onTryDemo={() => void loadDemoWeek()}
              onExport={() => {
                if (!alerts.length) return;
                exportAlertsCsv(alerts);
                setSuccessToast("Reorder alerts exported");
                window.setTimeout(() => setSuccessToast(null), 2500);
              }}
            />
          )}

          {activeNav === "settings" && (
            <SettingsView
              settings={settings}
              fileName={fileName}
              activity={activity}
              scoringLive={Boolean(inventory.length)}
              onChange={setSettings}
              onReset={resetWeek}
              onTryDemo={() => void loadDemoWeek()}
            />
          )}
        </main>
      </div>

      <SupplierDraftPanel
        open={draftOpen}
        draft={supplierDraft}
        language={settings.language}
        draftContext={draftContext}
        isLoading={isDraftLoading}
        isApproving={isApproving}
        approved={approved}
        copied={copied}
        onClose={() => setDraftOpen(false)}
        onChangeDraft={(value) => {
          setSupplierDraft(value);
          setApproved(false);
        }}
        onCopy={() => void copyDraft()}
        onApprove={() => void approveDraft()}
        onRegenerate={() => {
          if (!draftContext) return;
          void fetchSupplierDraft(draftContext);
        }}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
