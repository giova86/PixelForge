import io
from PIL import Image
from services.enhance import enhance_image, get_model_name

def _make_rgb(w=64, h=64) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=(60, 120, 180)).save(buf, format="PNG")
    return buf.getvalue()

def test_enhance_doubles_resolution():
    data = _make_rgb(64, 64)
    result = enhance_image(data, scale=2, output_format="png")
    img = Image.open(io.BytesIO(result))
    assert img.size == (128, 128)

def test_enhance_quadruples_resolution():
    data = _make_rgb(64, 64)
    result = enhance_image(data, scale=4, output_format="png")
    img = Image.open(io.BytesIO(result))
    assert img.size == (256, 256)

def test_get_model_name():
    assert get_model_name(4) == "RealESRGAN_x4plus"
    assert get_model_name(2) == "RealESRGAN_x2plus"
