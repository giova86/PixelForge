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


def test_bundled_encoders_available():
    # Fails loudly if the self-contained encoders are missing,
    # instead of silently degrading to weaker compression.
    from services.compress import find_pngquant
    assert find_pngquant() is not None


def test_png_flat_colors_uses_pngquant():
    # Flat-colour gradient-free image: palette quantisation must beat lossless
    img = Image.new("RGB", (400, 400))
    for x in range(400):
        for y in range(400):
            img.putpixel((x, y), ((x // 40) * 25, (y // 40) * 25, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    original = buf.getvalue()
    result = compress_image(original, quality=75, output_format="png", keep_exif=False)
    assert len(result) < len(original)
    assert Image.open(io.BytesIO(result)).format == "PNG"


def test_jpeg_keeps_exif():
    img = Image.new("RGB", (64, 64), (10, 200, 30))
    exif = Image.Exif()
    exif[0x010F] = "PixelForgeTest"  # Make tag
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    result = compress_image(buf.getvalue(), quality=70, output_format="jpeg", keep_exif=True)
    assert Image.open(io.BytesIO(result)).getexif().get(0x010F) == "PixelForgeTest"
