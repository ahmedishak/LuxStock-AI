"""Deterministic merchandising math. No LLM in this module."""

from datetime import datetime, timezone
from typing import Optional

import pandas as pd

SENSITIVE_COLUMNS = {
    "email",
    "customer",
    "customer_name",
    "phone",
    "address",
    "margin",
    "cost",
    "wholesale",
    "ssn",
}

PRODUCT_CANDIDATES = ("product", "product_name", "sku", "item", "name")
UNITS_CANDIDATES = ("units", "units_sold", "quantity", "qty", "sales", "sold")
STOCK_CANDIDATES = (
    "stock",
    "stock_on_hand",
    "on_hand",
    "inventory",
    "qty_on_hand",
    "available",
)
CATEGORY_CANDIDATES = ("category", "department", "collection", "class")
PRICE_CANDIDATES = (
    "unit_retail",
    "aur",
    "price",
    "retail",
    "asp",
    "unit_price",
)


def find_col(lower_cols: dict, candidates: tuple) -> Optional[str]:
    for key in candidates:
        if key in lower_cols:
            return lower_cols[key]
    return None


def assumed_aur(category: str) -> int:
    """Fallback average unit retail when the CSV has no price column."""
    key = category.lower()
    if "beauty" in key or "fragrance" in key:
        return 68
    if "footwear" in key or "accessories" in key or "jewelry" in key:
        return 240
    if "outerwear" in key or "ready" in key or "knit" in key:
        return 420
    return 180


def classify_status(stock: int, threshold: int) -> str:
    critical_threshold = max(int(threshold), 0)
    watch_threshold = max(critical_threshold * 2, critical_threshold + 1)
    if stock <= critical_threshold:
        return "critical"
    if stock <= watch_threshold:
        return "watch"
    return "healthy"


def recommended_qty(units: int, stock: int, status: str) -> int:
    """Target ~3 weeks of cover for critical SKUs, ~2 weeks otherwise."""
    target_cover = 3 if status == "critical" else 2
    needed = max(units * target_cover - stock, 0)
    if needed == 0 and status in ("critical", "watch"):
        return max(units, 6)
    return int(needed)


def risk_score(units: int, stock: int, status: str) -> int:
    if units <= 0:
        base = 40 if status == "critical" else 20
    else:
        cover = stock / units
        base = int(max(0, min(100, round((1 - min(cover, 1.5) / 1.5) * 100))))
    if status == "critical":
        return min(100, max(base, 75))
    if status == "watch":
        return min(100, max(base, 45))
    return min(base, 35)


def sell_through_rate(units: int, stock: int) -> Optional[float]:
    denom = units + stock
    if denom <= 0:
        return None
    return round(units / denom, 3)


def coverage_weeks(units: int, stock: int) -> Optional[float]:
    if units <= 0:
        return None
    return round(stock / units, 2)


def score_row(
    product: str,
    category: str,
    units: int,
    stock: int,
    threshold: int,
    unit_retail: int,
    price_source: str,
) -> dict:
    status = classify_status(stock, threshold)
    qty = recommended_qty(units, stock, status)
    cover = coverage_weeks(units, stock)
    revenue = int(units * unit_retail) if status == "critical" else 0
    return {
        "product": product,
        "category": category,
        "units": units,
        "stock": stock,
        "status": status,
        "coverage_weeks": cover,
        "sell_through": sell_through_rate(units, stock),
        "recommended_qty": qty,
        "risk_score": risk_score(units, stock, status),
        "unit_retail": unit_retail,
        "assumed_aur": unit_retail,
        "price_source": price_source,
        "revenue_at_risk": revenue,
        "reason": _reason(units, stock, cover, status, qty),
    }


def _reason(
    units: int,
    stock: int,
    cover: Optional[float],
    status: str,
    qty: int,
) -> str:
    cover_bit = f"{cover} wks cover" if cover is not None else "no sell-through yet"
    if status == "critical":
        return (
            f"{stock} on hand vs {units} sold this week ({cover_bit}). "
            f"Expedite +{qty} to restore cover."
        )
    if status == "watch":
        return (
            f"{stock} on hand vs {units} sold ({cover_bit}). "
            f"Watch list — recommend +{qty}."
        )
    return f"{stock} on hand vs {units} sold ({cover_bit}). Healthy cover."


def build_insight(
    critical_count: int,
    revenue_at_risk: int,
    top_product: str,
    high_risk_item: str,
    high_risk_qty: Optional[int],
    price_source: str,
) -> str:
    price_note = (
        "using file unit retail"
        if price_source == "column"
        else "using category AUR heuristic"
    )
    if critical_count == 0:
        return (
            f"No SKUs at stockout threshold. Top demand is {top_product}. "
            f"Keep watch-list replenishment on cadence ({price_note})."
        )
    qty_bit = f" (~{high_risk_qty} units)" if high_risk_qty else ""
    return (
        f"{critical_count} SKU{'s' if critical_count != 1 else ''} at stockout risk "
        f"(~${revenue_at_risk:,} weekly revenue at risk, {price_note}); "
        f"top demand is {top_product}. "
        f"First action: expedite {high_risk_item}{qty_bit}."
    )


def analyze_dataframe(df: pd.DataFrame, threshold: int, filename: str) -> dict:
    critical_threshold = max(int(threshold), 0)

    sensitive_hits = {
        str(c).strip().lower() for c in df.columns
    } & SENSITIVE_COLUMNS
    drop_cols = [c for c in df.columns if str(c).strip().lower() in sensitive_hits]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    lower_cols = {str(col).strip().lower(): col for col in df.columns}

    product_col = find_col(lower_cols, PRODUCT_CANDIDATES) or df.columns[0]
    units_col = find_col(lower_cols, UNITS_CANDIDATES)
    stock_col = find_col(lower_cols, STOCK_CANDIDATES)
    category_col = find_col(lower_cols, CATEGORY_CANDIDATES)
    price_col = find_col(lower_cols, PRICE_CANDIDATES)
    price_source = "column" if price_col is not None else "heuristic"

    working = df.copy()
    working["_product"] = working[product_col].astype(str)
    working["_units"] = (
        pd.to_numeric(working[units_col], errors="coerce").fillna(0)
        if units_col is not None
        else 0
    )
    working["_stock"] = (
        pd.to_numeric(working[stock_col], errors="coerce").fillna(0)
        if stock_col is not None
        else 0
    )
    working["_category"] = (
        working[category_col].astype(str) if category_col is not None else "Uncategorized"
    )
    agg = {
        "units": ("_units", "sum"),
        "stock": ("_stock", "min"),
    }
    if price_col is not None:
        working["_price"] = pd.to_numeric(working[price_col], errors="coerce")
        agg["price"] = ("_price", "median")

    aggregated = (
        working.groupby(["_product", "_category"], dropna=False)
        .agg(**agg)
        .reset_index()
    )

    inventory = []
    for rec in aggregated.to_dict(orient="records"):
        units = int(rec["units"])
        stock = int(rec["stock"])
        category = str(rec["_category"])
        raw_price = rec.get("price")
        if raw_price is not None and pd.notna(raw_price) and float(raw_price) > 0:
            unit_retail = int(round(float(raw_price)))
            row_price_source = "column"
        else:
            unit_retail = assumed_aur(category)
            row_price_source = "heuristic"
        inventory.append(
            score_row(
                product=str(rec["_product"]),
                category=category,
                units=units,
                stock=stock,
                threshold=critical_threshold,
                unit_retail=unit_retail,
                price_source=row_price_source,
            )
        )

    inventory.sort(
        key=lambda item: (
            {"critical": 0, "watch": 1, "healthy": 2}.get(item["status"], 3),
            -item["risk_score"],
            -item["revenue_at_risk"],
            -item["units"],
        )
    )

    alerts = [item for item in inventory if item["status"] in ("critical", "watch")]
    critical_count = sum(1 for item in inventory if item["status"] == "critical")
    watch_count = sum(1 for item in inventory if item["status"] == "watch")
    healthy_count = sum(1 for item in inventory if item["status"] == "healthy")

    high_risk = next(
        (item for item in inventory if item["status"] == "critical"),
        alerts[0] if alerts else (inventory[0] if inventory else None),
    )
    high_risk_item = high_risk["product"] if high_risk else "—"
    high_risk_qty = high_risk["recommended_qty"] if high_risk else None

    ranked = aggregated.sort_values("units", ascending=False)
    if not ranked.empty and int(ranked.iloc[0]["units"]) > 0:
        top_product = str(ranked.iloc[0]["_product"])
        top_units = int(ranked.iloc[0]["units"])
        trending_hint = f"{top_units:,} units in this weekly file"
    else:
        top_product = (
            str(working["_product"].dropna().iloc[0]) if not working.empty else "—"
        )
        trending_hint = "Lead product from uploaded assortment"

    total_units = int(aggregated["units"].sum())
    total_stock = int(aggregated["stock"].sum())
    covers = [i["coverage_weeks"] or 0 for i in inventory]
    avg_cover = round(sum(covers) / len(covers), 2) if covers else 0

    category_rollups: dict[str, dict] = {}
    for item in inventory:
        bucket = category_rollups.setdefault(
            item["category"],
            {
                "category": item["category"],
                "units": 0,
                "critical": 0,
                "skus": 0,
                "revenue_at_risk": 0,
            },
        )
        bucket["units"] += item["units"]
        bucket["skus"] += 1
        bucket["revenue_at_risk"] += item["revenue_at_risk"]
        if item["status"] == "critical":
            bucket["critical"] += 1
    categories = sorted(
        category_rollups.values(), key=lambda row: row["revenue_at_risk"] or row["units"], reverse=True
    )

    revenue_at_risk = int(sum(item["revenue_at_risk"] for item in inventory))
    expedite_units = int(
        sum(item["recommended_qty"] for item in inventory if item["status"] == "critical")
    )
    priority_actions = [
        {
            "product": item["product"],
            "category": item["category"],
            "status": item["status"],
            "reason": item["reason"],
            "recommended_qty": item["recommended_qty"],
            "revenue_at_risk": item["revenue_at_risk"],
            "risk_score": item["risk_score"],
            "stock": item["stock"],
            "units": item["units"],
        }
        for item in inventory
        if item["status"] == "critical"
    ][:3]
    if not priority_actions:
        priority_actions = [
            {
                "product": item["product"],
                "category": item["category"],
                "status": item["status"],
                "reason": item["reason"],
                "recommended_qty": item["recommended_qty"],
                "revenue_at_risk": item["revenue_at_risk"],
                "risk_score": item["risk_score"],
                "stock": item["stock"],
                "units": item["units"],
            }
            for item in alerts[:3]
        ]

    insight = build_insight(
        critical_count,
        revenue_at_risk,
        top_product,
        high_risk_item,
        high_risk_qty,
        price_source,
    )

    return {
        "filename": filename,
        "rows": int(len(df)),
        "sku_count": int(len(inventory)),
        "total_units": total_units,
        "total_stock": total_stock,
        "avg_coverage_weeks": avg_cover,
        "critical_count": critical_count,
        "watch_count": watch_count,
        "healthy_count": healthy_count,
        "revenue_at_risk": revenue_at_risk,
        "expedite_units": expedite_units,
        "threshold": critical_threshold,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "insight": insight,
        "price_source": price_source,
        "column_map": {
            "product": str(product_col),
            "units": str(units_col) if units_col else None,
            "stock": str(stock_col) if stock_col else None,
            "category": str(category_col) if category_col else None,
            "price": str(price_col) if price_col else None,
        },
        "status_breakdown": {
            "critical": critical_count,
            "watch": watch_count,
            "healthy": healthy_count,
        },
        "categories": categories[:8],
        "stockout_risk_items": {
            "value": str(critical_count),
            "hint": (
                f"Highest risk: {high_risk_item}"
                if critical_count
                else "No SKUs at the critical threshold"
            ),
        },
        "top_trending_product": {
            "value": top_product,
            "hint": trending_hint,
        },
        "pending_supplier_drafts": {
            "value": str(critical_count),
            "hint": (
                "Open the desk to draft supplier emails"
                if critical_count
                else "No critical drafts required"
            ),
        },
        "high_risk_item": high_risk_item,
        "high_risk_recommended_qty": high_risk_qty,
        "top_trending_item": top_product,
        "priority_actions": priority_actions,
        "inventory": inventory[:80],
        "alerts": alerts[:40],
        "sanitized_columns_dropped": drop_cols,
        "supplier_draft": None,
        "scoring": {
            "critical_rule": "on-hand ≤ threshold",
            "watch_rule": "on-hand ≤ 2× threshold",
            "cover": "on-hand / weekly units",
            "reorder": "3 weeks cover if critical, else 2 weeks",
            "revenue_at_risk": "weekly units × unit retail, critical SKUs only",
        },
    }
