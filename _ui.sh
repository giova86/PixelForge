#!/usr/bin/env bash
# Terminal UI helpers for PixelForge — source this file, do not execute directly.

# ── Colors ────────────────────────────────────────────────────────────────────
CYAN='\033[36m'; GREEN='\033[32m'; YELLOW='\033[33m'
RED='\033[31m'; DIM='\033[2m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Banner ────────────────────────────────────────────────────────────────────
pf_banner() {
  local sub="${1:-}"
  printf '\n  \033[36m┃\033[0m \033[1m▶  P I X E L F O R G E\033[0m'
  [ -n "$sub" ] && printf '  \033[2m—  %s\033[0m' "$sub"
  printf '  \033[36m┃\033[0m\n\n'
}

# ── Spinner internals ─────────────────────────────────────────────────────────
_PF_SPINNER_PID=""
_PF_STEP_LABEL=""   # with ANSI escape codes
_PF_STEP_VISIBLE="" # visible chars only (for padding calculation)

_pf_spinner_loop() {
  set +e
  local label="$1" visible="$2"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  local pad=$(( 48 - ${#visible} ))
  [ $pad -lt 2 ] && pad=2
  local spaces; spaces=$(printf '%*s' "$pad" '')
  while true; do
    printf '\r%b%s\033[36m%s\033[0m' "$label" "$spaces" "${frames[$i]}"
    sleep 0.08
    i=$(( (i + 1) % 10 ))
  done
}

_pf_spinner_start() {
  _pf_spinner_loop "$_PF_STEP_LABEL" "$_PF_STEP_VISIBLE" &
  _PF_SPINNER_PID=$!
}

_pf_spinner_stop() {
  if [ -n "$_PF_SPINNER_PID" ]; then
    kill "$_PF_SPINNER_PID" 2>/dev/null
    wait "$_PF_SPINNER_PID" 2>/dev/null
    _PF_SPINNER_PID=""
    printf '\r%-80s\r' ''
  fi
}

# ── Step with number (starts spinner) ────────────────────────────────────────
pf_step() {
  local n="$1" total="$2" label="$3"
  _PF_STEP_VISIBLE="  [${n}/${total}]  ${label}"
  _PF_STEP_LABEL="  \033[1m[${n}/${total}]\033[0m  ${label}"
  printf '%b' "$_PF_STEP_LABEL"
  _pf_spinner_start
}

# ── Step without number (starts spinner) ─────────────────────────────────────
pf_step_plain() {
  local label="$1"
  _PF_STEP_VISIBLE="  ${label}"
  _PF_STEP_LABEL="  ${label}"
  printf '%b' "$_PF_STEP_LABEL"
  _pf_spinner_start
}

# ── Step header without spinner (for steps with sub-items) ───────────────────
pf_step_header() {
  local n="$1" total="$2" label="$3"
  printf '  \033[1m[%s/%s]\033[0m  %s\n' "$n" "$total" "$label"
}

# ── Step resolution functions ─────────────────────────────────────────────────
pf_done() {
  local msg="${1:-done}"
  _pf_spinner_stop
  local pad=$(( 48 - ${#_PF_STEP_VISIBLE} ))
  [ $pad -lt 2 ] && pad=2
  local spaces; spaces=$(printf '%*s' "$pad" '')
  printf '%b%s\033[32m✓\033[0m  \033[2m%s\033[0m\n' "$_PF_STEP_LABEL" "$spaces" "$msg"
}

pf_skip() {
  local msg="${1:-skipped}"
  _pf_spinner_stop
  local pad=$(( 48 - ${#_PF_STEP_VISIBLE} ))
  [ $pad -lt 2 ] && pad=2
  local spaces; spaces=$(printf '%*s' "$pad" '')
  printf '%b%s\033[2m✓  %s\033[0m\n' "$_PF_STEP_LABEL" "$spaces" "$msg"
}

pf_fail() {
  local msg="${1:-failed}"
  _pf_spinner_stop
  local pad=$(( 48 - ${#_PF_STEP_VISIBLE} ))
  [ $pad -lt 2 ] && pad=2
  local spaces; spaces=$(printf '%*s' "$pad" '')
  printf '%b%s\033[31m✗\033[0m  %s\n' "$_PF_STEP_LABEL" "$spaces" "$msg" >&2
  exit 1
}

# ── Substep helpers (indented, for model weights etc.) ───────────────────────
pf_substep_done() {
  local name="$1" msg="${2:-done}"
  printf '         \033[2m%-40s  ✓  %s\033[0m\n' "$name" "$msg"
}

pf_substep_downloading() {
  local name="$1" size="${2:-}"
  if [ -n "$size" ]; then
    printf '         %-40s  \033[2m(%s)\033[0m  \033[36m↓\033[0m  downloading...' "$name" "$size"
  else
    printf '         %-40s  \033[36m↓\033[0m  downloading...' "$name"
  fi
}

pf_substep_downloaded() {
  local name="$1"
  printf '\r         \033[2m%-40s  ✓  downloaded\033[0m\n' "$name"
}

# ── Status box ────────────────────────────────────────────────────────────────
pf_status_box() {
  printf '\n'
  printf '  \033[36m╭──────────────────────────────────────────────────────╮\033[0m\n'
  printf '  \033[36m│\033[0m                                                      \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m   \033[1mP I X E L F O R G E\033[0m  \033[2m—  running\033[0m                    \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m                                                      \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m   \033[32m●\033[0m  Frontend   \033[36m→\033[0m   \033[1mhttp://localhost:5173\033[0m            \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m   \033[32m●\033[0m  Backend    \033[36m→\033[0m   \033[1mhttp://localhost:8000\033[0m            \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m                                                      \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m   Press  \033[1mCtrl+C\033[0m  to stop                               \033[36m│\033[0m\n'
  printf '  \033[36m│\033[0m                                                      \033[36m│\033[0m\n'
  printf '  \033[36m╰──────────────────────────────────────────────────────╯\033[0m\n'
  printf '\n'
}

# ── Shutdown message ──────────────────────────────────────────────────────────
pf_shutdown_msg() {
  printf '\n  \033[2mShutting down...\033[0m\n'
}

pf_shutdown_done() {
  printf '  \033[32m✓\033[0m  Done.\n\n'
}
