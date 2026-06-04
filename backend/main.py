import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import process, download

app = FastAPI(title="PixelForge API")

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process.router)
app.include_router(download.router)

os.makedirs("/tmp/pixelforge/jobs", exist_ok=True)
