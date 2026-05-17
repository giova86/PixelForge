import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

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
