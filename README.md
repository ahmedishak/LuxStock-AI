# LuxStock AI — Merchandising Copilot

Exception-first weekly desk: CSV sell-through → stockout risk → revenue at risk → supplier draft → audit trail.

**Local demo:** [http://localhost:3004](http://localhost:3004) → **Load sample week** (`Shift+D`)

---

## Why this exists
Luxury merchandising interviews kill “chat with a CSV” toys. This project is a closed loop: **ingest → score (deterministic) → act (draft) → audit**. The model writes copy. Pandas decides what is at risk.

## Architecture
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
Next.js :3004  --/api/* rewrite-->  FastAPI :8000
                 analysis.py (math)
                 drafts.py (OpenAI + fallback)
```

**Stack:** Next.js 16 · React 19 · Tailwind 4 · FastAPI · Pandas · OpenAI (`gpt-4o-mini`) + template fallback

## 90-second walkthrough
1. Overview → **Load sample week** (unit retail is in the file, not a fake AUR)
2. Read **This week's desk** — three actions, dollars at stake, mapped columns
3. Settings → change the critical threshold → watch SKUs re-score live
4. Analytics → risk mix, search, sell-through, R@R
5. Alerts → filter critical → draft email (facts go into the prompt)
6. Edit / `fr` or `it` → regenerate → **Approve & Send** → Settings activity trail

## Run
```bash
make up                 # macOS LaunchAgents (:3004 + :8000)
make status
make down
make uninstall-service
make test
```

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ERR_CONNECTION_REFUSED` on `:3004` | Agents not loaded | `make up` then `make status` |
| UI loads, API badge red | Backend agent down | `make down && make up` |

Set `OPENAI_API_KEY` in `backend/.env`. Drafts still render from templates if it is missing.

## What is real vs theater
| Real | Honest limit |
| --- | --- |
| Risk, cover, reorder qty, sell-through — unit tested | Approve queues an event; it does not SMTP |
| `unit_retail` from CSV when present | Category AUR heuristic only if price is absent |
| Live `/api/rescore` from the same scoring module | Activity log is in-process, not a database |
| PII-ish columns dropped before scoring | No auth / multi-tenant |

## CI
GitHub Actions: backend `pytest` (scoring + API) and frontend `lint` + `build`.
