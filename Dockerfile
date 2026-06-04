# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libheif1 \
        libheif-dev \
        gcc g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch CPU (much smaller than the default CUDA build)
RUN pip install --no-cache-dir \
        torch==2.3.0+cpu \
        torchvision==0.18.0+cpu \
        --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY backend/ .
COPY --from=frontend-build /build/dist ./static

EXPOSE 8000
CMD ["sh", "-c", "python download_weights.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
