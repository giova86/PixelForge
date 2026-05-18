# Image Resize — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una terza modalità "Ridimensiona" che permette di caricare una singola immagine, impostarne le nuove dimensioni (con lock aspect ratio), elaborarla server-side con PIL Lanczos e mostrare il risultato con before/after slider.

**Architecture:** Nuovo endpoint `POST /resize` in FastAPI + servizio `resize.py`. Frontend: nuovo hook `useResizeProcessing`, nuovi componenti `ResizePanel` e `ResizeResult`, terza coda indipendente in `App.tsx`. Il `ProcessingMode` viene esteso con `'resize'`. SSE streaming e download ZIP riutilizzano l'infrastruttura esistente invariata.

**Tech Stack:** React 18, TypeScript, FastAPI, PIL/Pillow (Lanczos), SSE, TailwindCSS

---

## File modificati

| File | Tipo | Responsabilità |
|------|------|----------------|
| `backend/services/resize.py` | Nuovo | `resize_image(data, width, height, output_format) -> bytes` |
| `backend/tests/test_resize.py` | Nuovo | Unit test del servizio resize |
| `backend/routers/process.py` | Modifica | `_run_resize` + endpoint `POST /resize` |
| `backend/tests/test_api.py` | Modifica | Test API per `/resize` |
| `frontend/src/types/index.ts` | Modifica | Aggiunge `'resize'`, `ResizeSettings`, campi in `JobResult` |
| `frontend/src/components/Navbar.tsx` | Modifica | Terzo tab "Ridimensiona" |
| `frontend/src/hooks/useResizeProcessing.ts` | Nuovo | Hook per chiamare `/resize` + SSE |
| `frontend/src/components/ResizePanel.tsx` | Nuovo | Drop zone singola, dimensioni originali, input W/H, lock AR |
| `frontend/src/components/ResizeResult.tsx` | Nuovo | Before/after slider + stats dimensioni |
| `frontend/src/components/ResultPanel.tsx` | Modifica | Aggiunge branch `ResizeResult` per `mode === 'resize'` |
| `frontend/src/App.tsx` | Modifica | Terza coda, batchId, processing, callbacks, hook, render |

---

### Task 1: Backend service `resize.py`

**Files:**
- Create: `backend/services/resize.py`
- Create: `backend/tests/test_resize.py`

- [ ] **Step 1: Scrivere il test che fallisce**

```bash
# nella root del progetto
cd /Users/gbocchi/Desktop/compress_quality/backend
```

Creare `backend/tests/test_resize.py`:

```python
import io
import pytest
from PIL import Image
from services.resize import resize_image


def _make_jpeg(w=200, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=(100, 150, 200)).save(buf, format="JPEG")
    return buf.getvalue()


def test_resize_changes_dimensions():
    data = _make_jpeg(200, 100)
    result = resize_image(data, 50, 30, "jpeg")
    img = Image.open(io.BytesIO(result))
    assert img.size == (50, 30)


def test_resize_preserves_png_format():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="PNG")
    result = resize_image(buf.getvalue(), 40, 40, "png")
    img = Image.open(io.BytesIO(result))
    assert img.format == "PNG"


def test_resize_rgba_to_jpeg_converts_to_rgb():
    buf = io.BytesIO()
    Image.new("RGBA", (100, 100)).save(buf, format="PNG")
    result = resize_image(buf.getvalue(), 50, 50, "jpeg")
    img = Image.open(io.BytesIO(result))
    assert img.format == "JPEG"
    assert img.mode == "RGB"
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

```bash
cd /Users/gbocchi/Desktop/compress_quality/backend
python -m pytest tests/test_resize.py -v
```

Expected: FAIL con `ModuleNotFoundError: No module named 'services.resize'`

- [ ] **Step 3: Implementare `backend/services/resize.py`**

```python
import io
from PIL import Image


def resize_image(data: bytes, width: int, height: int, output_format: str) -> bytes:
    """output_format è già risolto dal chiamante (es. 'jpeg', 'png', 'webp')."""
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "P", "LA") and output_format == "jpeg":
        img = img.convert("RGB")
    resized = img.resize((width, height), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format=output_format.upper())
    return buf.getvalue()
```

- [ ] **Step 4: Eseguire i test per verificare che passino**

```bash
cd /Users/gbocchi/Desktop/compress_quality/backend
python -m pytest tests/test_resize.py -v
```

Expected: 3 test PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/resize.py backend/tests/test_resize.py
git commit -m "feat: add resize_image service with PIL Lanczos"
```

---

### Task 2: Backend endpoint `POST /resize`

**Files:**
- Modify: `backend/routers/process.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Scrivere i test API per `/resize` che falliscono**

Aprire `backend/tests/test_api.py` e appendere alla fine:

```python
@pytest.mark.asyncio
async def test_resize_returns_job_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/resize", data={
            "session_id": "test-resize",
            "batch_id": "test-batch-resize",
            "width": "100",
            "height": "80",
        }, files={"file": ("test.jpg", _jpeg_bytes(), "image/jpeg")})
    assert r.status_code == 200
    assert "job_id" in r.json()


@pytest.mark.asyncio
async def test_resize_result_after_process():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/resize", data={
            "session_id": "test-resize-2",
            "batch_id": "test-batch-resize-2",
            "width": "30",
            "height": "20",
        }, files={"file": ("test.jpg", _jpeg_bytes(50, 50), "image/jpeg")})
        job_id = r.json()["job_id"]
        await asyncio.sleep(3)
        r2 = await c.get(f"/result/{job_id}")
    assert r2.status_code == 200
    assert r2.headers["content-type"].startswith("image/")
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

```bash
cd /Users/gbocchi/Desktop/compress_quality/backend
python -m pytest tests/test_api.py::test_resize_returns_job_id tests/test_api.py::test_resize_result_after_process -v
```

Expected: FAIL con `404 Not Found`

- [ ] **Step 3: Modificare `backend/routers/process.py`**

**3a — Aggiungere import** in cima al file (modifica la riga degli import stdlib e aggiungi le nuove righe):

Sostituire:
```python
import asyncio, json, uuid
from pathlib import Path
```
Con:
```python
import asyncio, io, json, uuid
from pathlib import Path
```

Aggiungere dopo `from services.enhance import enhance_image, get_model_name`:
```python
from PIL import Image
from services.resize import resize_image
```

**3b — Aggiungere `_run_resize`** dopo la funzione `_run_enhance` (prima di `_EXT_TO_FORMAT`):

```python
async def _run_resize(job_id: str, input_path: Path, width: int, height: int,
                      output_format: str, session_id: str, batch_id: str) -> None:
    job_dir = JOBS_DIR / job_id
    try:
        _jobs[job_id]["status"] = "processing"
        async with aiofiles.open(input_path, "rb") as f:
            data = await f.read()

        img_info = Image.open(io.BytesIO(data))
        original_width, original_height = img_info.size
        img_info.close()

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
            },
        }
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "message": str(exc), "session_id": session_id, "batch_id": batch_id}
```

**3c — Aggiungere l'endpoint `POST /resize`** dopo l'endpoint `POST /process`:

```python
@router.post("/resize", response_model=JobStarted)
async def start_resize(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    batch_id: str = Form(...),
    width: int = Form(...),
    height: int = Form(...),
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

    output_format = _EXT_TO_FORMAT.get(suffix, "jpeg")

    _jobs[job_id] = {"status": "pending", "session_id": session_id, "batch_id": batch_id, "original_stem": original_stem}
    asyncio.create_task(_run_resize(job_id, input_path, width, height, output_format, session_id, batch_id))

    return JobStarted(job_id=job_id)
```

- [ ] **Step 4: Eseguire i test per verificare che passino**

```bash
cd /Users/gbocchi/Desktop/compress_quality/backend
python -m pytest tests/test_api.py -v
```

Expected: tutti i test PASS (inclusi i 2 nuovi)

- [ ] **Step 5: Commit**

```bash
git add backend/routers/process.py backend/tests/test_api.py
git commit -m "feat: add POST /resize endpoint with PIL Lanczos"
```

---

### Task 3: TypeScript types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Aggiornare `frontend/src/types/index.ts`**

Sostituire l'intero file con:

```typescript
export type ProcessingMode = 'compress' | 'enhance' | 'resize'
export type OutputFormat = 'original' | 'webp' | 'jpeg' | 'png'
export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ProcessingSettings {
  quality: number
  scale: 1 | 2 | 4
  outputFormat: OutputFormat
  keepExif: boolean
}

export interface ResizeSettings {
  width: number
  height: number
  lockAspect: boolean
}

export interface JobResult {
  mode: ProcessingMode
  outputUrl: string
  outputFormat?: string
  // compress
  originalSize?: number
  compressedSize?: number
  savingPercent?: number
  // enhance
  scale?: number
  model?: string
  // resize
  originalWidth?: number
  originalHeight?: number
  outputWidth?: number
  outputHeight?: number
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

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add resize to ProcessingMode, add ResizeSettings, extend JobResult"
```

---

### Task 4: Navbar — terzo tab

**Files:**
- Modify: `frontend/src/components/Navbar.tsx`

- [ ] **Step 1: Aggiornare `frontend/src/components/Navbar.tsx`**

Sostituire l'intero file con:

```tsx
import type { ProcessingMode } from '../types'

interface NavbarProps {
  mode: ProcessingMode
  onModeChange: (mode: ProcessingMode) => void
  backendOnline: boolean
}

const MODE_LABELS: Record<ProcessingMode, string> = {
  compress: 'Comprimi',
  enhance: 'Migliora qualità',
  resize: 'Ridimensiona',
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
        {(['compress', 'enhance', 'resize'] as ProcessingMode[]).map(m => (
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
            {MODE_LABELS[m]}
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

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Navbar.tsx
git commit -m "feat: add Ridimensiona tab to Navbar"
```

---

### Task 5: Hook `useResizeProcessing`

**Files:**
- Create: `frontend/src/hooks/useResizeProcessing.ts`

- [ ] **Step 1: Creare `frontend/src/hooks/useResizeProcessing.ts`**

```typescript
import { useCallback } from 'react'
import type { FileEntry, JobResult } from '../types'

interface ProcessingCallbacks {
  onProgress: (id: string, percent: number) => void
  onDone: (id: string, result: JobResult) => void
  onError: (id: string, message: string) => void
}

export function useResizeProcessing(
  callbacks: React.MutableRefObject<ProcessingCallbacks>,
  sessionId: string,
) {
  const processResize = useCallback(async (
    entries: FileEntry[],
    width: number,
    height: number,
    batchId: string,
  ) => {
    for (const entry of entries) {
      await new Promise<void>(async (resolve) => {
        const form = new FormData()
        form.append('file', entry.file)
        form.append('session_id', sessionId)
        form.append('batch_id', batchId)
        form.append('width', String(width))
        form.append('height', String(height))

        let jobId: string
        try {
          const res = await fetch('/resize', { method: 'POST', body: form })
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
            mode: 'resize',
            outputUrl: data.output_url,
            outputFormat: data.output_format,
            originalWidth: data.original_width,
            originalHeight: data.original_height,
            outputWidth: data.output_width,
            outputHeight: data.output_height,
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

  return { processResize }
}
```

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useResizeProcessing.ts
git commit -m "feat: add useResizeProcessing hook for /resize endpoint"
```

---

### Task 6: Componente `ResizePanel`

**Files:**
- Create: `frontend/src/components/ResizePanel.tsx`

- [ ] **Step 1: Creare `frontend/src/components/ResizePanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { FileEntry, ResizeSettings } from '../types'
import { DropZone } from './DropZone'

interface ResizePanelProps {
  files: FileEntry[]
  resizeSettings: ResizeSettings
  onFiles: (files: File[]) => void
  onResizeSettingsChange: (s: ResizeSettings) => void
  onProcess: () => void
  onClear: () => void
  processing: boolean
}

export function ResizePanel({
  files, resizeSettings, onFiles, onResizeSettingsChange, onProcess, onClear, processing,
}: ResizePanelProps) {
  const file = files[0] ?? null
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)
  const lockAspectRef = useRef(resizeSettings.lockAspect)
  lockAspectRef.current = resizeSettings.lockAspect

  useEffect(() => {
    if (!file) { setOriginalDims(null); return }
    const img = new window.Image()
    img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = file.previewUrl
  }, [file?.id])

  useEffect(() => {
    if (!originalDims) return
    onResizeSettingsChange({ width: originalDims.w, height: originalDims.h, lockAspect: lockAspectRef.current })
  }, [originalDims, onResizeSettingsChange])

  const handleWidthChange = (newW: number) => {
    if (resizeSettings.lockAspect && originalDims && originalDims.w > 0) {
      const newH = Math.max(1, Math.round(newW * originalDims.h / originalDims.w))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      onResizeSettingsChange({ ...resizeSettings, width: newW })
    }
  }

  const handleHeightChange = (newH: number) => {
    if (resizeSettings.lockAspect && originalDims && originalDims.h > 0) {
      const newW = Math.max(1, Math.round(newH * originalDims.w / originalDims.h))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      onResizeSettingsChange({ ...resizeSettings, height: newH })
    }
  }

  const canProcess = !!file && resizeSettings.width >= 1 && resizeSettings.height >= 1 && !processing

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Immagine</span>
        {file && (
          <button
            onClick={onClear}
            className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors"
          >
            Rimuovi
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <DropZone onFiles={onFiles} />

        {file && originalDims && (
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-4">
            <p className="text-xs text-[#6b7280]">
              Dimensioni originali:{' '}
              <span className="text-[#9ca3af] font-semibold">{originalDims.w} × {originalDims.h} px</span>
            </p>

            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-[#9ca3af]">Larghezza (px)</label>
                <input
                  type="number"
                  min={1}
                  value={resizeSettings.width}
                  onChange={e => handleWidthChange(Math.max(1, Number(e.target.value) || 1))}
                  className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                />
              </div>

              <button
                onClick={() => onResizeSettingsChange({ ...resizeSettings, lockAspect: !resizeSettings.lockAspect })}
                title={resizeSettings.lockAspect ? 'Sblocca proporzioni' : 'Blocca proporzioni'}
                className={`mb-0.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                  resizeSettings.lockAspect
                    ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                    : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                }`}
              >
                {resizeSettings.lockAspect ? '= AR' : '/ AR'}
              </button>

              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-[#9ca3af]">Altezza (px)</label>
                <input
                  type="number"
                  min={1}
                  value={resizeSettings.height}
                  onChange={e => handleHeightChange(Math.max(1, Number(e.target.value) || 1))}
                  className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                />
              </div>
            </div>

            {file.status === 'error' && file.errorMessage && (
              <p className="text-xs text-[#f87171]">{file.errorMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
        <button
          onClick={onProcess}
          disabled={!canProcess}
          className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          {processing ? 'Ridimensionamento in corso…' : 'Ridimensiona'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResizePanel.tsx
git commit -m "feat: add ResizePanel component with aspect ratio lock"
```

---

### Task 7: Componente `ResizeResult`

**Files:**
- Create: `frontend/src/components/ResizeResult.tsx`

- [ ] **Step 1: Creare `frontend/src/components/ResizeResult.tsx`**

```tsx
import { useCallback, useRef, useState } from 'react'
import type { FileEntry } from '../types'

interface ResizeResultProps {
  entry: FileEntry
}

export function ResizeResult({ entry }: ResizeResultProps) {
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
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden flex flex-col h-full">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none cursor-ew-resize min-h-0"
        onMouseDown={() => { dragging.current = true }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      >
        <img
          src={`${result.outputUrl}?t=${Date.now()}`}
          alt="Resized"
          className="absolute inset-0 w-full h-full object-contain bg-[#111827]"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
          <img src={previewUrl} alt="Original" className="w-full h-full object-contain bg-[#0d1117]" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${sliderX}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-[#374151] text-xs font-bold"
          style={{ left: `${sliderX}%` }}
        >
          ↔
        </div>
        <span className="absolute bottom-2 left-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">Prima</span>
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">Dopo</span>
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-[#f59e0b]">{result.originalWidth} × {result.originalHeight}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Originale (px)</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-[#34d399]">{result.outputWidth} × {result.outputHeight}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Output (px)</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-[#818cf8]">Lanczos</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Metodo</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResizeResult.tsx
git commit -m "feat: add ResizeResult component with before/after slider"
```

---

### Task 8: Wire `ResultPanel` per resize

**Files:**
- Modify: `frontend/src/components/ResultPanel.tsx`

- [ ] **Step 1: Aggiornare `frontend/src/components/ResultPanel.tsx`**

Sostituire l'intero file con:

```tsx
import { useEffect, useState } from 'react'
import type { FileEntry, ProcessingMode } from '../types'
import { CompressResult } from './CompressResult'
import { EnhanceResult } from './EnhanceResult'
import { ResizeResult } from './ResizeResult'
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

      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {!activeEntry && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#4b5563]">
            <span className="text-4xl opacity-30">✦</span>
            <p className="text-sm">Elabora un&apos;immagine per vedere il risultato</p>
          </div>
        )}
        {activeEntry && mode === 'compress' && <CompressResult entry={activeEntry} />}
        {activeEntry && mode === 'enhance' && <EnhanceResult entry={activeEntry} />}
        {activeEntry && mode === 'resize' && <ResizeResult entry={activeEntry} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResultPanel.tsx
git commit -m "feat: wire ResizeResult in ResultPanel"
```

---

### Task 9: Wire `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Sostituire l'intero contenuto di `frontend/src/App.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { ResizePanel } from './components/ResizePanel'
import { ResultPanel } from './components/ResultPanel'
import { UploadPanel } from './components/UploadPanel'
import { useFileQueue } from './hooks/useFileQueue'
import { useProcessing } from './hooks/useProcessing'
import { useResizeProcessing } from './hooks/useResizeProcessing'
import type { JobResult, ProcessingMode, ProcessingSettings, ResizeSettings } from './types'

const SESSION_ID = crypto.randomUUID()

const DEFAULT_SETTINGS: ProcessingSettings = {
  quality: 75,
  scale: 4,
  outputFormat: 'original',
  keepExif: true,
}

const DEFAULT_RESIZE_SETTINGS: ResizeSettings = {
  width: 800,
  height: 600,
  lockAspect: true,
}

export default function App() {
  const [mode, setMode] = useState<ProcessingMode>('compress')
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [resizeSettings, setResizeSettings] = useState<ResizeSettings>(DEFAULT_RESIZE_SETTINGS)
  const [backendOnline, setBackendOnline] = useState(false)

  const compressQueue = useFileQueue()
  const enhanceQueue = useFileQueue()
  const resizeQueue = useFileQueue()

  const [compressBatchId, setCompressBatchId] = useState(() => crypto.randomUUID())
  const [enhanceBatchId, setEnhanceBatchId] = useState(() => crypto.randomUUID())
  const [resizeBatchId, setResizeBatchId] = useState(() => crypto.randomUUID())
  const [compressProcessing, setCompressProcessing] = useState(false)
  const [enhanceProcessing, setEnhanceProcessing] = useState(false)
  const [resizeProcessing, setResizeProcessing] = useState(false)

  const compressCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  compressCallbacks.current = {
    onProgress: (id: string, _percent: number) => compressQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => compressQueue.setResult(id, result),
    onError: (id: string, message: string) => compressQueue.setError(id, message),
  }

  const enhanceCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  enhanceCallbacks.current = {
    onProgress: (id: string, _percent: number) => enhanceQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => enhanceQueue.setResult(id, result),
    onError: (id: string, message: string) => enhanceQueue.setError(id, message),
  }

  const resizeCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  resizeCallbacks.current = {
    onProgress: (id: string, _percent: number) => resizeQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => resizeQueue.setResult(id, result),
    onError: (id: string, message: string) => resizeQueue.setError(id, message),
  }

  const { processQueue: compressProcessQueue } = useProcessing(compressCallbacks, SESSION_ID, compressBatchId)
  const { processQueue: enhanceProcessQueue } = useProcessing(enhanceCallbacks, SESSION_ID, enhanceBatchId)
  const { processResize } = useResizeProcessing(resizeCallbacks, SESSION_ID)

  const activeQueue = mode === 'compress' ? compressQueue : mode === 'enhance' ? enhanceQueue : resizeQueue
  const activeBatchId = mode === 'compress' ? compressBatchId : mode === 'enhance' ? enhanceBatchId : resizeBatchId
  const activeProcessing = mode === 'compress' ? compressProcessing : mode === 'enhance' ? enhanceProcessing : resizeProcessing

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

  const handleResizeFile = useCallback((incoming: File[]) => {
    resizeQueue.clearAll()
    resizeQueue.addFiles(incoming.slice(0, 1))
  }, [resizeQueue.clearAll, resizeQueue.addFiles])

  const handleProcess = useCallback(async () => {
    const newBatchId = crypto.randomUUID()
    if (mode === 'compress') {
      setCompressBatchId(newBatchId)
      setCompressProcessing(true)
      const toProcess = compressQueue.resetAll()
      await compressProcessQueue(toProcess, mode, settings, newBatchId)
      setCompressProcessing(false)
    } else if (mode === 'enhance') {
      setEnhanceBatchId(newBatchId)
      setEnhanceProcessing(true)
      const toProcess = enhanceQueue.resetAll()
      await enhanceProcessQueue(toProcess, mode, settings, newBatchId)
      setEnhanceProcessing(false)
    } else {
      setResizeBatchId(newBatchId)
      setResizeProcessing(true)
      const toProcess = resizeQueue.resetAll()
      await processResize(toProcess, resizeSettings.width, resizeSettings.height, newBatchId)
      setResizeProcessing(false)
    }
  }, [mode, settings, resizeSettings, compressQueue.resetAll, enhanceQueue.resetAll, resizeQueue.resetAll, compressProcessQueue, enhanceProcessQueue, processResize])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar mode={mode} onModeChange={setMode} backendOnline={backendOnline} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-[#1f2937] overflow-hidden">
          {mode === 'resize' ? (
            <ResizePanel
              files={resizeQueue.files}
              resizeSettings={resizeSettings}
              onFiles={handleResizeFile}
              onResizeSettingsChange={setResizeSettings}
              onProcess={handleProcess}
              onClear={resizeQueue.clearAll}
              processing={resizeProcessing}
            />
          ) : (
            <UploadPanel
              files={activeQueue.files}
              mode={mode}
              settings={settings}
              onFiles={activeQueue.addFiles}
              onSettingsChange={setSettings}
              onProcess={handleProcess}
              onClear={activeQueue.clearAll}
              onRemove={activeQueue.removeFile}
              processing={activeProcessing}
            />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <ResultPanel files={activeQueue.files} mode={mode} />
        </div>
      </div>
      <Footer files={activeQueue.files} batchId={activeBatchId} />
    </div>
  )
}
```

- [ ] **Step 2: Verificare la compilazione TypeScript**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npx tsc --noEmit
```

Expected: nessun errore

- [ ] **Step 3: Avviare il dev server e verificare manualmente**

```bash
cd /Users/gbocchi/Desktop/compress_quality/frontend
npm run dev
```

Checklist di verifica manuale:
1. La Navbar mostra tre tab: "Comprimi", "Migliora qualità", "Ridimensiona"
2. Click su "Ridimensiona" → pannello sinistro mostra drop zone con testo "Trascina le immagini qui"
3. Carica un'immagine → compare il box con "Dimensioni originali: W × H px" e i campi Larghezza/Altezza pre-popolati
4. Modifica la larghezza con "= AR" attivo → l'altezza si aggiorna proporzionalmente
5. Click su "= AR" → diventa "/ AR"; ora i campi sono indipendenti
6. Click "Ridimensiona" → pulsante mostra "Ridimensionamento in corso…" durante l'elaborazione
7. Dopo elaborazione → pannello destro mostra before/after slider con le dimensioni originale e output
8. Footer mostra "1 elaborati" e pulsante "Scarica" (non ZIP, file singolo)
9. "Comprimi" e "Migliora qualità" continuano a funzionare indipendentemente

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire resize mode in App — third queue, ResizePanel, useResizeProcessing"
```
