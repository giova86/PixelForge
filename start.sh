#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"

# ── Check venv exists ─────────────────────────────────────────────────────────
if [ ! -f "$VENV/bin/python" ]; then
  echo "Error: virtual environment not found."
  echo "Run ./setup.sh first."
  exit 1
fi

# ── Check frontend deps ───────────────────────────────────────────────────────
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Error: frontend node_modules not found."
  echo "Run ./setup.sh first."
  exit 1
fi

# ── Cleanup on exit (Ctrl+C or error) ────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────────────────────────
echo "Starting backend  →  http://localhost:8000"
cd "$ROOT/backend"
"$VENV/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Wait for backend to be ready ─────────────────────────────────────────────
echo -n "Waiting for backend..."
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo " ready."
    break
  fi
  sleep 0.5
done

# ── Start frontend ────────────────────────────────────────────────────────────
echo "Starting frontend →  http://localhost:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "  PixelForge running:"
echo "    Frontend  →  http://localhost:5173"
echo "    Backend   →  http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop both."
echo ""

# Keep script alive until Ctrl+C
wait
