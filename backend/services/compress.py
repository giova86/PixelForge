import io
import os
import struct
import subprocess
import tempfile
from functools import lru_cache
from PIL import Image

_MIME_MAP = {"jpeg": "image/jpeg", "webp": "image/webp", "png": "image/png"}
_EXT_MAP = {"jpeg": ".jpg", "webp": ".webp", "png": ".png"}

_CJPEG_CANDIDATES = [
    "/opt/homebrew/opt/mozjpeg/bin/cjpeg",
    "/usr/local/opt/mozjpeg/bin/cjpeg",
    "/usr/bin/cjpeg",
    "cjpeg",
]
_PNGQUANT_CANDIDATES = [
    "/opt/homebrew/bin/pngquant",
    "/usr/local/bin/pngquant",
    "/usr/bin/pngquant",
    "pngquant",
]


@lru_cache(maxsize=1)
def _find_cjpeg() -> str | None:
    for path in _CJPEG_CANDIDATES:
        try:
            r = subprocess.run([path, "-version"], capture_output=True, timeout=3)
            if r.returncode == 0:
                return path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


@lru_cache(maxsize=1)
def _find_pngquant() -> str | None:
    for path in _PNGQUANT_CANDIDATES:
        try:
            r = subprocess.run([path, "--version"], capture_output=True, timeout=3)
            if r.returncode == 0:
                return path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


def _inject_exif(jpeg: bytes, exif: bytes) -> bytes:
    if not exif:
        return jpeg
    length = struct.pack(">H", len(exif) + 2)
    app1 = b"\xff\xe1" + length + exif
    return jpeg[:2] + app1 + jpeg[2:]


def _encode_jpeg_mozjpeg(img: Image.Image, quality: int, exif: bytes) -> bytes | None:
    cjpeg = _find_cjpeg()
    if cjpeg is None:
        return None
    ppm = io.BytesIO()
    img.convert("RGB").save(ppm, format="PPM")
    try:
        result = subprocess.run(
            [cjpeg, "-quality", str(quality), "-progressive", "-sample", "2x2"],
            input=ppm.getvalue(), capture_output=True, check=True, timeout=60,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    jpeg = result.stdout
    if exif:
        jpeg = _inject_exif(jpeg, exif)
    return jpeg


def _compress_png_pngquant(img: Image.Image, quality: int) -> bytes | None:
    pngquant = _find_pngquant()
    if pngquant is None:
        return None

    # Write input PNG to temp file
    tmp_in = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    try:
        img.save(tmp_in, format="PNG")
        tmp_in.close()

        # pngquant names the output <name>-fs8.png by default
        tmp_out = tmp_in.name.replace(".png", "-fs8.png")

        # Map quality slider (1-100) to pngquant min-max range
        min_q = max(0, quality - 20)
        max_q = quality

        r = subprocess.run(
            [pngquant, f"--quality={min_q}-{max_q}", "--speed=1",
             "--output", tmp_out, "--force", tmp_in.name],
            capture_output=True, timeout=60,
        )
        # exit 99 means quality target unreachable (image already optimal)
        if r.returncode not in (0, 99):
            return None
        if not os.path.exists(tmp_out):
            return None
        with open(tmp_out, "rb") as f:
            return f.read()
    except (subprocess.TimeoutExpired, OSError):
        return None
    finally:
        os.unlink(tmp_in.name)
        if os.path.exists(tmp_out := tmp_in.name.replace(".png", "-fs8.png")):
            os.unlink(tmp_out)


def compress_image(data: bytes, quality: int, output_format: str, keep_exif: bool) -> bytes:
    img = Image.open(io.BytesIO(data))
    exif = img.info.get("exif", b"") if keep_exif else b""

    if output_format == "jpeg":
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        encoded = _encode_jpeg_mozjpeg(img, quality, exif)
        if encoded is not None:
            return encoded
        buf = io.BytesIO()
        save_kwargs: dict = {"format": "JPEG", "quality": quality,
                             "optimize": True, "subsampling": 2, "progressive": True}
        if exif:
            save_kwargs["exif"] = exif
        img.save(buf, **save_kwargs)
        return buf.getvalue()

    if output_format == "webp":
        buf = io.BytesIO()
        save_kwargs = {"format": "WEBP", "quality": quality, "method": 6}
        if exif:
            save_kwargs["exif"] = exif
        img.save(buf, **save_kwargs)
        return buf.getvalue()

    if output_format == "png":
        # pngquant (lossy palette quantization) — dramatically better for flat-color images
        quantized = _compress_png_pngquant(img, quality)
        if quantized is not None and len(quantized) < len(data):
            return quantized
        # Fallback: lossless PIL compression
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True, compress_level=9)
        result = buf.getvalue()
        return result if len(result) < len(data) else data

    raise ValueError(f"Unsupported format: {output_format}")


def mime_type(output_format: str) -> str:
    return _MIME_MAP[output_format]


def extension(output_format: str) -> str:
    return _EXT_MAP[output_format]
