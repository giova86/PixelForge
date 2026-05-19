import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from routers.process import _jobs

router = APIRouter()


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
        seen: dict[str, int] = {}
        for job_id, job in session_jobs:
            output_path: Path = job["output"]
            if not (output_path and output_path.exists()):
                continue
            stem = job.get("original_stem", "image")
            name = stem + output_path.suffix
            if name in seen:
                seen[name] += 1
                name = f"{stem}_{seen[name]}{output_path.suffix}"
            else:
                seen[name] = 0
            zf.write(output_path, arcname=name)

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=pixelforge_{session_id[:8]}.zip"},
    )


@router.get("/download/batch/{batch_id}")
async def download_batch_zip(batch_id: str):
    batch_jobs = [
        (job_id, job) for job_id, job in _jobs.items()
        if job.get("batch_id") == batch_id and job.get("status") == "done"
    ]
    if not batch_jobs:
        raise HTTPException(status_code=404, detail="No completed jobs for this batch")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        seen: dict[str, int] = {}
        for job_id, job in batch_jobs:
            output_path: Path = job["output"]
            if not (output_path and output_path.exists()):
                continue
            stem = job.get("original_stem", "image")
            name = stem + output_path.suffix
            if name in seen:
                seen[name] += 1
                name = f"{stem}_{seen[name]}{output_path.suffix}"
            else:
                seen[name] = 0
            zf.write(output_path, arcname=name)

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=pixelforge_{batch_id[:8]}.zip"},
    )
