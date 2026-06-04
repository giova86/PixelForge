import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# Serve the built React app when running in production (static/ dir is
# populated by the Docker multi-stage build). Must be mounted last so API
# routes take precedence.
_static = Path(__file__).parent / "static"
if _static.exists():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="frontend")
