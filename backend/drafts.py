"""Supplier email drafts: OpenAI first, luxury template fallback always."""

from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
_openai_client = None


def openai_configured() -> bool:
    return bool(OPENAI_API_KEY)


def openai_model() -> Optional[str]:
    return OPENAI_MODEL if OPENAI_API_KEY else None


def _get_openai():
    global _openai_client
    if not OPENAI_API_KEY:
        return None
    if _openai_client is None:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def fallback_supplier_draft(
    stockout_item: str,
    trending_item: str,
    maison: Optional[str],
    buyer_name: Optional[str],
    recommended_qty: Optional[int],
    language: Optional[str] = "en",
    facts: Optional[str] = None,
) -> str:
    brand = maison or "LuxStock Atelier"
    buyer = buyer_name or "Merchandising desk"
    lang = (language or "en").lower()
    facts_line = f"{facts} " if facts else ""

    if lang.startswith("fr"):
        qty_line = (
            f"Merci de prioriser une expedition acceleree d'environ {recommended_qty} unites. "
            if recommended_qty
            else "Merci d'organiser un reapprovisionnement accelere des que possible. "
        )
        return (
            f"Objet : Demande de reapprovisionnement accelere — {stockout_item}\n\n"
            f"Cher partenaire fournisseur,\n\n"
            f"Notre derniere analyse des ventes pour {brand} montre que {stockout_item} "
            f"est a un niveau critique. {facts_line}{qty_line}"
            f"Par ailleurs, {trending_item} se vend egalement tres rapidement.\n\n"
            f"Merci pour votre partenariat.\n\n"
            f"{buyer}\n{brand} — LuxStock AI"
        )

    if lang.startswith("it"):
        qty_line = (
            f"Vi chiediamo di dare priorita a una spedizione urgente di circa {recommended_qty} unita. "
            if recommended_qty
            else "Vi chiediamo un rifornimento urgente non appena possibile. "
        )
        return (
            f"Oggetto: Richiesta di rifornimento urgente — {stockout_item}\n\n"
            f"Gentile partner fornitore,\n\n"
            f"La nostra ultima analisi sell-through per {brand} indica che {stockout_item} "
            f"e a rischio stockout. {facts_line}{qty_line}"
            f"Inoltre, {trending_item} sta vendendo molto rapidamente.\n\n"
            f"Grazie per la collaborazione.\n\n"
            f"{buyer}\n{brand} — LuxStock AI"
        )

    qty_line = (
        f"Please prioritize an expedited shipment of approximately {recommended_qty} units. "
        if recommended_qty
        else "Please arrange an expedited restock at your earliest availability. "
    )
    return (
        f"Subject: Expedited Restock Request — {stockout_item}\n\n"
        f"Dear Supplier Partner,\n\n"
        f"Our latest weekly sell-through for {brand} shows {stockout_item} is critically low. "
        f"{facts_line}{qty_line}"
        f"Separately, {trending_item} continues to sell quickly; guidance on accelerating "
        f"replenishment for that style would be welcome.\n\n"
        f"Thank you for your partnership.\n\n"
        f"{buyer}\n{brand} — LuxStock AI"
    )


def generate_supplier_draft_sync(
    stockout_item: str,
    trending_item: str,
    maison: Optional[str] = None,
    buyer_name: Optional[str] = None,
    recommended_qty: Optional[int] = None,
    language: Optional[str] = "en",
    category: Optional[str] = None,
    coverage_weeks: Optional[float] = None,
    revenue_at_risk: Optional[int] = None,
    units_sold: Optional[int] = None,
    stock_on_hand: Optional[int] = None,
    risk_score: Optional[int] = None,
) -> str:
    brand = maison or "LuxStock Atelier"
    buyer = buyer_name or "Merchandising desk"
    lang = (language or "en").lower()
    language_name = {
        "en": "English",
        "fr": "French",
        "it": "Italian",
    }.get(lang[:2], "English")

    facts_bits = []
    if category:
        facts_bits.append(f"category {category}")
    if units_sold is not None:
        facts_bits.append(f"{units_sold} units sold this week")
    if stock_on_hand is not None:
        facts_bits.append(f"{stock_on_hand} on hand")
    if coverage_weeks is not None:
        facts_bits.append(f"{coverage_weeks} weeks of cover")
    if revenue_at_risk:
        facts_bits.append(f"~${revenue_at_risk:,} weekly revenue at risk")
    if risk_score is not None:
        facts_bits.append(f"risk score {risk_score}")
    facts = ("Merchandising facts: " + "; ".join(facts_bits) + ".") if facts_bits else ""

    qty_note = (
        f" Recommend ordering about {recommended_qty} units."
        if recommended_qty
        else ""
    )
    prompt = (
        f"Act as a Luxury Retail Merchandiser for {brand}. Write a short, professional email "
        f"in {language_name} to a supplier requesting an expedited restock for {stockout_item} because "
        f"it is critically low, and mention that {trending_item} is also selling fast."
        f"{qty_note} {facts} Sign off as {buyer}. Keep it under 120 words. "
        "Include a subject line. Use the merchandising facts; do not invent SKUs, prices, or dates. "
        "Return only the email text."
    )

    client = _get_openai()
    if client is None:
        return fallback_supplier_draft(
            stockout_item,
            trending_item,
            maison,
            buyer_name,
            recommended_qty,
            language,
            facts,
        )

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You write concise luxury retail supplier emails. "
                        "Ground every claim in the merchandising facts provided. "
                        "Return only the email body with a subject line."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=280,
            temperature=0.4,
        )
        text = (response.choices[0].message.content or "").strip()
        if text:
            return text
        raise RuntimeError("OpenAI returned an empty draft.")
    except Exception as exc:
        print(f"[luxstock] OpenAI draft failed, using fallback: {exc}")
        return fallback_supplier_draft(
            stockout_item,
            trending_item,
            maison,
            buyer_name,
            recommended_qty,
            language,
            facts,
        )
