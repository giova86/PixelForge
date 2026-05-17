# PixelForge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PixelForge — a two-panel web app for image compression (Pillow) and AI upscaling (Real-ESRGAN) with real-time SSE progress feedback.

**Architecture:** React+Vite+TypeScript frontend on port 5173, FastAPI backend on port 8000. Frontend sends files via POST /process, opens EventSource for SSE progress, fetches result image from GET /result/{job_id}. Backend runs Pillow for compress and Real-ESRGAN for enhance in async background tasks.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, FastAPI, Python 3.11, Pillow, realesrgan (PyPI), PyTorch, python-multipart, aiofiles

---

## File Map

### Backend
- `backend/requirements.txt` — all Python deps
- `backend/main.py` — FastAPI app, CORS, router registration
- `backend/models/schemas.py` — Pydantic request/response models
- `backend/services/compress.py` — Pillow compression logic
- `backend/services/enhance.py` — Real-ESRGAN wrapper
- `backend/routers/process.py` — POST /process, GET /stream/{job_id}, GET /result/{job_id}, GET /health
- `backend/routers/download.py` — GET /download/{session_id}
- `backend/tests/test_compress.py` — unit tests for compress service
- `backend/tests/test_enhance.py` — unit tests for enhance service
- `backend/tests/test_api.py` — integration tests for API endpoints

### Frontend
- `frontend/package.json` — deps
- `frontend/vite.config.ts` — proxy /api → localhost:8000
- `frontend/tailwind.config.ts` — dark warm theme tokens
- `frontend/src/types/index.ts` — shared TypeScript types
- `frontend/src/hooks/useFileQueue.ts` — file queue state management
- `frontend/src/hooks/useProcessing.ts` — SSE logic
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/DropZone.tsx`
- `frontend/src/components/FileItem.tsx`
- `frontend/src/components/FileList.tsx`
- `frontend/src/components/SettingsBox.tsx`
- `frontend/src/components/UploadPanel.tsx`
- `frontend/src/components/CompressResult.tsx`
- `frontend/src/components/EnhanceResult.tsx`
- `frontend/src/components/ResultTabs.tsx`
- `frontend/src/components/ResultPanel.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/index.html`

---

## Task 1: Backend project scaffold + requirements

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/models/__init__.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
aiofiles==23.2.1
Pillow==10.3.0
pillow-heif==0.16.0
torch==2.3.0
torchvision==0.18.0
basicsr==1.4.2
realesrgan==0.3.0
pytest==8.2.0
httpx==0.27.0
pytest-asyncio==0.23.6
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p backend/models backend/routers backend/services backend/tests
touch backend/models/__init__.py backend/routers/__init__.py backend/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 3: Create backend/main.py**

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import process, download

app = FastAPI(title="PixelForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process.router)
app.include_router(download.router)

os.makedirs("/tmp/pixelforge/jobs", exist_ok=True)
```

- [ ] **Step 4: Install dependencies**

```bash
cd backend && pip install -r requirements.txt
```

- [ ] **Step 5: Verify FastAPI starts**

```bash
cd backend && uvicorn main:app --port 8000
```
Expected: `Application startup complete.`

- [ ] **Step 6: Commit**

```bash
git init
git add backend/
git commit -m "feat: backend scaffold and requirements"
```

---

## Task 2: Backend Pydantic schemas

**Files:**
- Create: `backend/models/schemas.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_schemas.py
from models.schemas import ProcessRequest, JobStarted, ProgressEvent, DoneEvent, ErrorEvent, HealthResponse

def test_process_request_defaults():
    r = ProcessRequest(mode="compress")
    assert r.quality == 85
    assert r.scale == 4
    assert r.output_format == "webp"
    assert r.keep_exif is True

def test_done_event_has_output_url():
    e = DoneEvent(output_url="/result/abc", original_size=1000, compressed_size=500,
                  saving_percent=50.0, mode="compress")
    assert e.output_url == "/result/abc"
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && python -m pytest tests/test_schemas.py -v
```
Expected: `ModuleNotFoundError: No module named 'models.schemas'`

- [ ] **Step 3: Create backend/models/schemas.py**

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

class ProcessRequest(BaseModel):
    session_id: str
    mode: Literal["compress", "enhance"]
    quality: int = Field(85, ge=1, le=100)
    scale: Literal[2, 4] = 4
    output_format: Literal["webp", "jpeg", "png"] = "webp"
    keep_exif: bool = True

class JobStarted(BaseModel):
    job_id: str

class ProgressEvent(BaseModel):
    step: str
    percent: int

class DoneEvent(BaseModel):
    output_url: str
    mode: Literal["compress", "enhance"]
    original_size: Optional[int] = None
    compressed_size: Optional[int] = None
    saving_percent: Optional[float] = None
    scale: Optional[int] = None
    model: Optional[str] = None

class ErrorEvent(BaseModel):
    message: str

class HealthResponse(BaseModel):
    status: str
    gpu: bool
    model: str
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && python -m pytest tests/test_schemas.py -v
```
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/models/schemas.py backend/tests/test_schemas.py
git commit -m "feat: backend Pydantic schemas"
```

---

## Task 3: Compress service

**Files:**
- Create: `backend/services/compress.py`
- Create: `backend/tests/test_compress.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_compress.py
import io, pytest
from PIL import Image
from services.compress import compress_image

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
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && python -m pytest tests/test_compress.py -v
```
Expected: `ImportError: cannot import name 'compress_image'`

- [ ] **Step 3: Create backend/services/compress.py**

```python
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && python -m pytest tests/test_compress.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/services/compress.py backend/tests/test_compress.py
git commit -m "feat: image compression service with Pillow"
```

---

## Task 4: Enhance service (Real-ESRGAN wrapper)

**Files:**
- Create: `backend/services/enhance.py`
- Create: `backend/tests/test_enhance.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_enhance.py
import io, pytest
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
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && python -m pytest tests/test_enhance.py -v
```
Expected: `ImportError: cannot import name 'enhance_image'`

- [ ] **Step 3: Create backend/services/enhance.py**

```python
import io
import numpy as np
import torch
from PIL import Image
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

_MODEL_NAMES = {2: "RealESRGAN_x2plus", 4: "RealESRGAN_x4plus"}
_NETSCALE = {2: 2, 4: 4}
_NUM_BLOCK = {2: 23, 4: 23}
_MODEL_PATHS = {
    2: "weights/RealESRGAN_x2plus.pth",
    4: "weights/RealESRGAN_x4plus.pth",
}

_upsampler_cache: dict = {}

def _get_upsampler(scale: int) -> RealESRGANer:
    if scale not in _upsampler_cache:
        model = RRDBNet(
            num_in_ch=3, num_out_ch=3,
            num_feat=64, num_block=_NUM_BLOCK[scale],
            num_grow_ch=32, scale=_NETSCALE[scale],
        )
        gpu_id = 0 if torch.cuda.is_available() else None
        _upsampler_cache[scale] = RealESRGANer(
            scale=_NETSCALE[scale],
            model_path=_MODEL_PATHS[scale],
            model=model,
            tile=400,
            tile_pad=10,
            pre_pad=0,
            half=torch.cuda.is_available(),
            gpu_id=gpu_id,
        )
    return _upsampler_cache[scale]

def get_model_name(scale: int) -> str:
    return _MODEL_NAMES[scale]

def enhance_image(data: bytes, scale: int, output_format: str) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_np = np.array(img, dtype=np.uint8)
    upsampler = _get_upsampler(scale)
    output_np, _ = upsampler.enhance(img_np, outscale=scale)
    result_img = Image.fromarray(output_np)
    buf = io.BytesIO()
    fmt_map = {"webp": "WEBP", "jpeg": "JPEG", "png": "PNG"}
    result_img.save(buf, format=fmt_map[output_format], quality=95)
    return buf.getvalue()
```

- [ ] **Step 4: Download Real-ESRGAN model weights**

```bash
mkdir -p backend/weights
cd backend/weights
curl -L -o RealESRGAN_x4plus.pth \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
curl -L -o RealESRGAN_x2plus.pth \
  "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/test_enhance.py -v
```
Expected: `3 passed` (note: first run downloads/initializes model, may take 30-60s)

- [ ] **Step 6: Add weights to .gitignore**

```bash
echo "backend/weights/*.pth" >> .gitignore
git add .gitignore backend/services/enhance.py backend/tests/test_enhance.py
git commit -m "feat: Real-ESRGAN enhance service"
```

---

## Task 5: Process router (POST /process, GET /stream, GET /result, GET /health)

**Files:**
- Create: `backend/routers/process.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

```python
# backend/tests/test_api.py
import io, pytest
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
        import asyncio; await asyncio.sleep(2)
        r2 = await c.get(f"/result/{job_id}")
    assert r2.status_code == 200
    assert r2.headers["content-type"].startswith("image/")
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && python -m pytest tests/test_api.py::test_health -v
```
Expected: `ImportError` or 404

- [ ] **Step 3: Create backend/routers/process.py**

```python
import asyncio, json, os, uuid
from pathlib import Path

import aiofiles
import torch
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from models.schemas import DoneEvent, ErrorEvent, HealthResponse, JobStarted, ProgressEvent
from services.compress import compress_image, extension, mime_type
from services.enhance import enhance_image, get_model_name

router = APIRouter()

JOBS_DIR = Path("/tmp/pixelforge/jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory job store: job_id -> {"status": "pending"|"done"|"error", "output": Path, "meta": dict}
_jobs: dict = {}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _run_compress(job_id: str, input_path: Path, quality: int,
                         output_format: str, keep_exif: bool, session_id: str) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _jobs[job_id] = {"status": "processing", "output": None, "meta": {}, "session_id": session_id}
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        original_size = len(data)
        result = await asyncio.get_event_loop().run_in_executor(
            None, compress_image, data, quality, output_format, keep_exif
        )
        compressed_size = len(result)
        saving_percent = round((1 - compressed_size / original_size) * 100, 1)

        out_path = job_dir / f"output{extension(output_format)}"
        async with aiofiles.open(out_path, "wb") as f:
            await f.write(result)

        _jobs[job_id] = {
            "status": "done",
            "output": out_path,
            "mime": mime_type(output_format),
            "session_id": session_id,
            "meta": {
                "mode": "compress",
                "original_size": original_size,
                "compressed_size": compressed_size,
                "saving_percent": saving_percent,
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id}


async def _run_enhance(job_id: str, input_path: Path, scale: int,
                        output_format: str, session_id: str) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _jobs[job_id] = {"status": "processing", "output": None, "meta": {}, "session_id": session_id}
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        result = await asyncio.get_event_loop().run_in_executor(
            None, enhance_image, data, scale, output_format
        )

        out_path = job_dir / f"output{extension(output_format)}"
        async with aiofiles.open(out_path, "wb") as f:
            await f.write(result)

        _jobs[job_id] = {
            "status": "done",
            "output": out_path,
            "mime": mime_type(output_format),
            "session_id": session_id,
            "meta": {
                "mode": "enhance",
                "scale": scale,
                "model": get_model_name(scale),
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id}


@router.post("/process", response_model=JobStarted)
async def start_process(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    mode: str = Form(...),
    quality: int = Form(85),
    scale: int = Form(4),
    output_format: str = Form("webp"),
    keep_exif: bool = Form(True),
):
    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    input_path = job_dir / f"input{suffix}"
    contents = await file.read()
    async with aiofiles.open(input_path, "wb") as f:
        await f.write(contents)

    _jobs[job_id] = {"status": "pending", "session_id": session_id}

    if mode == "compress":
        asyncio.create_task(_run_compress(job_id, input_path, quality, output_format, keep_exif, session_id))
    else:
        asyncio.create_task(_run_enhance(job_id, input_path, scale, output_format, session_id))

    return JobStarted(job_id=job_id)


@router.get("/stream/{job_id}")
async def stream_job(job_id: str):
    async def event_generator():
        yield _sse("progress", {"step": "queued", "percent": 5})
        for _ in range(120):
            await asyncio.sleep(1)
            job = _jobs.get(job_id)
            if job is None:
                yield _sse("error", {"message": "job not found"})
                return
            if job["status"] == "processing":
                yield _sse("progress", {"step": "processing", "percent": 50})
            elif job["status"] == "done":
                meta = job["meta"]
                yield _sse("done", {**meta, "output_url": f"/result/{job_id}"})
                return
            elif job["status"] == "error":
                yield _sse("error", {"message": job.get("message", "unknown error")})
                return
        yield _sse("error", {"message": "timeout"})

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/result/{job_id}")
async def get_result(job_id: str):
    job = _jobs.get(job_id)
    if not job or job["status"] != "done":
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Result not ready")
    return FileResponse(job["output"], media_type=job["mime"])


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        gpu=torch.cuda.is_available(),
        model="RealESRGAN_x4plus",
    )
```

- [ ] **Step 4: Run API tests**

```bash
cd backend && python -m pytest tests/test_api.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/routers/process.py backend/tests/test_api.py
git commit -m "feat: process router with SSE streaming"
```

---

## Task 6: Download router (GET /download/{session_id})

**Files:**
- Create: `backend/routers/download.py`

- [ ] **Step 1: Create backend/routers/download.py**

```python
import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter()

JOBS_DIR = Path("/tmp/pixelforge/jobs")

# Import job store from process router
from routers.process import _jobs


@router.get("/download/{session_id}")
async def download_zip(session_id: str):
    session_jobs = [
        (job_id, job) for job_id, job in _jobs.items()
        if job.get("session_id") == session_id and job.get("status") == "done"
    ]
    if not session_jobs:
        raise HTTPException(status_code=404, detail="No completed jobs for this session")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for job_id, job in session_jobs:
            output_path: Path = job["output"]
            if output_path and output_path.exists():
                zf.write(output_path, arcname=output_path.name)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=pixelforge_{session_id[:8]}.zip"},
    )
```

- [ ] **Step 2: Test download endpoint manually**

```bash
cd backend && uvicorn main:app --port 8000 --reload
# In another terminal:
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok","gpu":false,"model":"RealESRGAN_x4plus"}`

- [ ] **Step 3: Commit**

```bash
git add backend/routers/download.py
git commit -m "feat: batch ZIP download endpoint"
```

---

## Task 7: Frontend scaffold (Vite + React + TypeScript + Tailwind)

**Files:**
- Create: `frontend/` (via Vite CLI)
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd /Users/gbocchi/Desktop/compress_quality
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install Tailwind CSS v4**

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/process': 'http://localhost:8000',
      '/stream': 'http://localhost:8000',
      '/result': 'http://localhost:8000',
      '/download': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 4: Configure frontend/src/index.css**

```css
@import "tailwindcss";

@theme {
  --color-bg-base: #0d1117;
  --color-bg-panel: #111827;
  --color-bg-elevated: #1f2937;
  --color-border: #374151;
  --color-border-subtle: #1f2937;
  --color-text-primary: #e5e7eb;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --color-text-faint: #4b5563;
  --color-accent-from: #f59e0b;
  --color-accent-to: #ef4444;
  --color-success: #34d399;
  --color-error: #f87171;
  --color-info: #818cf8;
}

body {
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: Inter, system-ui, sans-serif;
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev
```
Expected: `VITE ready on http://localhost:5173`

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: frontend Vite+React+TypeScript+Tailwind scaffold"
```

---

## Task 8: TypeScript types

**Files:**
- Create: `frontend/src/types/index.ts`

- [ ] **Step 1: Create frontend/src/types/index.ts**

```typescript
export type ProcessingMode = 'compress' | 'enhance'
export type OutputFormat = 'webp' | 'jpeg' | 'png'
export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ProcessingSettings {
  quality: number
  scale: 2 | 4
  outputFormat: OutputFormat
  keepExif: boolean
}

export interface JobResult {
  mode: ProcessingMode
  outputUrl: string
  // compress
  originalSize?: number
  compressedSize?: number
  savingPercent?: number
  // enhance
  scale?: number
  model?: string
}

export interface FileEntry {
  id: string
  file: File
  status: FileStatus
  jobId?: string
  result?: JobResult
  errorMessage?: string
  previewUrl: string
}

export interface SSEProgressEvent {
  step: string
  percent: number
}

export interface SSEDoneEvent {
  output_url: string
  mode: ProcessingMode
  original_size?: number
  compressed_size?: number
  saving_percent?: number
  scale?: number
  model?: string
}

export interface SSEErrorEvent {
  message: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: frontend TypeScript types"
```

---

## Task 9: useFileQueue hook

**Files:**
- Create: `frontend/src/hooks/useFileQueue.ts`

- [ ] **Step 1: Create frontend/src/hooks/useFileQueue.ts**

```typescript
import { useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { FileEntry, FileStatus, JobResult } from '../types'

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'image/tiff', 'image/bmp', 'image/heic',
]
const MAX_SIZE_BYTES = 50 * 1024 * 1024

export function useFileQueue() {
  const [files, setFiles] = useState<FileEntry[]>([])

  const addFiles = useCallback((incoming: File[]) => {
    const entries: FileEntry[] = incoming
      .filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES)
      .map(f => ({
        id: uuidv4(),
        file: f,
        status: 'pending' as FileStatus,
        previewUrl: URL.createObjectURL(f),
      }))
    setFiles(prev => [...prev, ...entries])
  }, [])

  const updateStatus = useCallback((id: string, status: FileStatus, extra?: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, ...extra } : f))
  }, [])

  const setResult = useCallback((id: string, result: JobResult) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', result } : f))
  }, [])

  const setError = useCallback((id: string, message: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: message } : f))
  }, [])

  const clearAll = useCallback(() => {
    setFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return [] })
  }, [])

  return { files, addFiles, updateStatus, setResult, setError, clearAll }
}
```

- [ ] **Step 2: Install uuid**

```bash
cd frontend && npm install uuid && npm install -D @types/uuid
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useFileQueue.ts
git commit -m "feat: useFileQueue hook"
```

---

## Task 10: useProcessing hook (SSE logic)

**Files:**
- Create: `frontend/src/hooks/useProcessing.ts`

- [ ] **Step 1: Create frontend/src/hooks/useProcessing.ts**

```typescript
import { useCallback } from 'react'
import type { FileEntry, JobResult, ProcessingSettings } from '../types'

interface ProcessingCallbacks {
  onProgress: (id: string, percent: number) => void
  onDone: (id: string, result: JobResult) => void
  onError: (id: string, message: string) => void
}

export function useProcessing(
  callbacks: React.MutableRefObject<ProcessingCallbacks>,
  sessionId: string,
) {
  const processQueue = useCallback(async (
    entries: FileEntry[],
    mode: 'compress' | 'enhance',
    settings: ProcessingSettings,
  ) => {
    for (const entry of entries.filter(e => e.status === 'pending')) {
      await new Promise<void>(async (resolve) => {
        const form = new FormData()
        form.append('file', entry.file)
        form.append('session_id', sessionId)
        form.append('mode', mode)
        form.append('quality', String(settings.quality))
        form.append('scale', String(settings.scale))
        form.append('output_format', settings.outputFormat)
        form.append('keep_exif', String(settings.keepExif))

        let jobId: string
        try {
          const res = await fetch('/process', { method: 'POST', body: form })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          jobId = json.job_id
        } catch {
          callbacks.current.onError(entry.id, 'Failed to start job')
          resolve()
          return
        }

        const es = new EventSource(`/stream/${jobId}`)

        es.addEventListener('progress', (e) => {
          const data = JSON.parse((e as MessageEvent).data)
          callbacks.current.onProgress(entry.id, data.percent)
        })

        es.addEventListener('done', (e) => {
          const data = JSON.parse((e as MessageEvent).data)
          es.close()
          const result: JobResult = {
            mode,
            outputUrl: data.output_url,
            originalSize: data.original_size,
            compressedSize: data.compressed_size,
            savingPercent: data.saving_percent,
            scale: data.scale,
            model: data.model,
          }
          callbacks.current.onDone(entry.id, result)
          resolve()
        })

        es.addEventListener('error', (e) => {
          const raw = (e as MessageEvent).data
          const data = raw ? JSON.parse(raw) : { message: 'Stream error' }
          es.close()
          callbacks.current.onError(entry.id, data.message)
          resolve()
        })
      })
    }
  }, [callbacks, sessionId])

  return { processQueue }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useProcessing.ts
git commit -m "feat: useProcessing hook with SSE"
```

---

## Task 11: Navbar component

**Files:**
- Create: `frontend/src/components/Navbar.tsx`

- [ ] **Step 1: Create frontend/src/components/Navbar.tsx**

```tsx
import type { ProcessingMode } from '../types'

interface NavbarProps {
  mode: ProcessingMode
  onModeChange: (mode: ProcessingMode) => void
  backendOnline: boolean
}

export function Navbar({ mode, onModeChange, backendOnline }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between px-6 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          ✦
        </div>
        <span className="font-bold text-base tracking-tight"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PixelForge
        </span>
      </div>

      <div className="flex bg-[#1f2937] border border-[#374151] rounded-xl p-1 gap-1">
        {(['compress', 'enhance'] as ProcessingMode[]).map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              mode === m
                ? 'text-[#111827] font-semibold'
                : 'text-[#9ca3af] hover:text-[#e5e7eb]'
            }`}
            style={mode === m ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}
          >
            {m === 'compress' ? 'Comprimi' : 'Migliora qualità'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 bg-[#1f2937] border border-[#374151] rounded-md text-[#6b7280]">
          Real-ESRGAN
        </span>
        <span className={`text-xs px-2.5 py-1 border rounded-md ${
          backendOnline
            ? 'bg-[#1f2937] border-[#065f46] text-[#34d399]'
            : 'bg-[#1f2937] border-[#7f1d1d] text-[#f87171]'
        }`}>
          {backendOnline ? '● Backend attivo' : '● Backend offline'}
        </span>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Navbar.tsx
git commit -m "feat: Navbar component"
```

---

## Task 12: DropZone + FileItem + FileList components

**Files:**
- Create: `frontend/src/components/DropZone.tsx`
- Create: `frontend/src/components/FileItem.tsx`
- Create: `frontend/src/components/FileList.tsx`

- [ ] **Step 1: Create frontend/src/components/DropZone.tsx**

```tsx
import { useRef } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
}

export function DropZone({ onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-[#374151] rounded-xl p-8 flex flex-col items-center gap-2 bg-[#111827] cursor-pointer hover:border-[#f59e0b] transition-colors"
    >
      <span className="text-3xl opacity-40">⬆</span>
      <p className="text-sm text-[#6b7280] text-center">
        Trascina le immagini qui<br />
        <span style={{ color: '#f59e0b' }}>o clicca per scegliere</span>
      </p>
      <p className="text-xs text-[#4b5563]">JPEG · PNG · WebP · TIFF · BMP · HEIC</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => onFiles(Array.from(e.target.files ?? []))}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/FileItem.tsx**

```tsx
import type { FileEntry } from '../types'

interface FileItemProps {
  entry: FileEntry
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function FileItem({ entry }: FileItemProps) {
  const statusEl = {
    pending: <span className="text-xs text-[#4b5563]">In coda</span>,
    processing: <span className="inline-block w-3.5 h-3.5 border-2 border-[#374151] border-t-[#f59e0b] rounded-full animate-spin" />,
    done: <span className="text-xs font-semibold text-[#f59e0b]">✓ Pronto</span>,
    error: <span className="text-xs text-[#f87171]">✗ Errore</span>,
  }[entry.status]

  return (
    <div className={`flex items-center gap-3 bg-[#1f2937] rounded-lg px-3 py-2.5 border ${
      entry.status === 'processing' ? 'border-[#f59e0b]/40' : 'border-[#374151]'
    }`}>
      <img src={entry.previewUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-[#e5e7eb]">{entry.file.name}</p>
        <p className="text-xs text-[#6b7280]">{formatBytes(entry.file.size)}</p>
        {entry.errorMessage && <p className="text-xs text-[#f87171] truncate">{entry.errorMessage}</p>}
      </div>
      <div className="flex-shrink-0">{statusEl}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/FileList.tsx**

```tsx
import type { FileEntry } from '../types'
import { FileItem } from './FileItem'

interface FileListProps {
  files: FileEntry[]
}

export function FileList({ files }: FileListProps) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {files.map(f => <FileItem key={f.id} entry={f} />)}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DropZone.tsx frontend/src/components/FileItem.tsx frontend/src/components/FileList.tsx
git commit -m "feat: DropZone, FileItem, FileList components"
```

---

## Task 13: SettingsBox component

**Files:**
- Create: `frontend/src/components/SettingsBox.tsx`

- [ ] **Step 1: Create frontend/src/components/SettingsBox.tsx**

```tsx
import type { ProcessingMode, ProcessingSettings } from '../types'

interface SettingsBoxProps {
  mode: ProcessingMode
  settings: ProcessingSettings
  onChange: (s: ProcessingSettings) => void
}

export function SettingsBox({ mode, settings, onChange }: SettingsBoxProps) {
  const update = (patch: Partial<ProcessingSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-3">
      {mode === 'compress' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[#9ca3af]">Qualità output</span>
          <div className="flex items-center gap-2.5">
            <input
              type="range" min={1} max={100} value={settings.quality}
              onChange={e => update({ quality: Number(e.target.value) })}
              className="w-28 accent-[#f59e0b]"
            />
            <span className="text-sm font-semibold text-[#f59e0b] w-8 text-right">{settings.quality}%</span>
          </div>
        </div>
      )}

      {mode === 'enhance' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[#9ca3af]">Scala upscaling</span>
          <div className="flex gap-1.5">
            {([2, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => update({ scale: s })}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                  settings.scale === s
                    ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                    : 'border-[#374151] bg-transparent text-[#9ca3af]'
                }`}
              >{s}×</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#9ca3af]">Formato output</span>
        <select
          value={settings.outputFormat}
          onChange={e => update({ outputFormat: e.target.value as ProcessingSettings['outputFormat'] })}
          className="bg-[#111827] border border-[#374151] rounded-md px-2 py-1 text-sm text-[#f59e0b] font-semibold"
        >
          <option value="webp">WebP</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#9ca3af]">Mantieni metadati EXIF</span>
        <button
          onClick={() => update({ keepExif: !settings.keepExif })}
          className={`w-9 h-5 rounded-full transition-all relative ${settings.keepExif ? '' : 'bg-[#374151]'}`}
          style={settings.keepExif ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.keepExif ? 'right-0.5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SettingsBox.tsx
git commit -m "feat: SettingsBox component"
```

---

## Task 14: UploadPanel component

**Files:**
- Create: `frontend/src/components/UploadPanel.tsx`

- [ ] **Step 1: Create frontend/src/components/UploadPanel.tsx**

```tsx
import type { FileEntry, ProcessingMode, ProcessingSettings } from '../types'
import { DropZone } from './DropZone'
import { FileList } from './FileList'
import { SettingsBox } from './SettingsBox'

interface UploadPanelProps {
  files: FileEntry[]
  mode: ProcessingMode
  settings: ProcessingSettings
  onFiles: (files: File[]) => void
  onSettingsChange: (s: ProcessingSettings) => void
  onProcess: () => void
  onClear: () => void
  processing: boolean
}

export function UploadPanel({ files, mode, settings, onFiles, onSettingsChange, onProcess, onClear, processing }: UploadPanelProps) {
  const hasFiles = files.length > 0
  const hasPending = files.some(f => f.status === 'pending')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">File caricati</span>
        <div className="flex gap-2">
          {hasFiles && (
            <button onClick={onClear} className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors">
              Cancella tutto
            </button>
          )}
          <button
            onClick={() => document.getElementById('file-input-trigger')?.click()}
            className="text-xs px-3 py-1 rounded-md text-[#111827] font-semibold"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            + Aggiungi
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <DropZone onFiles={onFiles} />
        <input id="file-input-trigger" type="file" multiple accept="image/*" className="hidden"
               onChange={e => onFiles(Array.from(e.target.files ?? []))} />
        <FileList files={files} />
        {hasFiles && <SettingsBox mode={mode} settings={settings} onChange={onSettingsChange} />}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
        <button
          onClick={onProcess}
          disabled={!hasPending || processing}
          className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          {processing ? 'Elaborazione in corso…' : 'Elabora'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UploadPanel.tsx
git commit -m "feat: UploadPanel component"
```

---

## Task 15: Result panel components (CompressResult, EnhanceResult, ResultTabs, ResultPanel)

**Files:**
- Create: `frontend/src/components/CompressResult.tsx`
- Create: `frontend/src/components/EnhanceResult.tsx`
- Create: `frontend/src/components/ResultTabs.tsx`
- Create: `frontend/src/components/ResultPanel.tsx`

- [ ] **Step 1: Create frontend/src/components/CompressResult.tsx**

```tsx
import type { FileEntry } from '../types'

interface CompressResultProps {
  entry: FileEntry
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function CompressResult({ entry }: CompressResultProps) {
  const { result, previewUrl } = entry
  if (!result) return null
  const { originalSize = 0, compressedSize = 0, savingPercent = 0, outputUrl } = result

  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
      <div className="relative h-52 overflow-hidden">
        <img
          src={`${outputUrl}?t=${Date.now()}`}
          alt="Compressed"
          className="w-full h-full object-contain bg-[#111827]"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">
          Anteprima compressa
        </span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#f59e0b]">{formatBytes(originalSize)}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Originale</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#34d399]">{formatBytes(compressedSize)}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Compresso</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#34d399]">−{savingPercent}%</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Riduzione</p>
          <p className="text-xs text-[#4b5563]">{formatBytes(originalSize - compressedSize)} risparmiati</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/EnhanceResult.tsx**

```tsx
import { useCallback, useRef, useState } from 'react'
import type { FileEntry } from '../types'

interface EnhanceResultProps {
  entry: FileEntry
}

export function EnhanceResult({ entry }: EnhanceResultProps) {
  const [sliderX, setSliderX] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const { result, previewUrl } = entry
  if (!result) return null

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setSliderX(pct)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) updateSlider(e.clientX)
  }, [updateSlider])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    updateSlider(e.touches[0].clientX)
  }, [updateSlider])

  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
      <div
        ref={containerRef}
        className="relative h-72 overflow-hidden select-none cursor-ew-resize"
        onMouseDown={() => { dragging.current = true }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      >
        {/* After (enhanced) — full width */}
        <img
          src={`${result.outputUrl}?t=${Date.now()}`}
          alt="Enhanced"
          className="absolute inset-0 w-full h-full object-contain bg-[#111827]"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        {/* Before (original) — clipped */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
          <img src={previewUrl} alt="Original" className="w-full h-full object-contain bg-[#0d1117]" />
        </div>
        {/* Divider */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
             style={{ left: `${sliderX}%` }} />
        {/* Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-[#374151] text-xs font-bold"
             style={{ left: `${sliderX}%` }}>
          ↔
        </div>
        <span className="absolute bottom-2 left-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">Prima</span>
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">Dopo</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#f59e0b]">Originale</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Risoluzione</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#34d399]">{result.scale}×</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Upscaled</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-base font-bold text-[#818cf8] truncate">{result.model ?? 'Real-ESRGAN'}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Modello AI</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/ResultTabs.tsx**

```tsx
import type { FileEntry } from '../types'

interface ResultTabsProps {
  files: FileEntry[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ResultTabs({ files, activeId, onSelect }: ResultTabsProps) {
  const done = files.filter(f => f.status === 'done')
  if (done.length === 0) return null

  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1f2937] rounded-lg p-1 overflow-x-auto">
      {done.map(f => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            activeId === f.id
              ? 'bg-[#1f2937] text-[#f59e0b]'
              : 'text-[#6b7280] hover:text-[#e5e7eb]'
          }`}
        >
          {f.file.name.length > 16 ? f.file.name.slice(0, 14) + '…' : f.file.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create frontend/src/components/ResultPanel.tsx**

```tsx
import { useEffect, useState } from 'react'
import type { FileEntry, ProcessingMode } from '../types'
import { CompressResult } from './CompressResult'
import { EnhanceResult } from './EnhanceResult'
import { ResultTabs } from './ResultTabs'

interface ResultPanelProps {
  files: FileEntry[]
  mode: ProcessingMode
}

export function ResultPanel({ files, mode }: ResultPanelProps) {
  const done = files.filter(f => f.status === 'done')
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (done.length > 0 && !done.find(f => f.id === activeId)) {
      setActiveId(done[done.length - 1].id)
    }
  }, [done.length])

  const activeEntry = done.find(f => f.id === activeId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Risultato</span>
        <ResultTabs files={files} activeId={activeId} onSelect={setActiveId} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!activeEntry && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#4b5563]">
            <span className="text-4xl opacity-30">✦</span>
            <p className="text-sm">Elabora un'immagine per vedere il risultato</p>
          </div>
        )}
        {activeEntry && mode === 'compress' && <CompressResult entry={activeEntry} />}
        {activeEntry && mode === 'enhance' && <EnhanceResult entry={activeEntry} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CompressResult.tsx frontend/src/components/EnhanceResult.tsx frontend/src/components/ResultTabs.tsx frontend/src/components/ResultPanel.tsx
git commit -m "feat: result panel components with before/after slider"
```

---

## Task 16: Footer component

**Files:**
- Create: `frontend/src/components/Footer.tsx`

- [ ] **Step 1: Create frontend/src/components/Footer.tsx**

```tsx
import type { FileEntry } from '../types'

interface FooterProps {
  files: FileEntry[]
  sessionId: string
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function Footer({ files, sessionId }: FooterProps) {
  const total = files.reduce((s, f) => s + f.file.size, 0)
  const done = files.filter(f => f.status === 'done').length
  const processing = files.filter(f => f.status === 'processing').length
  const pending = files.filter(f => f.status === 'pending').length

  const handleDownload = () => {
    window.open(`/download/${sessionId}`, '_blank')
  }

  return (
    <footer className="flex items-center justify-between px-6 py-2.5 bg-[#111827] border-t border-[#1f2937] flex-shrink-0">
      <div className="flex items-center gap-5 text-xs text-[#4b5563]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
          Backend FastAPI · SSE
        </span>
        {files.length > 0 && (
          <>
            <span>{files.length} file · {formatBytes(total)}</span>
            <span>{done} elaborati · {processing} in corso · {pending} in coda</span>
          </>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={done === 0}
        className="px-4 py-2 rounded-lg text-xs font-bold text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
      >
        ⬇ Scarica ZIP {done > 0 ? `(${done} file)` : ''}
      </button>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Footer.tsx
git commit -m "feat: Footer component with ZIP download"
```

---

## Task 17: App.tsx — wire everything together

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`

- [ ] **Step 1: Update frontend/index.html**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PixelForge</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update frontend/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Write frontend/src/App.tsx**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { ResultPanel } from './components/ResultPanel'
import { UploadPanel } from './components/UploadPanel'
import { useFileQueue } from './hooks/useFileQueue'
import { useProcessing } from './hooks/useProcessing'
import type { JobResult, ProcessingMode, ProcessingSettings } from './types'

// Single session ID for the lifetime of the page — shared with backend for ZIP grouping
const SESSION_ID = crypto.randomUUID()

const DEFAULT_SETTINGS: ProcessingSettings = {
  quality: 85,
  scale: 4,
  outputFormat: 'webp',
  keepExif: true,
}

export default function App() {
  const [mode, setMode] = useState<ProcessingMode>('compress')
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [processing, setProcessing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)

  const { files, addFiles, updateStatus, setResult, setError, clearAll } = useFileQueue()

  // Use a ref so callbacks always see the latest state setters without becoming
  // stale closures inside the SSE event listeners.
  const callbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  callbacks.current = useMemo(() => ({
    onProgress: (id: string, _percent: number) => updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => setResult(id, result),
    onError: (id: string, message: string) => setError(id, message),
  }), [updateStatus, setResult, setError])

  const { processQueue } = useProcessing(callbacks, SESSION_ID)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/health')
        setBackendOnline(r.ok)
      } catch {
        setBackendOnline(false)
      }
    }
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [])

  const handleProcess = useCallback(async () => {
    setProcessing(true)
    await processQueue(files, mode, settings)
    setProcessing(false)
  }, [files, mode, settings, processQueue])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar mode={mode} onModeChange={setMode} backendOnline={backendOnline} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-[#1f2937] overflow-hidden">
          <UploadPanel
            files={files}
            mode={mode}
            settings={settings}
            onFiles={addFiles}
            onSettingsChange={setSettings}
            onProcess={handleProcess}
            onClear={clearAll}
            processing={processing}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ResultPanel files={files} mode={mode} />
        </div>
      </div>
      <Footer files={files} sessionId={SESSION_ID} />
    </div>
  )
}
```

- [ ] **Step 4: Start both servers and verify the app loads**

```bash
# Terminal 1
cd backend && uvicorn main:app --port 8000 --reload

# Terminal 2
cd frontend && npm run dev
```
Open http://localhost:5173 — expect full UI with navbar, two panels, footer.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx frontend/index.html
git commit -m "feat: App root — wire all components together"
```

---

## Task 18: End-to-end verification

- [ ] **Step 1: Test compress flow**
  1. Open http://localhost:5173
  2. Switch to "Comprimi" mode
  3. Drop a JPEG >500KB onto the drop zone
  4. Click "Elabora"
  5. Verify: file item shows spinner → ✓ Pronto; result panel shows 3 stat cards with original size, compressed size, negative percentage

- [ ] **Step 2: Test enhance flow**
  1. Switch to "Migliora qualità" mode
  2. Drop a PNG or JPEG (64×64 or larger)
  3. Select 2× scale, click "Elabora"
  4. Verify: SSE progress updates; result panel shows before/after draggable slider; stat cards show scale and model name

- [ ] **Step 3: Test batch + ZIP download**
  1. Add 3 files in compress mode
  2. Click "Elabora" — verify sequential processing (one spinner at a time)
  3. When all done, click "Scarica ZIP (3 file)"
  4. Verify ZIP downloads and contains 3 output files

- [ ] **Step 4: Test error handling**
  1. Try to add a file >50MB — verify it's silently rejected (not added to list)
  2. Stop the backend, verify navbar badge turns red "Backend offline"
  3. Try Elabora with backend offline — verify error state on file items

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: PixelForge complete — compress + AI enhance app"
```
