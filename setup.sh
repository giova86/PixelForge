#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"
PYTHON="python3.13"

source "$ROOT/_ui.sh"

pf_banner "setup"

# ── 1. Virtual environment ────────────────────────────────────────────────────
pf_step 1 6 "Virtual environment"
if [ -d "$VENV" ]; then
  pf_skip "already exists"
else
  "$PYTHON" -m venv "$VENV" 2>/dev/null || pf_fail "python3.13 not found"
  pf_done "created"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

# ── 2. Core backend deps ──────────────────────────────────────────────────────
pf_step 2 6 "Backend dependencies"
"$PIP" install --quiet --upgrade pip 2>/dev/null
"$PIP" install --quiet \
  "fastapi==0.111.0" \
  "uvicorn[standard]==0.29.0" \
  "python-multipart==0.0.9" \
  "aiofiles==23.2.1" \
  "Pillow" \
  "pillow-heif" \
  "pytest==8.2.0" \
  "httpx==0.27.0" \
  "pytest-asyncio==0.23.6" 2>/dev/null
pf_done

# ── 3. PyTorch ────────────────────────────────────────────────────────────────
pf_step 3 6 "PyTorch"
if "$PY" -c "import torch" 2>/dev/null; then
  pf_skip "already installed"
else
  "$PIP" install --quiet torch torchvision 2>/dev/null
  pf_done
fi

# ── 4. basicsr + realesrgan ───────────────────────────────────────────────────
pf_step 4 6 "basicsr + realesrgan"
if "$PY" -c "import basicsr; import realesrgan" 2>/dev/null; then
  pf_skip "already installed"
else
  if ! "$PY" -c "import basicsr" 2>/dev/null; then
    TMP=$(mktemp -d)
    git clone --quiet --depth 1 https://github.com/XPixelGroup/BasicSR.git "$TMP/basicsr" 2>/dev/null \
      || pf_fail "git clone failed"
    cat > "$TMP/basicsr/basicsr/version.py" << 'EOF'
__version__ = "1.4.2"
EOF
    python3 - "$TMP/basicsr/setup.py" 2>/dev/null << 'PATCH'
import sys, re
path = sys.argv[1]
with open(path) as f:
    content = f.read()
new_fn = '''def get_version():
    ns = {}
    with open("basicsr/version.py") as f:
        exec(f.read(), ns)
    return ns["__version__"]
'''
content = re.sub(r'def get_version\(\):.*?(?=\ndef |\nsetup)', new_fn, content, flags=re.DOTALL)
with open(path, "w") as f:
    f.write(content)
PATCH
    cd "$TMP/basicsr" && "$PY" setup.py install --quiet 2>/dev/null
    cd "$ROOT"
    rm -rf "$TMP"
  fi
  if ! "$PY" -c "import realesrgan" 2>/dev/null; then
    "$PIP" install --quiet realesrgan 2>/dev/null
  fi
  pf_done
fi

# ── 5. Model weights ──────────────────────────────────────────────────────────
pf_step_header 5 6 "Model weights"
WEIGHTS_DIR="$ROOT/backend/weights"
mkdir -p "$WEIGHTS_DIR"

_download_weight() {
  local name="$1" url="$2" size="${3:-}"
  if [ -f "$WEIGHTS_DIR/$name" ]; then
    pf_substep_done "$name" "present"
  else
    pf_substep_downloading "$name" "$size"
    curl -L --silent -o "$WEIGHTS_DIR/$name" "$url" 2>/dev/null \
      || { printf '\n'; pf_fail "download failed: $name"; }
    pf_substep_downloaded "$name"
  fi
}

_download_weight "RealESRGAN_x4plus.pth" \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" \
  "~65 MB"
_download_weight "RealESRGAN_x2plus.pth" \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" \
  "~65 MB"

# ── 6. Frontend deps ──────────────────────────────────────────────────────────
pf_step 6 6 "Frontend dependencies"
cd "$ROOT/frontend" && npm install --silent 2>/dev/null
cd "$ROOT"
pf_done

printf '\n  \033[32m✓\033[0m  \033[1mSetup complete\033[0m  \033[2m—  run ./start.sh\033[0m\n\n'
