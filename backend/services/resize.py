import io
from PIL import Image


def resize_image(data: bytes, width: int, height: int, output_format: str) -> bytes:
    """output_format è già risolto dal chiamante (es. 'jpeg', 'png', 'webp')."""
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "P", "LA") and output_format == "jpeg":
        img = img.convert("RGB")
    resized = img.resize((width, height), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format=output_format.upper())
    return buf.getvalue()
