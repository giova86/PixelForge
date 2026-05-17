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
