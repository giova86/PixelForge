# PixelForge — Design Spec
_Date: 2026-05-17_

## Context

L'utente vuole un'app desktop/web per due operazioni sulle immagini:
1. **Compressione** — ridurre il peso del file mantenendo qualità accettabile
2. **Miglioramento qualità (AI upscaling)** — aumentare risoluzione e nitidezza con Real-ESRGAN

L'app deve avere un layout elegante e moderno a doppio pannello (upload a sinistra, risultati a destra), supportare batch processing e fornire feedback visivo in tempo reale durante l'elaborazione.

---

## Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Python 3.11 + FastAPI |
| AI upscaling | Real-ESRGAN (basicsr / realesrgan PyPI) |
| Compressione | Pillow (JPEG/WebP/PNG) |
| Comunicazione | Server-Sent Events (SSE) |
| Formati input | JPEG, PNG, WebP, TIFF, BMP (HEIC via `pillow-heif` opzionale) |

---

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + Vite, porta 5173)                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  Pannello Upload     │  │  Pannello Risultato          │ │
│  │  - Drop zone         │  │  - Compress: stats 3 card    │ │
│  │  - Lista file + stato│  │  - Enhance: before/after     │ │
│  │  - Impostazioni      │  │  - Tab per file multipli     │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + SSE
┌────────────────────────▼────────────────────────────────────┐
│  FastAPI Backend (porta 8000)                               │
│  POST /process           → avvia job, ritorna job_id       │
│  GET  /stream/{job_id}   → SSE stream (progress + done)    │
│  GET  /result/{job_id}   → file immagine elaborata         │
│  GET  /download/{sid}    → ZIP batch (sid = session_id)    │
│  GET  /health            → status backend + GPU            │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
   ┌──────▼──────┐              ┌───────▼───────┐
   │  Pillow /   │              │  Real-ESRGAN  │
   │  pngquant   │              │  (PyTorch)    │
   │  Compress   │              │  Enhance 2×/4×│
   └─────────────┘              └───────────────┘
```

---

## Frontend — Componenti React

```
src/
├── App.tsx                    # Root, gestione modalità compress/enhance
├── components/
│   ├── Navbar.tsx             # Logo, mode toggle, badge backend status
│   ├── UploadPanel.tsx        # Pannello sinistro
│   │   ├── DropZone.tsx       # Drag & drop + click to browse
│   │   ├── FileList.tsx       # Lista file con stati (pending/processing/done/error)
│   │   ├── FileItem.tsx       # Singola riga file con thumbnail e stato
│   │   └── SettingsBox.tsx    # Quality slider, scala, formato, EXIF toggle
│   ├── ResultPanel.tsx        # Pannello destro
│   │   ├── ResultTabs.tsx     # Tab switching tra file processati
│   │   ├── CompressResult.tsx # Anteprima + 3 stat card (orig/compressed/%)
│   │   └── EnhanceResult.tsx  # Before/after slider interattivo
│   └── Footer.tsx             # Info batch + bottone download ZIP
├── hooks/
│   ├── useProcessing.ts       # Logica SSE: apre EventSource, aggiorna stato
│   └── useFileQueue.ts        # Coda upload, gestione batch
└── types/
    └── index.ts               # FileEntry, JobResult, ProcessingMode
```

### Tipi principali

```typescript
type ProcessingMode = 'compress' | 'enhance'

interface FileEntry {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  result?: JobResult
}

interface JobResult {
  mode: ProcessingMode
  // Compress
  originalSize?: number
  compressedSize?: number
  savingPercent?: number
  outputUrl?: string
  // Enhance
  beforeUrl?: string
  afterUrl?: string
  scale?: 2 | 4
  model?: string
}
```

---

## Backend — API

### `POST /process`
```json
// Request (multipart/form-data)
{
  "file": <binary>,
  "session_id": "uuid4",   // generato dal frontend a inizio sessione
  "mode": "compress" | "enhance",
  "quality": 85,           // compress only
  "scale": 4,              // enhance only (2 o 4)
  "output_format": "webp" | "jpeg" | "png"
}

// Response
{ "job_id": "uuid4" }
```

### `GET /stream/{job_id}`
Stream SSE con eventi:

```
event: progress
data: {"step": "loading", "percent": 10}

event: progress
data: {"step": "processing", "percent": 60}

event: done
data: {"result": { ...JobResult }, "output_url": "/result/{job_id}"}

event: error
data: {"message": "Descrizione errore"}
```

Il frontend recupera l'immagine elaborata tramite `GET /result/{job_id}` e la mostra con un `<img>` tag (o `object URL` locale). Questo evita di trasmettere immagini upscalate 4× (potenzialmente >20MB) nel payload SSE.

### `GET /result/{job_id}`
Ritorna il file immagine elaborato (`Content-Type: image/webp` ecc.). File conservato in `/tmp/jobs/{job_id}/output.*`.

### `GET /download/{session_id}`
Ritorna uno ZIP con tutti i file processati nella sessione. `session_id` corrisponde a quello passato in ogni `POST /process`.

### `GET /health`
```json
{ "status": "ok", "gpu": true, "model": "RealESRGAN_x4plus" }
```

---

## Flusso dati — Singola immagine

1. Utente trascina file → `useFileQueue` aggiunge `FileEntry` con status `pending`
2. Utente clicca **Elabora** → `useProcessing` fa `POST /process`
3. Backend riceve file, salva in `/tmp/jobs/{id}/`, avvia task async, risponde con `job_id`
4. Frontend apre `EventSource('/stream/{job_id}')`
5. Backend processa (Pillow o Real-ESRGAN), emette eventi SSE `progress`
6. Alla fine emette evento `done` con risultato in base64
7. Frontend aggiorna `FileEntry.status = 'done'`, salva `JobResult`
8. `ResultPanel` mostra risultato (stats per compress, slider per enhance)

---

## Flusso dati — Batch

1. Utente carica N file → tutti in coda `pending`
2. Frontend processa sequenzialmente (un SSE stream alla volta) per evitare OOM con Real-ESRGAN
3. Ogni file completato aggiorna la sua tab nel `ResultPanel`
4. Bottone "Scarica ZIP" attivo → `GET /download/{session_id}`
5. Backend crea ZIP on-demand dai file già elaborati in `/tmp/jobs/`

---

## Impostazioni utente

| Impostazione | Modalità | Valori | Default |
|---|---|---|---|
| Qualità output | Compress | 1–100 | 85 |
| Formato output | Entrambe | WebP / JPEG / PNG | WebP |
| Scala upscaling | Enhance | 2× / 4× | 4× |
| Mantieni EXIF | Entrambe | on/off | on |

---

## Visual Design

- **Tema:** Dark Warm — sfondo `#111827` / `#1f2937`, accenti `linear-gradient(#f59e0b → #ef4444)`
- **Layout:** Split orizzontale 50/50, header fisso, footer fisso
- **Tipografia:** Inter (system-ui fallback)
- **Animazioni:** spinner CSS per processing, transizioni 150ms su hover/active
- **Before/After slider:** drag interattivo con `clip-path` CSS, handle centrale
- **Stat cards:** 3 card per compress (originale / compresso / percentuale), colori verde/ambra/rosso

---

## Gestione errori

- File troppo grande (>50MB): errore inline nel `FileItem`, non blocca la coda
- Formato non supportato: validazione lato frontend prima dell'upload
- Timeout elaborazione (>120s): evento SSE `error`, stato `error` nel file item
- Backend non raggiungibile: badge "Backend offline" in navbar, bottone Elabora disabilitato
- Real-ESRGAN OOM (GPU): fallback automatico su CPU con avviso nello stream

---

## Struttura directory del progetto

```
compress_quality/
├── frontend/               # React + Vite
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                # FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── process.py
│   │   └── download.py
│   ├── services/
│   │   ├── compress.py     # Pillow + pngquant
│   │   └── enhance.py      # Real-ESRGAN wrapper
│   ├── models/             # Pydantic schemas
│   └── requirements.txt
└── docs/
    └── superpowers/specs/
```

---

## Verifica end-to-end

1. `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
2. `cd frontend && npm install && npm run dev`
3. Aprire `http://localhost:5173`
4. **Test compress:** caricare un JPEG, cliccare Elabora, verificare stat card con percentuale riduzione
5. **Test enhance:** switchare modalità, caricare un'immagine 1080p, scegliere 4×, verificare slider before/after
6. **Test batch:** caricare 3 file, verificare processing sequenziale e download ZIP
7. **Test errori:** caricare file >50MB, verificare messaggio errore inline
8. `GET http://localhost:8000/health` → `{"status":"ok"}`
