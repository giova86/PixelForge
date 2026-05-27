#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"

source "$ROOT/_ui.sh"

# ── Preflight checks ──────────────────────────────────────────────────────────
if [ ! -f "$VENV/bin/python" ]; then
  printf '\n  \033[31m✗\033[0m  Virtual environment not found — run \033[1m./setup.sh\033[0m first.\n\n' >&2
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  printf '\n  \033[31m✗\033[0m  Frontend dependencies not found — run \033[1m./setup.sh\033[0m first.\n\n' >&2
  exit 1
fi

# ── Cleanup on exit (Ctrl+C or error) ────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

_CLEANED=0
cleanup() {
  [ "$_CLEANED" -eq 1 ] && return
  _CLEANED=1
  _pf_spinner_stop
  [ -n "$BACKEND_PID" ] && pf_shutdown_msg
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ] && pf_shutdown_done
  true
}
trap cleanup EXIT INT TERM

pf_banner "start"

# ── Start backend ─────────────────────────────────────────────────────────────
pf_step_plain "Backend"
cd "$ROOT/backend"
"$VENV/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8000 \
  > /dev/null 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 20); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    pf_done "ready"
    break
  fi
  if [ "$i" -eq 20 ]; then
    pf_fail "not responding after 10s"
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    pf_fail "backend process died"
  fi
  sleep 0.5
done

# ── Start frontend ────────────────────────────────────────────────────────────
pf_step_plain "Frontend"
cd "$ROOT/frontend"
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
sleep 1
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  pf_fail "process exited immediately"
fi
pf_done "ready"

# ── Status box ────────────────────────────────────────────────────────────────
pf_status_box

# Keep script alive until Ctrl+C
wait
