import io
import logging
import subprocess
import sys
import sysconfig
from functools import lru_cache
from pathlib import Path

import mozjpeg_lossless_optimization as mozjpeg
from PIL import Image

logger = logging.getLogger(__name__)

_MIME_MAP = {"jpeg": "image/jpeg", "webp": "image/webp", "png": "image/png"}
_EXT_MAP = {"jpeg": ".jpg", "webp": ".webp", "png": ".png"}


@lru_cache(maxsize=1)
def find_pngquant() -> Path | None:
    """Locate the pngquant binary shipped by the ``pngquant-cli`` wheel.

    The wheel installs the executable next to the interpreter's scripts, so
    only the Python environment is searched: nothing installed system-wide
    (Homebrew, apt, ...) is ever used, keeping results identical everywhere.
    """
    exe = "pngquant.exe" if sys.platform == "win32" else "pngquant"
    # Scripts dir of the active environment + dir of the interpreter (venv/bin)
    for directory in (sysconfig.get_path("scripts"), Path(sys.executable).parent):
        candidate = Path(directory) / exe
        if candidate.is_file():
            return candidate
    # No wheel exists for some platforms (e.g. Linux aarch64): surface it once
    logger.warning(
        "pngquant not found in the Python environment: PNG falls back to lossless compression"
    )
    return None


def _encode_jpeg(img: Image.Image, quality: int, exif: bytes) -> bytes:
    # Step 1: lossy encode with Pillow's bundled libjpeg-turbo (4:2:0 subsampling)
    buf = io.BytesIO()
    save_kwargs: dict = {"format": "JPEG", "quality": quality, "subsampling": 2}
    if exif:
        save_kwargs["exif"] = exif
    img.save(buf, **save_kwargs)
    jpeg = buf.getvalue()
    # Step 2: lossless repack with the bundled mozjpeg (progressive scans,
    # optimised Huffman tables). Markers (EXIF) written above are preserved.
    try:
        return mozjpeg.optimize(jpeg, copy=mozjpeg.COPY_MARKERS.ALL)
    except ValueError:
        # mozjpeg rejected the stream: the plain Pillow encode is still valid
        return jpeg


def _compress_png_pngquant(img: Image.Image, quality: int) -> bytes | None:
    pngquant = find_pngquant()
    if pngquant is None:
        return None

    png = io.BytesIO()
    img.save(png, format="PNG")

    # Map quality slider (1-100) to pngquant min-max range
    min_q = max(0, quality - 20)
    max_q = quality

    try:
        # "-" = read the PNG from stdin and write the result to stdout
        r = subprocess.run(
            [str(pngquant), f"--quality={min_q}-{max_q}", "--speed=1", "-"],
            input=png.getvalue(),
            capture_output=True,
            timeout=60,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None
    # Non-zero exit (e.g. 99 = quality target unreachable, image already
    # optimal) or empty output: caller falls back to lossless compression
    if r.returncode != 0 or not r.stdout:
        return None
    return r.stdout


def compress_image(
    data: bytes, quality: int, output_format: str, keep_exif: bool
) -> bytes:
    img = Image.open(io.BytesIO(data))
    exif = img.info.get("exif", b"") if keep_exif else b""

    if output_format == "jpeg":
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        return _encode_jpeg(img, quality, exif)

    if output_format == "webp":
        buf = io.BytesIO()
        save_kwargs = {"format": "WEBP", "quality": quality, "method": 6}
        if exif:
            save_kwargs["exif"] = exif
        img.save(buf, **save_kwargs)
        return buf.getvalue()

    if output_format == "png":
        # pngquant (bundled, lossy palette quantization) — dramatically better for flat-color images
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
