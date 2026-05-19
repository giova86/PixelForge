# Resize Scale Factor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al pannello Resize una seconda modalità "Scala" (1/2, 1/3, 1/4) che affianca la modalità "Dimensioni" esistente, con il calcolo delle dimensioni effettive eseguito per ogni file lato backend.

**Architecture:** Il tipo `ResizeSettings` si estende con `mode` e `scaleFactor`. Il frontend invia `scale_factor` (float) oppure `width`+`height` a seconda della modalità. Il backend risolve le dimensioni per ogni file individualmente moltiplicando le dimensioni originali per il fattore.

**Tech Stack:** React + TypeScript (frontend), FastAPI + Pydantic + Pillow (backend), pytest + httpx (test)

---

## File coinvolti

| File | Modifica |
|------|----------|
| `frontend/src/types/index.ts` | Aggiunge `ResizeMode`, estende `ResizeSettings` |
| `backend/routers/process.py` | `width`/`height` opzionali, aggiunge `scale_factor`, validazione |
| `backend/tests/test_api.py` | Aggiunge test per `scale_factor` e validazione 422 |
| `frontend/src/hooks/useResizeProcessing.ts` | Firma cambia a `(entries, settings, batchId)` |
| `frontend/src/App.tsx` | `DEFAULT_RESIZE_SETTINGS` e call a `processResize` |
| `frontend/src/components/ResizePanel.tsx` | Radio selector + pulsanti scala, nuovi ref |

---

## Task 1: Estendi i tipi TypeScript

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Sostituisci `ResizeSettings` in `types/index.ts`**

  Apri `frontend/src/types/index.ts`. Aggiungi `ResizeMode` e aggiorna `ResizeSettings`:

  ```ts
  export type ResizeMode = 'dimensions' | 'scale'

  export interface ResizeSettings {
    mode: ResizeMode
    width: number
    height: number
    lockAspect: boolean
    scaleFactor: 0.5 | 0.333 | 0.25
  }
  ```

  Sostituisci la definizione esistente di `ResizeSettings` (righe 12-16) con il blocco qui sopra, aggiungendo `ResizeMode` prima di essa.

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/types/index.ts
  git commit -m "feat(types): add ResizeMode and scaleFactor to ResizeSettings"
  ```

---

## Task 2: Backend — supporto `scale_factor`

**Files:**
- Modify: `backend/routers/process.py:103-142` e `193-218`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Scrivi i test che falliranno**

  In fondo a `backend/tests/test_api.py` aggiungi:

  ```python
  @pytest.mark.asyncio
  async def test_resize_with_scale_factor_returns_job_id():
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
          r = await c.post("/resize", data={
              "session_id": "test-scale-session",
              "batch_id": "test-scale-batch",
              "scale_factor": "0.5",
          }, files={"file": ("test.jpg", _jpeg_bytes(200, 100), "image/jpeg")})
      assert r.status_code == 200
      assert "job_id" in r.json()


  @pytest.mark.asyncio
  async def test_resize_without_params_returns_422():
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
          r = await c.post("/resize", data={
              "session_id": "s",
              "batch_id": "b",
          }, files={"file": ("test.jpg", _jpeg_bytes(), "image/jpeg")})
      assert r.status_code == 422
  ```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

  ```bash
  cd /Users/gbocchi/Desktop/compress_quality/backend
  python -m pytest tests/test_api.py::test_resize_with_scale_factor_returns_job_id tests/test_api.py::test_resize_without_params_returns_422 -v
  ```

  Atteso: entrambi **FAIL** (422 e 200 invertiti rispetto all'atteso, o errore di parametri).

- [ ] **Step 3: Aggiorna `_run_resize` in `backend/routers/process.py`**

  Sostituisci la funzione `_run_resize` (righe 103-142) con:

  ```python
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

- [ ] **Step 4: Aggiorna l'endpoint `start_resize` in `backend/routers/process.py`**

  Sostituisci la funzione `start_resize` (righe 193-218) con:

  ```python
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
  ```

  Assicurati che `HTTPException` sia importata: controlla la riga degli import in cima al file (di solito già presente con FastAPI).

- [ ] **Step 5: Esegui i test per verificare che passino**

  ```bash
  cd /Users/gbocchi/Desktop/compress_quality/backend
  python -m pytest tests/test_api.py::test_resize_with_scale_factor_returns_job_id tests/test_api.py::test_resize_without_params_returns_422 -v
  ```

  Atteso: entrambi **PASS**.

- [ ] **Step 6: Esegui tutta la suite per verificare nessuna regressione**

  ```bash
  python -m pytest tests/ -v
  ```

  Atteso: tutti **PASS**.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/routers/process.py backend/tests/test_api.py
  git commit -m "feat(backend): add scale_factor support to /resize endpoint"
  ```

---

## Task 3: Aggiorna `useResizeProcessing`

**Files:**
- Modify: `frontend/src/hooks/useResizeProcessing.ts`

- [ ] **Step 1: Sostituisci il contenuto di `useResizeProcessing.ts`**

  Sostituisci l'intero file con:

  ```ts
  import { useCallback } from 'react'
  import type { FileEntry, JobResult, ResizeSettings } from '../types'

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
      settings: ResizeSettings,
      batchId: string,
    ) => {
      for (const entry of entries) {
        await new Promise<void>(async (resolve) => {
          const form = new FormData()
          form.append('file', entry.file)
          form.append('session_id', sessionId)
          form.append('batch_id', batchId)
          if (settings.mode === 'scale') {
            form.append('scale_factor', String(settings.scaleFactor))
          } else {
            form.append('width', String(settings.width))
            form.append('height', String(settings.height))
          }

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

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/hooks/useResizeProcessing.ts
  git commit -m "feat(hook): useResizeProcessing accepts ResizeSettings, sends scale_factor or dims"
  ```

---

## Task 4: Aggiorna `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Aggiorna `DEFAULT_RESIZE_SETTINGS` (riga 21-25)**

  Sostituisci:

  ```ts
  const DEFAULT_RESIZE_SETTINGS: ResizeSettings = {
    width: 800,
    height: 600,
    lockAspect: true,
  }
  ```

  con:

  ```ts
  const DEFAULT_RESIZE_SETTINGS: ResizeSettings = {
    mode: 'dimensions',
    width: 800,
    height: 600,
    lockAspect: true,
    scaleFactor: 0.5,
  }
  ```

- [ ] **Step 2: Aggiorna la chiamata a `processResize` in `handleProcess` (riga 121)**

  Sostituisci:

  ```ts
  await processResize(toProcess, resizeSettings.width, resizeSettings.height, newBatchId)
  ```

  con:

  ```ts
  await processResize(toProcess, resizeSettings, newBatchId)
  ```

- [ ] **Step 3: Verifica che TypeScript non riporti errori**

  ```bash
  cd /Users/gbocchi/Desktop/compress_quality/frontend
  npx tsc --noEmit
  ```

  Atteso: nessun output (zero errori).

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/App.tsx
  git commit -m "feat(app): update DEFAULT_RESIZE_SETTINGS and processResize call signature"
  ```

---

## Task 5: UI — `ResizePanel` con radio + pulsanti scala

**Files:**
- Modify: `frontend/src/components/ResizePanel.tsx`

- [ ] **Step 1: Sostituisci l'intero file `ResizePanel.tsx`**

  ```tsx
  import { useEffect, useRef, useState } from 'react'
  import type { FileEntry, ResizeSettings } from '../types'
  import { DropZone } from './DropZone'
  import { FileItem } from './FileItem'

  interface ResizePanelProps {
    files: FileEntry[]
    resizeSettings: ResizeSettings
    onFiles: (files: File[]) => void
    onResizeSettingsChange: (s: ResizeSettings) => void
    onProcess: () => void
    onClear: () => void
    onRemove: (id: string) => void
    processing: boolean
  }

  export function ResizePanel({
    files, resizeSettings, onFiles, onResizeSettingsChange, onProcess, onClear, onRemove, processing,
  }: ResizePanelProps) {
    const firstFile = files[0] ?? null
    const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)

    const lockAspectRef = useRef(resizeSettings.lockAspect)
    lockAspectRef.current = resizeSettings.lockAspect
    const modeRef = useRef(resizeSettings.mode)
    modeRef.current = resizeSettings.mode
    const scaleFactorRef = useRef(resizeSettings.scaleFactor)
    scaleFactorRef.current = resizeSettings.scaleFactor

    const aspectRatioRef = useRef<number | null>(null)

    const [localW, setLocalW] = useState(() => String(resizeSettings.width))
    const [localH, setLocalH] = useState(() => String(resizeSettings.height))

    useEffect(() => { setLocalW(String(resizeSettings.width)) }, [resizeSettings.width])
    useEffect(() => { setLocalH(String(resizeSettings.height)) }, [resizeSettings.height])

    useEffect(() => {
      if (!firstFile) { setOriginalDims(null); return }
      const img = new window.Image()
      img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
      img.src = firstFile.previewUrl
    }, [firstFile?.id])

    useEffect(() => {
      if (!originalDims) return
      aspectRatioRef.current = originalDims.h / originalDims.w
      onResizeSettingsChange({
        mode: modeRef.current,
        width: originalDims.w,
        height: originalDims.h,
        lockAspect: lockAspectRef.current,
        scaleFactor: scaleFactorRef.current,
      })
    }, [originalDims, onResizeSettingsChange])

    const handleWidthChange = (newW: number) => {
      if (resizeSettings.lockAspect && aspectRatioRef.current !== null) {
        const newH = Math.max(1, Math.round(newW * aspectRatioRef.current))
        onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
      } else {
        if (!resizeSettings.lockAspect) aspectRatioRef.current = resizeSettings.height / newW
        onResizeSettingsChange({ ...resizeSettings, width: newW })
      }
    }

    const handleHeightChange = (newH: number) => {
      if (resizeSettings.lockAspect && aspectRatioRef.current !== null) {
        const newW = Math.max(1, Math.round(newH / aspectRatioRef.current))
        onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
      } else {
        if (!resizeSettings.lockAspect) aspectRatioRef.current = newH / resizeSettings.width
        onResizeSettingsChange({ ...resizeSettings, height: newH })
      }
    }

    const canProcess = files.length > 0 && !processing && (
      resizeSettings.mode === 'scale' || (resizeSettings.width >= 1 && resizeSettings.height >= 1)
    )

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
          <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Uploaded files</span>
          <div className="flex gap-2">
            {files.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => document.getElementById('file-input-resize')?.click()}
              className="text-xs px-3 py-1 rounded-md border border-transparent text-[#111827] font-semibold"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
            >
              + Add
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-2/5">
              <DropZone onFiles={onFiles} />
            </div>
            <input
              id="file-input-resize"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => onFiles(Array.from(e.target.files ?? []))}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <DropZone onFiles={onFiles} />
            <input
              id="file-input-resize"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => onFiles(Array.from(e.target.files ?? []))}
            />

            {files.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {files.map(f => <FileItem key={f.id} entry={f} onRemove={onRemove} />)}
              </div>
            )}

            {firstFile && (
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-4">
                {/* Reference dims (only in dimensions mode when loaded) */}
                {originalDims && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6b7280]">
                      Reference:{' '}
                      <span className="text-[#9ca3af] font-semibold">{originalDims.w} × {originalDims.h} px</span>
                    </p>
                    {files.length > 1 && (
                      <span className="text-xs text-[#6b7280]">→ applied to {files.length} files</span>
                    )}
                  </div>
                )}

                {/* Mode selector */}
                <div className="flex gap-2">
                  {(['dimensions', 'scale'] as const).map(m => (
                    <label
                      key={m}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded-md border cursor-pointer text-xs font-semibold transition-all ${
                        resizeSettings.mode === m
                          ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                          : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resize-mode"
                        value={m}
                        checked={resizeSettings.mode === m}
                        onChange={() => onResizeSettingsChange({ ...resizeSettings, mode: m })}
                        className="hidden"
                      />
                      {m === 'dimensions' ? 'Dimensioni' : 'Scala'}
                    </label>
                  ))}
                </div>

                {/* Conditional controls */}
                {resizeSettings.mode === 'dimensions' ? (
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-[#9ca3af]">Width (px)</label>
                      <input
                        type="number"
                        min={1}
                        value={localW}
                        onChange={e => {
                          const str = e.target.value
                          setLocalW(str)
                          const n = parseInt(str, 10)
                          if (!isNaN(n) && n >= 1) handleWidthChange(n)
                        }}
                        className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                      />
                    </div>

                    <button
                      onClick={() => onResizeSettingsChange({ ...resizeSettings, lockAspect: !resizeSettings.lockAspect })}
                      title={resizeSettings.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                      className={`mb-0.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                        resizeSettings.lockAspect
                          ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                          : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                      }`}
                    >
                      {resizeSettings.lockAspect ? '= AR' : '/ AR'}
                    </button>

                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-[#9ca3af]">Height (px)</label>
                      <input
                        type="number"
                        min={1}
                        value={localH}
                        onChange={e => {
                          const str = e.target.value
                          setLocalH(str)
                          const n = parseInt(str, 10)
                          if (!isNaN(n) && n >= 1) handleHeightChange(n)
                        }}
                        className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {([
                      { factor: 0.5 as const, label: '1/2' },
                      { factor: 0.333 as const, label: '1/3' },
                      { factor: 0.25 as const, label: '1/4' },
                    ]).map(({ factor, label }) => (
                      <button
                        key={label}
                        onClick={() => onResizeSettingsChange({ ...resizeSettings, scaleFactor: factor })}
                        className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                          resizeSettings.scaleFactor === factor
                            ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                            : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {files.length > 0 && (
          <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
            <button
              onClick={onProcess}
              disabled={!canProcess}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
            >
              {processing
                ? 'Resizing…'
                : files.length > 1
                  ? `Resize ${files.length} images`
                  : 'Resize'}
            </button>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verifica TypeScript**

  ```bash
  cd /Users/gbocchi/Desktop/compress_quality/frontend
  npx tsc --noEmit
  ```

  Atteso: zero errori.

- [ ] **Step 3: Avvia il dev server e testa manualmente**

  ```bash
  cd /Users/gbocchi/Desktop/compress_quality/frontend
  npm run dev
  ```

  Verifica in browser:
  - [ ] Nella tab Resize, caricare un'immagine → appare il box con radio "Dimensioni" / "Scala"
  - [ ] "Dimensioni" è selezionato di default, mostra width/AR/height
  - [ ] Cliccando "Scala" scompaiono gli input e appaiono i tre pulsanti 1/2, 1/3, 1/4
  - [ ] 1/2 è selezionato di default in modalità scala (bordo amber)
  - [ ] Cliccando 1/3 o 1/4 cambia la selezione
  - [ ] Tornando a "Dimensioni" riappaiono gli input con i valori precedenti
  - [ ] Il pulsante "Resize" è abilitato in entrambe le modalità se c'è almeno un file

- [ ] **Step 4: Testa il flusso end-to-end**

  Con il backend avviato (`uvicorn main:app --reload` dalla cartella `backend`):
  - [ ] Caricare un'immagine 800×600, selezionare Scala → 1/2, cliccare Resize
  - [ ] Il risultato mostra 400×300 (o valori proporzionali all'immagine reale)
  - [ ] Caricare due immagini con dimensioni diverse, selezionare 1/4, cliccare Resize
  - [ ] Ogni immagine nel risultato ha le proprie dimensioni ridotte di 1/4

- [ ] **Step 5: Commit finale**

  ```bash
  git add frontend/src/components/ResizePanel.tsx
  git commit -m "feat(ui): add scale mode to ResizePanel with radio selector and 1/2 1/3 1/4 buttons"
  ```
