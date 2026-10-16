#!/usr/bin/env python3
"""Genera AppIcon.icns (griglia di pixel che si affina) con Pillow + iconutil."""
import subprocess, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw

S = 1024
here = Path(__file__).parent

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# sfondo: gradiente scuro in un rettangolo arrotondato (margini standard macOS)
bg = Image.new("RGB", (S, S))
px = bg.load()
for y in range(S):
    for x in range(S):
        px[x, y] = lerp((24, 20, 52), (8, 10, 22), (x + y) / (2 * S))
m = 100
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m, S - m], radius=185, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(bg, mask=mask)

# griglia 4x4 di "pixel": i colori passano da viola (basso-sx) ad azzurro (alto-dx)
d = ImageDraw.Draw(icon)
n, gap = 4, 26
area = S - 2 * m - 2 * 110
cell = (area - gap * (n - 1)) / n
x0 = m + 110
for r in range(n):
    for c in range(n):
        t = (c + (n - 1 - r)) / (2 * (n - 1))
        col = lerp((134, 59, 255), (71, 191, 255), t)
        x, y = x0 + c * (cell + gap), x0 + r * (cell + gap)
        # in alto a destra le celle si fanno più piccole = più "nitide"
        shrink = (1 - t) * 0 + (c + (n - 1 - r) < 2) * 0
        rad = 22 if t > 0.5 else 8
        d.rounded_rectangle([x, y, x + cell, y + cell], radius=rad, fill=col)

iconset = here / "build" / "AppIcon.iconset"
shutil.rmtree(iconset, ignore_errors=True)
iconset.mkdir(parents=True)
for s in (16, 32, 128, 256, 512):
    icon.resize((s, s), Image.LANCZOS).save(iconset / f"icon_{s}x{s}.png")
    icon.resize((s * 2, s * 2), Image.LANCZOS).save(iconset / f"icon_{s}x{s}@2x.png")
subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(here / "AppIcon.icns")], check=True)
icon.resize((512, 512), Image.LANCZOS).save(here / "build" / "icon-preview.png")
print("ok", here / "AppIcon.icns")
