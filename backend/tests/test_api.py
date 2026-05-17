import io, pytest, asyncio
from PIL import Image
from httpx import AsyncClient, ASGITransport
from main import app

def _jpeg_bytes(w=50, h=50) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=(100, 150, 200)).save(buf, format="JPEG")
    return buf.getvalue()

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_process_returns_job_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/process", data={
            "session_id": "test-session",
            "mode": "compress",
            "quality": "80",
            "output_format": "webp",
            "keep_exif": "false",
        }, files={"file": ("test.jpg", _jpeg_bytes(), "image/jpeg")})
    assert r.status_code == 200
    assert "job_id" in r.json()

@pytest.mark.asyncio
async def test_result_endpoint_after_process():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/process", data={
            "session_id": "test-session-2",
            "mode": "compress",
            "quality": "80",
            "output_format": "webp",
            "keep_exif": "false",
        }, files={"file": ("test.jpg", _jpeg_bytes(), "image/jpeg")})
        job_id = r.json()["job_id"]
        await asyncio.sleep(3)
        r2 = await c.get(f"/result/{job_id}")
    assert r2.status_code == 200
    assert r2.headers["content-type"].startswith("image/")
