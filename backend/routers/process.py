import asyncio, io, json, uuid
from pathlib import Path

import aiofiles
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from models.schemas import HealthResponse, JobStarted
from services.compress import compress_image, extension, mime_type
from services.enhance import enhance_image, get_model_name
from PIL import Image
from services.resize import resize_image

router = APIRouter()

JOBS_DIR = Path("/tmp/pixelforge/jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)

_jobs: dict = {}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _run_compress(job_id: str, input_path: Path, quality: int,
                        output_format: str, keep_exif: bool, session_id: str, batch_id: str) -> None:
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

        original_stem = _jobs[job_id].get("original_stem", "image")
        _jobs[job_id] = {
            "status": "done",
            "output": out_path,
            "mime": mime_type(output_format),
            "session_id": session_id,
            "batch_id": batch_id,
            "original_stem": original_stem,
            "meta": {
                "mode": "compress",
                "output_format": output_format,
                "original_size": original_size,
                "compressed_size": compressed_size,
                "saving_percent": saving_percent,
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id, "batch_id": batch_id}


async def _run_enhance(job_id: str, input_path: Path, scale: int,
                       output_format: str, session_id: str, batch_id: str) -> None:
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

        original_stem = _jobs[job_id].get("original_stem", "image")
        _jobs[job_id] = {
            "status": "done",
            "output": out_path,
            "mime": mime_type(output_format),
            "session_id": session_id,
            "batch_id": batch_id,
            "original_stem": original_stem,
            "meta": {
                "mode": "enhance",
                "output_format": output_format,
                "scale": scale,
                "model": get_model_name(scale),
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id, "batch_id": batch_id}


async def _run_resize(
    job_id: str, input_path: Path, output_format: str,
    session_id: str, batch_id: str,
    width: int | None = None, height: int | None = None,
    scale_factor: float | None = None,
) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _jobs[job_id]["status"] = "processing"
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        img_info = Image.open(io.BytesIO(data))
        original_width, original_height = img_info.size
        img_info.close()

        if scale_factor is not None:
            width = max(1, round(original_width * scale_factor))
            height = max(1, round(original_height * scale_factor))

        if width is None or height is None:
            raise ValueError("width and height must be resolved before calling resize_image")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, resize_image, data, width, height, output_format
        )

        out_path = job_dir / f"output{extension(output_format)}"
        async with aiofiles.open(out_path, "wb") as f:
            await f.write(result)

        original_stem = _jobs[job_id].get("original_stem", "image")
        _jobs[job_id] = {
            "status": "done",
            "output": out_path,
            "mime": mime_type(output_format),
            "session_id": session_id,
            "batch_id": batch_id,
            "original_stem": original_stem,
            "meta": {
                "mode": "resize",
                "output_format": output_format,
                "original_width": original_width,
                "original_height": original_height,
                "output_width": width,
                "output_height": height,
                "output_size": len(result),
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id, "batch_id": batch_id}


_EXT_TO_FORMAT = {
    ".jpg": "jpeg", ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp",
    ".tiff": "png", ".tif": "png",
    ".bmp": "png",
    ".heic": "jpeg",
}


@router.post("/process", response_model=JobStarted)
async def start_process(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    batch_id: str = Form(...),
    mode: str = Form(...),
    quality: int = Form(85),
    scale: int = Form(4),
    output_format: str = Form("original"),
    keep_exif: bool = Form(True),
):
    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)

    original_path = Path(file.filename or "upload.jpg")
    suffix = original_path.suffix.lower() or ".jpg"
    original_stem = original_path.stem or "image"
    input_path = job_dir / f"input{suffix}"
    contents = await file.read()
    async with aiofiles.open(input_path, "wb") as f:
        await f.write(contents)

    if output_format == "original":
        output_format = _EXT_TO_FORMAT.get(suffix, "jpeg")

    _jobs[job_id] = {"status": "pending", "session_id": session_id, "batch_id": batch_id, "original_stem": original_stem}

    if mode == "compress":
        asyncio.create_task(_run_compress(job_id, input_path, quality, output_format, keep_exif, session_id, batch_id))
    elif mode == "enhance":
        asyncio.create_task(_run_enhance(job_id, input_path, scale, output_format, session_id, batch_id))
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

    return JobStarted(job_id=job_id)


@router.post("/resize", response_model=JobStarted)
async def start_resize(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    batch_id: str = Form(...),
    width: int | None = Form(None, ge=1, le=16384),
    height: int | None = Form(None, ge=1, le=16384),
    scale_factor: float | None = Form(None, gt=0, lt=1),
):
    if scale_factor is None and (width is None or height is None):
        raise HTTPException(status_code=422, detail="Provide either width+height or scale_factor")

    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)

    original_path = Path(file.filename or "upload.jpg")
    suffix = original_path.suffix.lower() or ".jpg"
    original_stem = original_path.stem or "image"
    input_path = job_dir / f"input{suffix}"
    contents = await file.read()
    async with aiofiles.open(input_path, "wb") as f:
        await f.write(contents)

    output_format = _EXT_TO_FORMAT.get(suffix, "jpeg")

    _jobs[job_id] = {"status": "pending", "session_id": session_id, "batch_id": batch_id, "original_stem": original_stem}
    asyncio.create_task(_run_resize(
        job_id, input_path, output_format, session_id, batch_id,
        width=width, height=height, scale_factor=scale_factor,
    ))

    return JobStarted(job_id=job_id)


@router.get("/stream/{job_id}")
async def stream_job(job_id: str):
    async def event_generator():
        yield _sse("progress", {"step": "queued", "percent": 5})
        for _ in range(600):
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
    output_path: Path = job["output"]
    return FileResponse(
        output_path,
        media_type=job["mime"],
        filename=output_path.name,
        content_disposition_type="attachment",
    )


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        gpu=torch.cuda.is_available(),
        model="RealESRGAN_x4plus",
    )
