#!/usr/bin/env python3
"""Genera AppIcon.icns (scintilla di pixel) con Pillow + iconutil."""
import subprocess, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024
here = Path(__file__).parent

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

VIOLET, CYAN = (239, 68, 68), (245, 158, 11)  # rosso #ef4444 -> ambra #f59e0b (brand app)
m, R = 100, 185

# sfondo: navy profondo con aloni viola (basso-sx) e azzurro (alto-dx)
bg = Image.new("RGB", (S, S))
px = bg.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        base = lerp((31, 41, 55), (13, 17, 23), t)
        dv = ((x - 150) ** 2 + (y - 900) ** 2) ** .5 / 700
        dc = ((x - 880) ** 2 + (y - 140) ** 2) ** .5 / 700
        a, b = max(0, 1 - dv) ** 2 * .32, max(0, 1 - dc) ** 2 * .30
        c = lerp(base, VIOLET, a)
        px[x, y] = lerp(c, CYAN, b)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m, S - m], radius=R, fill=255)
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
icon.paste(bg, mask=mask)

# glifo: rombo (scintilla) fatto di pixel che si dissolvono verso gli angoli
n, gap = 7, 16
span = 720
cell = (span - gap * (n - 1)) / n
x0 = (S - span) / 2
c0 = (n - 1) / 2
glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glyph)
for r in range(n):
    for c in range(n):
        dist = abs(c - c0) + abs(r - c0)
        if dist > c0: continue
        t = ((c - c0) - (r - c0)) / (2 * c0) * .5 + .5   # viola basso-sx -> azzurro alto-dx
        col = lerp(VIOLET, CYAN, min(1, max(0, t)))
        k = dist / c0                                   # 0 centro, 1 bordo
        sh = (cell * .5 * (k ** 1.8)) * .8              # le celle esterne si rimpiccioliscono
        x, y = x0 + c * (cell + gap) + sh, x0 + r * (cell + gap) + sh
        w = cell - 2 * sh
        if w < 14: continue
        col = lerp(col, (255, 236, 190), max(0, .35 - k) * .9)  # nucleo luminoso
        gd.rounded_rectangle([x, y, x + w, y + w], radius=max(4, w * .24), fill=col + (255,))

glow = glyph.filter(ImageFilter.GaussianBlur(46))
glow.putalpha(glow.getchannel("A").point(lambda v: int(v * 1.0)))
icon.alpha_composite(glow)
icon.alpha_composite(glyph)

# lucido superiore e bordo sottile
gl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gpx = gl.load()
for y in range(m, S // 2):
    a = int(34 * (1 - (y - m) / (S / 2 - m)) ** 1.6)
    for x in range(m, S - m): gpx[x, y] = (255, 255, 255, a)
gl.putalpha(ImageChops.multiply(gl.getchannel("A"), mask))
icon.alpha_composite(gl)
edge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(edge).rounded_rectangle([m, m, S - m, S - m], radius=R, outline=(255, 255, 255, 38), width=3)
icon.alpha_composite(edge)

iconset = here / "build" / "AppIcon.iconset"
shutil.rmtree(iconset, ignore_errors=True)
iconset.mkdir(parents=True)
for s in (16, 32, 128, 256, 512):
    icon.resize((s, s), Image.LANCZOS).save(iconset / f"icon_{s}x{s}.png")
    icon.resize((s * 2, s * 2), Image.LANCZOS).save(iconset / f"icon_{s}x{s}@2x.png")
subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(here / "AppIcon.icns")], check=True)
icon.resize((512, 512), Image.LANCZOS).save(here / "build" / "icon-preview.png")
print("ok", here / "AppIcon.icns")
