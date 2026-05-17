import asyncio, json, uuid
from pathlib import Path

import aiofiles
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from models.schemas import HealthResponse, JobStarted
from services.compress import compress_image, extension, mime_type
from services.enhance import enhance_image, get_model_name

router = APIRouter()

JOBS_DIR = Path("/tmp/pixelforge/jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)

_jobs: dict = {}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _run_compress(job_id: str, input_path: Path, quality: int,
                        output_format: str, keep_exif: bool, session_id: str) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _jobs[job_id]["status"] = "processing"
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        original_size = len(data)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
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
        _jobs[job_id]["status"] = "processing"
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
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
            status = job["status"]
            if status == "processing":
                yield _sse("progress", {"step": "processing", "percent": 50})
            elif status == "done":
                meta = job["meta"]
                yield _sse("done", {**meta, "output_url": f"/result/{job_id}"})
                return
            elif status == "error":
                yield _sse("error", {"message": job.get("message", "unknown error")})
                return
        yield _sse("error", {"message": "timeout"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/result/{job_id}")
async def get_result(job_id: str):
    job = _jobs.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(status_code=404, detail="Result not ready")
    return FileResponse(job["output"], media_type=job["mime"])


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        gpu=torch.cuda.is_available(),
        model="RealESRGAN_x4plus",
    )
