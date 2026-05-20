#!/usr/bin/env bash
# Compila PixelForge.swift e crea PixelForge.app nella root del progetto.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/PixelForge.app"
SWIFT_SRC="$ROOT/mac-app/PixelForge.swift"

echo "▸ Verifica toolchain Swift..."
if ! command -v swiftc &>/dev/null; then
    echo "ERRORE: swiftc non trovato."
    echo "Installa Xcode Command Line Tools con: xcode-select --install"
    exit 1
fi
swiftc --version | head -1

echo "▸ Compilazione..."
swiftc \
    -framework Cocoa \
    -framework WebKit \
    -O \
    "$SWIFT_SRC" \
    -o /tmp/PixelForge-bin

echo "▸ Creazione bundle .app..."
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

cp /tmp/PixelForge-bin "$APP/Contents/MacOS/PixelForge"
chmod +x "$APP/Contents/MacOS/PixelForge"

echo "▸ Scrittura Info.plist..."
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PixelForge</string>
    <key>CFBundleIdentifier</key>
    <string>com.pixelforge.app</string>
    <key>CFBundleName</key>
    <string>PixelForge</string>
    <key>CFBundleDisplayName</key>
    <string>PixelForge</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
    <key>PixelForgeProjectRoot</key>
    <string>$ROOT</string>
</dict>
</plist>
PLIST

# Icona opzionale: se esiste un file icns nella cartella mac-app, lo copia
ICNS="$ROOT/mac-app/AppIcon.icns"
if [ -f "$ICNS" ]; then
    cp "$ICNS" "$APP/Contents/Resources/AppIcon.icns"
    # Aggiungi riferimento icona al plist
    /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$APP/Contents/Info.plist" 2>/dev/null || true
fi

echo ""
echo "✓ Build completata: $APP"
echo ""
echo "Prima apertura: click destro → Apri → Apri (necessario una sola volta per Gatekeeper)"
echo "Aperture successive: doppio click normale"
