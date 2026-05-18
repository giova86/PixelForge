import io
import pytest
from PIL import Image
from services.resize import resize_image


def _make_jpeg(w=200, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=(100, 150, 200)).save(buf, format="JPEG")
    return buf.getvalue()


def test_resize_changes_dimensions():
    data = _make_jpeg(200, 100)
    result = resize_image(data, 50, 30, "jpeg")
    img = Image.open(io.BytesIO(result))
    assert img.size == (50, 30)


def test_resize_preserves_png_format():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="PNG")
    result = resize_image(buf.getvalue(), 40, 40, "png")
    img = Image.open(io.BytesIO(result))
    assert img.format == "PNG"


def test_resize_rgba_to_jpeg_converts_to_rgb():
    buf = io.BytesIO()
    Image.new("RGBA", (100, 100)).save(buf, format="PNG")
    result = resize_image(buf.getvalue(), 50, 50, "jpeg")
    img = Image.open(io.BytesIO(result))
    assert img.format == "JPEG"
    assert img.mode == "RGB"
