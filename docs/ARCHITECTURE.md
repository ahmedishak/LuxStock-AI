# Architecture notes

## Goal
A merchandising loop: **ingest → analyze → act → audit**, not “chat with a CSV.”

## Layout
- `backend/analysis.py` — Pandas scoring only. Safe to read in an interview without FastAPI noise.
- `backend/drafts.py` — OpenAI supplier email + language fallbacks. Never blocks upload.
- `backend/main.py` — HTTP: upload, rescore, draft, approve, activity, health.

## Key decisions

### 1. Split upload from LLM drafting
`POST /api/upload` returns KPIs immediately. Drafting is `POST /api/supplier-draft`.
**Why:** buyers should see numbers before a model token.

### 2. One scoring engine for upload and live threshold
`POST /api/rescore` re-runs `analyze_dataframe` on already-parsed rows.
**Why:** threshold is a merchandising control, not a form that waits for another file.

### 3. Next.js rewrites to FastAPI
Browser calls `/api/*`; Next proxies to `127.0.0.1:8000`.
**Why:** one origin in demos.

### 4. Price from the file when we have it
`unit_retail` / `price` / `aur` columns win. Category AUR is the fallback and is labeled in the UI.
**Why:** “$42k at risk” is a lie if every dress is $180.

### 5. Honest stockout KPI
Critical count is the count of SKUs at or below threshold. We do not invent a stockout number to make the dashboard look busy.

### 6. OpenAI with template fallback
If `OPENAI_API_KEY` is missing or the API fails, drafts still render, grounded in the same merchandising facts.

### 7. Approve = audit event, not SMTP
`POST /api/approve-draft` prepends to an in-memory trail (`GET /api/activity`).
**Why:** shipping email needs auth, templates, and supplier contacts.

### 8. Client session persistence
KPIs live in `sessionStorage`; settings in `localStorage`. Refresh should not wipe a walkthrough.

## Non-goals (this cut)
- Auth / multi-tenant SaaS
- Real supplier email delivery
- Production warehouse integrations
- Durable activity storage across process restart
