import asyncio
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analysis import analyze_dataframe, score_row
from drafts import (
    generate_supplier_draft_sync,
    openai_configured,
    openai_model,
)

MAX_UPLOAD_BYTES = 2_000_000
ACTIVITY_CAP = 50
_activity: list[dict] = []

app = FastAPI(
    title="LuxStock AI API",
    description=(
        "Merchandising intelligence: deterministic CSV scoring, then an optional "
        "supplier-email draft. Scoring never waits on a model."
    ),
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3004",
        "http://127.0.0.1:3004",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DraftRequest(BaseModel):
    stockout_item: str
    trending_item: str
    maison: Optional[str] = None
    buyer_name: Optional[str] = None
    recommended_qty: Optional[int] = None
    language: Optional[str] = "en"
    category: Optional[str] = None
    coverage_weeks: Optional[float] = None
    revenue_at_risk: Optional[int] = None
    units_sold: Optional[int] = None
    stock_on_hand: Optional[int] = None
    risk_score: Optional[int] = None


class ApproveRequest(BaseModel):
    stockout_item: str
    draft: str = Field(min_length=1)
    recommended_qty: Optional[int] = None
    revenue_at_risk: Optional[int] = None


class RescoreRequest(BaseModel):
    threshold: int = Field(ge=0, le=500)
    inventory: list[dict]


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "luxstock-api",
        "openai_configured": openai_configured(),
        "model": openai_model(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/activity")
async def list_activity():
    return {"events": _activity[:ACTIVITY_CAP], "count": len(_activity)}


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), threshold: int = 5):
    """Parse CSV and return KPIs immediately — do not wait on the LLM."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV is larger than 2 MB.")

    try:
        df = pd.read_csv(BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV contains no data rows.")

    result = analyze_dataframe(df, threshold, file.filename)
    _activity.insert(
        0,
        {
            "id": f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "type": "week_analyzed",
            "product": result["high_risk_item"],
            "message": (
                f"Analyzed {result['sku_count']} SKUs from {file.filename} "
                f"({result['critical_count']} critical)"
            ),
            "preview": result["insight"][:140],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "scored",
        },
    )
    _activity[:] = _activity[:ACTIVITY_CAP]
    return result


@app.post("/api/rescore")
async def rescore(body: RescoreRequest):
    """Re-apply the stock threshold to already-scored rows (live merchandising control)."""
    if not body.inventory:
        raise HTTPException(status_code=400, detail="No inventory to rescore.")

    rows = []
    for raw in body.inventory:
        try:
            product = str(raw.get("product") or "").strip()
            if not product:
                continue
            rows.append(
                score_row(
                    product=product,
                    category=str(raw.get("category") or "Uncategorized"),
                    units=int(raw.get("units") or 0),
                    stock=int(raw.get("stock") or 0),
                    threshold=body.threshold,
                    unit_retail=int(raw.get("unit_retail") or raw.get("assumed_aur") or 180),
                    price_source=str(raw.get("price_source") or "heuristic"),
                )
            )
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid inventory row: {exc}") from exc

    if not rows:
        raise HTTPException(status_code=400, detail="No valid inventory rows.")

    frame = pd.DataFrame(
        [
            {
                "product": r["product"],
                "units_sold": r["units"],
                "stock_on_hand": r["stock"],
                "category": r["category"],
                "unit_retail": r["unit_retail"],
            }
            for r in rows
        ]
    )
    return analyze_dataframe(frame, body.threshold, "rescore.csv")


@app.post("/api/supplier-draft")
async def create_supplier_draft(body: DraftRequest):
    """Generate the AI email on demand so CSV upload stays fast."""
    if not body.stockout_item.strip() or not body.trending_item.strip():
        raise HTTPException(status_code=400, detail="Missing product names for draft.")

    try:
        supplier_draft = await asyncio.to_thread(
            generate_supplier_draft_sync,
            body.stockout_item.strip(),
            body.trending_item.strip(),
            body.maison,
            body.buyer_name,
            body.recommended_qty,
            body.language,
            body.category,
            body.coverage_weeks,
            body.revenue_at_risk,
            body.units_sold,
            body.stock_on_hand,
            body.risk_score,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate supplier draft: {exc}",
        ) from exc

    return {
        "supplier_draft": supplier_draft,
        "openai_used": openai_configured(),
        "model": openai_model(),
    }


@app.post("/api/approve-draft")
async def approve_draft(body: ApproveRequest):
    """Queue-style audit event. Does not send SMTP."""
    event = {
        "id": f"evt_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "type": "draft_approved",
        "product": body.stockout_item.strip(),
        "message": f"Supplier draft approved for {body.stockout_item.strip()}",
        "preview": body.draft.strip()[:140],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "queued_for_send",
        "recommended_qty": body.recommended_qty,
        "revenue_at_risk": body.revenue_at_risk,
    }
    _activity.insert(0, event)
    _activity[:] = _activity[:ACTIVITY_CAP]
    return {"ok": True, "event": event}
