export type InventoryRow = {
  product: string;
  category?: string;
  units: number;
  stock: number;
  status: "critical" | "watch" | "healthy" | string;
  coverage_weeks: number | null;
  sell_through?: number | null;
  recommended_qty?: number;
  risk_score?: number;
  unit_retail?: number;
  assumed_aur?: number;
  price_source?: string;
  revenue_at_risk?: number;
  reason?: string;
};

export type CategoryRollup = {
  category: string;
  units: number;
  critical: number;
  skus: number;
  revenue_at_risk?: number;
};

export type PriorityAction = {
  product: string;
  category?: string;
  status: string;
  reason: string;
  recommended_qty: number;
  revenue_at_risk: number;
  risk_score: number;
  stock: number;
  units: number;
};

export type ColumnMap = {
  product?: string | null;
  units?: string | null;
  stock?: string | null;
  category?: string | null;
  price?: string | null;
};

export type UploadResponse = {
  stockout_risk_items?: { value?: string; hint?: string };
  top_trending_product?: { value?: string; hint?: string };
  pending_supplier_drafts?: { value?: string; hint?: string };
  supplier_draft?: string | null;
  high_risk_item?: string;
  high_risk_recommended_qty?: number | null;
  top_trending_item?: string;
  inventory?: InventoryRow[];
  alerts?: InventoryRow[];
  categories?: CategoryRollup[];
  sku_count?: number;
  total_units?: number;
  total_stock?: number;
  avg_coverage_weeks?: number;
  insight?: string;
  revenue_at_risk?: number;
  expedite_units?: number;
  price_source?: string;
  column_map?: ColumnMap;
  priority_actions?: PriorityAction[];
  sanitized_columns_dropped?: string[];
  status_breakdown?: { critical: number; watch: number; healthy: number };
  scoring?: Record<string, string>;
  threshold?: number;
  detail?: string | { msg?: string }[];
};

export type DraftRequestBody = {
  stockout_item: string;
  trending_item: string;
  maison?: string;
  buyer_name?: string;
  recommended_qty?: number | null;
  language?: string;
  category?: string | null;
  coverage_weeks?: number | null;
  revenue_at_risk?: number | null;
  units_sold?: number | null;
  stock_on_hand?: number | null;
  risk_score?: number | null;
};

export type ActivityEvent = {
  id: string;
  type: string;
  product: string;
  message: string;
  preview?: string;
  timestamp: string;
  status: string;
  recommended_qty?: number | null;
  revenue_at_risk?: number | null;
};

function detailMessage(
  detail: string | { msg?: string }[] | undefined,
  fallback: string,
) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(", ") || fallback;
  }
  return fallback;
}

export async function uploadCsv(file: File, threshold: number) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `/api/upload?threshold=${encodeURIComponent(threshold)}`,
    { method: "POST", body: formData },
  );
  const payload = (await response.json().catch(() => null)) as UploadResponse | null;
  if (!response.ok || !payload) {
    throw new Error(detailMessage(payload?.detail, "Upload failed. Please try again."));
  }
  return payload;
}

export async function rescoreInventory(threshold: number, inventory: InventoryRow[]) {
  const response = await fetch("/api/rescore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold, inventory }),
  });
  const payload = (await response.json().catch(() => null)) as UploadResponse | null;
  if (!response.ok || !payload) {
    throw new Error(detailMessage(payload?.detail, "Could not rescore with the new threshold."));
  }
  return payload;
}

export async function fetchSupplierDraft(body: DraftRequestBody) {
  const response = await fetch("/api/supplier-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    supplier_draft?: string;
    detail?: string | { msg?: string }[];
  } | null;
  if (!response.ok) {
    throw new Error(
      detailMessage(payload?.detail, "Failed to generate supplier draft."),
    );
  }
  return payload?.supplier_draft?.trim() || null;
}

export async function approveSupplierDraft(
  stockoutItem: string,
  draft: string,
  extras?: { recommended_qty?: number; revenue_at_risk?: number },
) {
  const response = await fetch("/api/approve-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stockout_item: stockoutItem,
      draft,
      recommended_qty: extras?.recommended_qty ?? null,
      revenue_at_risk: extras?.revenue_at_risk ?? null,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    event?: ActivityEvent;
    detail?: string;
  } | null;
  if (!response.ok || !payload?.event) {
    throw new Error(payload?.detail || "Could not approve draft.");
  }
  return payload.event;
}

export async function fetchActivity(): Promise<ActivityEvent[]> {
  const response = await fetch("/api/activity", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as {
    events?: ActivityEvent[];
  } | null;
  return payload?.events ?? [];
}

export function exportAlertsCsv(
  alerts: InventoryRow[],
  filename = "luxstock-reorder-alerts.csv",
) {
  const header = [
    "product",
    "category",
    "status",
    "units",
    "stock",
    "coverage_weeks",
    "sell_through",
    "recommended_qty",
    "risk_score",
    "unit_retail",
    "revenue_at_risk",
    "reason",
  ];
  const rows = alerts.map((row) =>
    [
      row.product,
      row.category ?? "",
      row.status,
      row.units,
      row.stock,
      row.coverage_weeks ?? "",
      row.sell_through ?? "",
      row.recommended_qty ?? "",
      row.risk_score ?? "",
      row.unit_retail ?? row.assumed_aur ?? "",
      row.revenue_at_risk ?? "",
      row.reason ?? "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
