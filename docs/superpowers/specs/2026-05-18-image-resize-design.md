# Design: Ridimensionamento immagine (Resize)

**Data:** 2026-05-18  
**Scope:** Frontend + Backend — nuova modalità `resize`

---

## Problema

L'app supporta compressione e miglioramento qualità, ma non il ridimensionamento. Gli utenti che vogliono cambiare le dimensioni in pixel di un'immagine devono usare strumenti esterni.

## Soluzione

Aggiungere una terza tab "Ridimensiona" con un flusso dedicato: upload singola immagine, visualizzazione dimensioni originali, input W/H con lock aspect ratio opzionale, elaborazione backend (PIL Lanczos), result panel before/after con dimensioni output.

---

## Architettura

### Nuovi tipi TypeScript

```ts
// ProcessingMode esteso
export type ProcessingMode = 'compress' | 'enhance' | 'resize'

// Nuova interfaccia per le impostazioni resize
export interface ResizeSettings {
  width: number
  height: number
  lockAspect: boolean
}

// JobResult esteso con dimensioni
export interface JobResult {
  // ... campi esistenti ...
  originalWidth?: number
  originalHeight?: number
  outputWidth?: number
  outputHeight?: number
}
```

### Frontend — componenti

| Componente | Tipo | Responsabilità |
|------------|------|----------------|
| `Navbar.tsx` | Modifica | Aggiunge terzo tab `resize` → label "Ridimensiona" |
| `ResizePanel.tsx` | Nuovo | Drop zone (1 file), dimensioni originali, input W/H, lock aspect ratio, pulsante Elabora |
| `ResizeResult.tsx` | Nuovo | Before/after slider + label "Originale: W×H px → Output: W×H px" |
| `App.tsx` | Modifica | Terza coda `resizeQueue`, terzo `resizeBatchId`/`resizeProcessing`, terzo `useProcessing` |

### Backend — nuovi file e modifiche

| File | Tipo | Responsabilità |
|------|------|----------------|
| `backend/services/resize.py` | Nuovo | `resize_image(data, width, height) -> bytes` con PIL Lanczos |
| `backend/routers/process.py` | Modifica | Nuovo endpoint `POST /resize` + task `_run_resize` |
| `backend/models/schemas.py` | Nessuna modifica | `JobStarted` esistente riutilizzato |

---

## Flusso dati dettagliato

1. Utente trascina un'immagine nella drop zone di `ResizePanel`
2. Il browser legge le dimensioni pixel client-side tramite `new Image()` (senza chiamata al backend)
3. I campi W e H vengono pre-popolati con le dimensioni originali; `lockAspect` è `true` di default
4. Utente modifica W o H:
   - Se `lockAspect = true`: il campo opposto si aggiorna proporzionalmente (arrotondato a intero ≥ 1)
   - Se `lockAspect = false`: i due campi sono indipendenti
5. Click "Elabora" → `POST /resize` multipart con `file`, `session_id`, `batch_id`, `width`, `height`
6. Backend elabora in executor (PIL Lanczos), salva output, aggiorna `_jobs`
7. SSE stream `/stream/{job_id}` (esistente, nessuna modifica)
8. `ResizeResult` mostra before/after slider + dimensioni
9. Download ZIP tramite `/download/batch/{batch_id}` (esistente, nessuna modifica)

---

## Comportamento UX

| Caso | Comportamento |
|------|---------------|
| Drop di un secondo file | Sostituisce il file precedente (una sola immagine alla volta) |
| W o H = 0 o vuoto | Pulsante "Elabora" disabilitato |
| `lockAspect = true`, cambio W | H = round(W × originalH / originalW), minimo 1 |
| `lockAspect = true`, cambio H | W = round(H × originalW / originalH), minimo 1 |
| `lockAspect = false` | W e H indipendenti, la deformazione è ammessa |
| Formato output | Dedotto dall'estensione del file di input tramite `_EXT_TO_FORMAT` (già usato in `process.py`); nessun selettore esposto all'utente |

---

## Backend — dettaglio endpoint

### `POST /resize`

Parametri form:
- `file: UploadFile`
- `session_id: str`
- `batch_id: str`
- `width: int` (≥ 1)
- `height: int` (≥ 1)

Risposta: `{ "job_id": "<uuid>" }` (schema `JobStarted` esistente)

Meta job in `_jobs` al completamento:
```python
{
  "status": "done",
  "output": out_path,
  "mime": mime_type,          # stesso MIME dell'input
  "session_id": session_id,
  "batch_id": batch_id,
  "original_stem": original_stem,
  "meta": {
    "mode": "resize",
    "original_width": original_width,
    "original_height": original_height,
    "output_width": width,
    "output_height": height,
  }
}
```

### `backend/services/resize.py`

```python
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

---

## SSE e download

Nessuna modifica a `/stream/{job_id}` e `/download/batch/{batch_id}`. Il meta `mode: "resize"` è sufficiente al frontend per mostrare `ResizeResult` al posto di `CompressResult`/`EnhanceResult`.

---

## Fuori scope

- Formato output diverso dall'originale
- Upload di più immagini in modalità resize
- Crop, rotazione, o altri trasformazioni geometriche
- Impostazioni di qualità per il resize
