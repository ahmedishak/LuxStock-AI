from io import BytesIO

from fastapi.testclient import TestClient

from main import app, _activity

client = TestClient(app)


def setup_function():
    _activity.clear()


def test_health_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "luxstock-api"
    assert "openai_configured" in body


def test_upload_rejects_non_csv():
    response = client.post(
        "/api/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_upload_and_activity_and_approve():
    csv = (
        "product,units_sold,stock_on_hand,category,unit_retail,email\n"
        "Silk Slip Dress,48,2,Ready-to-wear,890,buyer@example.com\n"
        "Velvet Lip Glow,120,34,Beauty,72,x@y.com\n"
    ).encode()
    response = client.post(
        "/api/upload?threshold=5",
        files={"file": ("week.csv", BytesIO(csv), "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["critical_count"] == 1
    assert body["high_risk_item"] == "Silk Slip Dress"
    assert body["revenue_at_risk"] == 48 * 890
    assert body["column_map"]["price"] == "unit_retail"
    assert "email" in body["sanitized_columns_dropped"]

    activity = client.get("/api/activity").json()
    assert activity["count"] >= 1
    assert activity["events"][0]["type"] == "week_analyzed"

    draft = client.post(
        "/api/supplier-draft",
        json={
            "stockout_item": "Silk Slip Dress",
            "trending_item": "Velvet Lip Glow",
            "recommended_qty": 142,
            "units_sold": 48,
            "stock_on_hand": 2,
            "language": "en",
        },
    )
    assert draft.status_code == 200
    assert "Silk Slip Dress" in draft.json()["supplier_draft"]

    approved = client.post(
        "/api/approve-draft",
        json={
            "stockout_item": "Silk Slip Dress",
            "draft": "Subject: Restock\n\nPlease ship 142 units.",
            "recommended_qty": 142,
            "revenue_at_risk": 42720,
        },
    )
    assert approved.status_code == 200
    assert approved.json()["event"]["status"] == "queued_for_send"
    assert client.get("/api/activity").json()["events"][0]["type"] == "draft_approved"


def test_rescore_changes_critical_count():
    csv = (
        "product,units_sold,stock_on_hand,category\n"
        "Satin Heel Mule,44,7,Footwear\n"
    ).encode()
    uploaded = client.post(
        "/api/upload?threshold=5",
        files={"file": ("week.csv", BytesIO(csv), "text/csv")},
    ).json()
    assert uploaded["critical_count"] == 0
    assert uploaded["watch_count"] == 1

    rescored = client.post(
        "/api/rescore",
        json={"threshold": 10, "inventory": uploaded["inventory"]},
    )
    assert rescored.status_code == 200
    assert rescored.json()["critical_count"] == 1
