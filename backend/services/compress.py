import io
from PIL import Image

_FORMAT_MAP = {"jpeg": "JPEG", "webp": "WEBP", "png": "PNG"}
_MIME_MAP = {"jpeg": "image/jpeg", "webp": "image/webp", "png": "image/png"}
_EXT_MAP = {"jpeg": ".jpg", "webp": ".webp", "png": ".png"}

def compress_image(data: bytes, quality: int, output_format: str, keep_exif: bool) -> bytes:
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "P") and output_format == "jpeg":
        img = img.convert("RGB")

    exif = img.info.get("exif", b"") if keep_exif else b""

    buf = io.BytesIO()
    fmt = _FORMAT_MAP[output_format]
    save_kwargs: dict = {"format": fmt}

    if fmt in ("JPEG", "WEBP"):
        save_kwargs["quality"] = quality
        save_kwargs["optimize"] = True
        if exif:
            save_kwargs["exif"] = exif
    elif fmt == "PNG":
        save_kwargs["optimize"] = True

    img.save(buf, **save_kwargs)
    return buf.getvalue()

def mime_type(output_format: str) -> str:
    return _MIME_MAP[output_format]

def extension(output_format: str) -> str:
    return _EXT_MAP[output_format]
