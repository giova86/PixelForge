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
