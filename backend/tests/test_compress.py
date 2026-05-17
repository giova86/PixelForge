import io, pytest
from PIL import Image
from services.compress import compress_image, mime_type, extension

def _make_jpeg(w=100, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=(120, 80, 40)).save(buf, format="JPEG")
    return buf.getvalue()

def test_compress_jpeg_reduces_size():
    original = _make_jpeg(500, 500)
    result = compress_image(original, quality=60, output_format="jpeg", keep_exif=False)
    assert len(result) < len(original)

def test_compress_to_webp():
    original = _make_jpeg()
    result = compress_image(original, quality=80, output_format="webp", keep_exif=False)
    img = Image.open(io.BytesIO(result))
    assert img.format == "WEBP"

def test_compress_to_png():
    original = _make_jpeg()
    result = compress_image(original, quality=85, output_format="png", keep_exif=False)
    img = Image.open(io.BytesIO(result))
    assert img.format == "PNG"
