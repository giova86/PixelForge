#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"
PYTHON="python3.13"

echo "==> PixelForge setup"
echo ""

# ── 1. Virtual environment ────────────────────────────────────────────────────
if [ -d "$VENV" ]; then
  echo "[1/5] Venv already exists at .venv — skipping creation"
else
  echo "[1/5] Creating Python venv at .venv"
  "$PYTHON" -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

# ── 2. Core backend deps (fast) ───────────────────────────────────────────────
echo "[2/5] Installing core backend dependencies..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet \
  "fastapi==0.111.0" \
  "uvicorn[standard]==0.29.0" \
  "python-multipart==0.0.9" \
  "aiofiles==23.2.1" \
  "Pillow" \
  "pillow-heif" \
  "pytest==8.2.0" \
  "httpx==0.27.0" \
  "pytest-asyncio==0.23.6"

# ── 3. PyTorch ────────────────────────────────────────────────────────────────
echo "[3/5] Installing PyTorch (this may take a few minutes)..."
if "$PY" -c "import torch" 2>/dev/null; then
  echo "      torch already installed — skipping"
else
  "$PIP" install --quiet torch torchvision
fi

# ── 4. basicsr (requires workaround on Python 3.13) + realesrgan ─────────────
echo "[4/5] Installing basicsr + realesrgan..."
if "$PY" -c "import basicsr" 2>/dev/null; then
  echo "      basicsr already installed — skipping"
else
  # basicsr 1.4.2 has a Python 3.13 incompatibility in setup.py (exec() locals bug).
  # Workaround: clone, pre-create version.py, patch setup.py, install from source.
  TMP=$(mktemp -d)
  echo "      Cloning BasicSR to fix Python 3.13 compatibility..."
  git clone --quiet --depth 1 https://github.com/XPixelGroup/BasicSR.git "$TMP/basicsr"
  # Pre-create version.py so setup.py doesn't need exec() to populate it
  cat > "$TMP/basicsr/basicsr/version.py" << 'EOF'
__version__ = "1.4.2"
EOF
  # Patch setup.py: replace get_version() with direct read of version.py
  python3 - "$TMP/basicsr/setup.py" << 'PATCH'
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
print("Patched setup.py")
PATCH
  cd "$TMP/basicsr" && "$PY" setup.py install --quiet 2>&1 | tail -3
  cd "$ROOT"
  rm -rf "$TMP"
  echo "      basicsr installed from source"
fi

if "$PY" -c "import realesrgan" 2>/dev/null; then
  echo "      realesrgan already installed — skipping"
else
  "$PIP" install --quiet realesrgan
fi

# ── 5. Model weights ──────────────────────────────────────────────────────────
echo "[5/5] Checking Real-ESRGAN model weights..."
WEIGHTS_DIR="$ROOT/backend/weights"
mkdir -p "$WEIGHTS_DIR"

download_weight() {
  local name="$1" url="$2"
  if [ -f "$WEIGHTS_DIR/$name" ]; then
    echo "      $name already present — skipping"
  else
    echo "      Downloading $name (~65 MB)..."
    curl -L --progress-bar -o "$WEIGHTS_DIR/$name" "$url"
  fi
}

download_weight "RealESRGAN_x4plus.pth" \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
download_weight "RealESRGAN_x2plus.pth" \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"

# ── Frontend deps ─────────────────────────────────────────────────────────────
echo ""
echo "Installing frontend dependencies..."
cd "$ROOT/frontend" && npm install --silent
cd "$ROOT"

echo ""
echo "✓ Setup complete."
echo ""
echo "  Run the app:  ./start.sh"
