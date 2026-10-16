#!/usr/bin/env bash
# Crea un PixelForge.app autonomo (Python + PyTorch + backend + frontend + modelli
# dentro il bundle) e, con --dmg, il disco di installazione PixelForge.dmg.
# Solo Apple Silicon (arm64). Richiede: swiftc, node/npm, uv, e un .venv già
# configurato con ./setup.sh (da cui vengono copiati i pacchetti Python).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/PixelForge.app"
BUILD="$ROOT/mac-app/build"
SWIFT_SRC="$ROOT/mac-app/PixelForge.swift"
VENV="$ROOT/.venv"
PYVER="3.13"
MAKE_DMG=0
[ "${1:-}" = "--dmg" ] && MAKE_DMG=1

step() { echo; echo "▸ $*"; }

# ── Preflight ────────────────────────────────────────────────────────────────
[ "$(uname -m)" = "arm64" ] || { echo "ERRORE: serve un Mac Apple Silicon."; exit 1; }
for cmd in swiftc npm uv; do
    command -v "$cmd" &>/dev/null || { echo "ERRORE: '$cmd' non trovato."; exit 1; }
done
[ -d "$VENV" ] || { echo "ERRORE: .venv mancante, esegui ./setup.sh"; exit 1; }
for w in RealESRGAN_x2plus.pth RealESRGAN_x4plus.pth; do
    [ -f "$ROOT/backend/weights/$w" ] || { echo "ERRORE: manca backend/weights/$w (esegui ./setup.sh)"; exit 1; }
done

mkdir -p "$BUILD"

# ── Swift ────────────────────────────────────────────────────────────────────
step "Compilazione launcher Swift"
swiftc -framework Cocoa -framework WebKit -O "$SWIFT_SRC" -o "$BUILD/PixelForge-bin"

# ── Frontend ─────────────────────────────────────────────────────────────────
step "Build frontend"
(cd "$ROOT/frontend" && npm ci --silent && npm run build --silent)

# ── Python autonomo ──────────────────────────────────────────────────────────
step "Python $PYVER autonomo (python-build-standalone via uv)"
uv python install "$PYVER" --managed-python >/dev/null
PYBIN="$(uv python find "$PYVER" --managed-python)"
PYHOME="$(cd "$(dirname "$PYBIN")/.." && pwd -P)"
echo "  $PYHOME"

# ── Bundle ───────────────────────────────────────────────────────────────────
step "Creazione bundle .app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/PixelForge-bin" "$APP/Contents/MacOS/PixelForge"
chmod +x "$APP/Contents/MacOS/PixelForge"
RES="$APP/Contents/Resources"

ditto "$PYHOME" "$RES/python"
rm -f "$RES/python/EXTERNALLY-MANAGED" "$RES/python/lib/python$PYVER/EXTERNALLY-MANAGED"

SP_SRC="$(echo "$VENV"/lib/python*/site-packages)"
SP_DST="$RES/python/lib/python$PYVER/site-packages"
ditto "$SP_SRC" "$SP_DST"

step "Pulizia file inutili"
find "$RES/python" -name "__pycache__" -type d -prune -exec rm -rf {} +
rm -rf "$SP_DST"/{pytest,_pytest,httpx,pluggy,iniconfig}* \
       "$RES/python/lib/python$PYVER/test" "$RES/python/lib/python$PYVER/idlelib" \
       "$RES/python/lib/python$PYVER/tkinter" "$RES/python/share"

mkdir -p "$RES/backend"
rsync -a --exclude '__pycache__' --exclude 'tests' --exclude '.pytest_cache' \
    --exclude 'pytest.ini' --exclude 'static' "$ROOT/backend/" "$RES/backend/"
ditto "$ROOT/frontend/dist" "$RES/backend/static"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>PixelForge</string>
    <key>CFBundleIdentifier</key><string>com.pixelforge.app</string>
    <key>CFBundleName</key><string>PixelForge</string>
    <key>CFBundleDisplayName</key><string>PixelForge</string>
    <key>CFBundleVersion</key><string>1.0</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>13.0</string>
    <key>LSArchitecturePriority</key><array><string>arm64</string></array>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSAppTransportSecurity</key>
    <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

ICNS="$ROOT/mac-app/AppIcon.icns"
if [ -f "$ICNS" ]; then
    cp "$ICNS" "$RES/AppIcon.icns"
    /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$APP/Contents/Info.plist"
fi

# ── Firma ad-hoc (obbligatoria per eseguire codice arm64 modificato) ─────────
step "Firma ad-hoc"
codesign --force --deep --sign - "$APP" 2>&1 | tail -2

echo "  dimensione: $(du -sh "$APP" | cut -f1)"

# ── DMG ──────────────────────────────────────────────────────────────────────
if [ "$MAKE_DMG" = 1 ]; then
    step "Creazione PixelForge.dmg"
    STAGE="$BUILD/dmg"
    rm -rf "$STAGE" "$ROOT/PixelForge.dmg"
    mkdir -p "$STAGE"
    ditto "$APP" "$STAGE/PixelForge.app"
    ln -s /Applications "$STAGE/Applications"
    hdiutil create -volname "PixelForge" -srcfolder "$STAGE" -ov -format UDZO "$ROOT/PixelForge.dmg" >/dev/null
    rm -rf "$STAGE"
    echo "  $ROOT/PixelForge.dmg ($(du -sh "$ROOT/PixelForge.dmg" | cut -f1))"
fi

echo
echo "✓ Build completata: $APP"
echo "Prima apertura su un altro Mac: click destro → Apri → Apri (una sola volta)."
