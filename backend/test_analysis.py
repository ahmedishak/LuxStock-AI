from io import StringIO

import pandas as pd

from analysis import (
    analyze_dataframe,
    classify_status,
    recommended_qty,
    risk_score,
    sell_through_rate,
)
from drafts import fallback_supplier_draft


def test_recommended_qty_critical_targets_three_weeks():
    assert recommended_qty(units=10, stock=2, status="critical") == 28


def test_recommended_qty_watch_targets_two_weeks():
    assert recommended_qty(units=10, stock=8, status="watch") == 12


def test_risk_score_critical_floor():
    assert risk_score(units=20, stock=1, status="critical") >= 75


def test_classify_status_boundaries():
    assert classify_status(stock=5, threshold=5) == "critical"
    assert classify_status(stock=6, threshold=5) == "watch"
    assert classify_status(stock=10, threshold=5) == "watch"
    assert classify_status(stock=11, threshold=5) == "healthy"


def test_sell_through_rate():
    assert sell_through_rate(48, 2) == 0.96
    assert sell_through_rate(0, 0) is None


def test_analyze_dataframe_flags_critical_and_sanitizes():
    csv = """product,units_sold,stock_on_hand,category,email,margin
Silk Slip Dress,48,2,Ready-to-wear,buyer@example.com,0.62
Velvet Lip Glow,120,34,Beauty,x@y.com,0.55
"""
    df = pd.read_csv(StringIO(csv))
    result = analyze_dataframe(df, threshold=5, filename="week.csv")

    assert result["critical_count"] == 1
    assert result["high_risk_item"] == "Silk Slip Dress"
    assert result["high_risk_recommended_qty"] == 142
    assert result["revenue_at_risk"] > 0
    assert result["stockout_risk_items"]["value"] == "1"
    assert "email" in result["sanitized_columns_dropped"]
    assert "margin" in result["sanitized_columns_dropped"]
    assert result["inventory"][0]["recommended_qty"] > 0
    assert result["inventory"][0]["reason"]
    assert "insight" in result
    assert result["priority_actions"][0]["product"] == "Silk Slip Dress"
    assert result["price_source"] == "heuristic"
    assert result["column_map"]["units"] == "units_sold"


def test_no_critical_does_not_invent_stockouts():
    csv = """product,units_sold,stock_on_hand,category
Velvet Lip Glow,120,34,Beauty
Pearl Drop Earring,55,28,Jewelry
"""
    df = pd.read_csv(StringIO(csv))
    result = analyze_dataframe(df, threshold=5, filename="healthy.csv")
    assert result["critical_count"] == 0
    assert result["stockout_risk_items"]["value"] == "0"
    assert result["pending_supplier_drafts"]["value"] == "0"
    assert result["revenue_at_risk"] == 0


def test_unit_retail_column_beats_heuristic():
    csv = """product,units_sold,stock_on_hand,category,unit_retail
Silk Slip Dress,48,2,Ready-to-wear,890
"""
    df = pd.read_csv(StringIO(csv))
    result = analyze_dataframe(df, threshold=5, filename="priced.csv")
    assert result["price_source"] == "column"
    assert result["inventory"][0]["unit_retail"] == 890
    assert result["revenue_at_risk"] == 48 * 890
    assert "unit retail" in result["insight"].lower() or "using file" in result["insight"].lower()


def test_fallback_drafts_include_facts_and_languages():
    en = fallback_supplier_draft(
        "Silk Slip Dress",
        "Velvet Lip Glow",
        "Maison Test",
        "Ishak",
        40,
        "en",
        "Merchandising facts: 2 on hand.",
    )
    fr = fallback_supplier_draft("A", "B", None, None, None, "fr", None)
    it = fallback_supplier_draft("A", "B", None, None, 12, "it", None)
    assert "Silk Slip Dress" in en and "Ishak" in en and "2 on hand" in en
    assert "Objet" in fr
    assert "Oggetto" in it and "12" in it
