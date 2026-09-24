.PHONY: backend frontend demo health test up down status install-service uninstall-service

backend:
	cd backend && .venv/bin/uvicorn main:app --reload --port 8000 --host 127.0.0.1

frontend:
	cd frontend && npm run dev -- -p 3004 -H 127.0.0.1

up:
	bash scripts/dev-up.sh

down:
	bash scripts/dev-down.sh

status:
	bash scripts/dev-status.sh

install-service:
	bash scripts/dev-install-launchd.sh

uninstall-service:
	bash scripts/dev-uninstall-launchd.sh

health:
	curl -s http://127.0.0.1:8000/api/health | python3 -m json.tool

test:
	cd backend && .venv/bin/python -m pytest -q

demo:
	@echo "Open http://127.0.0.1:3004 and click Try demo week (or press Cmd/Ctrl+D)"
