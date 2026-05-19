# Resize: modalità fattore di scala

**Data:** 2026-05-19  
**Stato:** approvato

## Obiettivo

Aggiungere al pannello Resize una seconda modalità di ridimensionamento — **Scala** — che affianca la modalità **Dimensioni** già esistente. L'utente sceglie tra:

- **Dimensioni**: inserisce width e height in pixel (comportamento attuale, invariato)
- **Scala**: sceglie uno tra i fattori `1/2`, `1/3`, `1/4`; ogni immagine viene ridimensionata rispetto alle proprie dimensioni originali

La modalità scala permette di ridimensionare batch eterogenei (immagini con aspect ratio o risoluzioni diverse) in modo proporzionalmente corretto senza deformarle.

---

## Tipi TypeScript (`frontend/src/types/index.ts`)

```ts
export type ResizeMode = 'dimensions' | 'scale'

export interface ResizeSettings {
  mode: ResizeMode          // aggiunto
  width: number
  height: number
  lockAspect: boolean
  scaleFactor: 0.5 | 0.333 | 0.25   // aggiunto; usato solo quando mode === 'scale'
}
```

Il valore di default di `mode` è `'dimensions'` (backward-compatible con lo stato iniziale in `App.tsx`).

---

## UI — `ResizePanel.tsx`

Il box impostazioni (il `div` con classe `bg-[#1f2937]`) viene modificato come segue.

### Selettore di modalità

Due radio pill in cima al box, prima degli input:

```
● Dimensioni    ○ Scala
```

- Stile: due `<label>` con `<input type="radio">` nascosto, pill con bordo.
- Attivo: bordo e testo amber (`#f59e0b`), background `#f59e0b/15`.
- Inattivo: bordo `#374151`, testo `#6b7280`.

### Contenuto condizionale

**Quando `mode === 'dimensions'`** — mostra gli input width/AR/height attuali, nessuna variazione.

**Quando `mode === 'scale'`** — nasconde gli input e mostra tre pulsanti:

```
[ 1/2 ]  [ 1/3 ]  [ 1/4 ]
```

- Stile: stesso dei radio pill sopra; quello selezionato ha bordo/testo amber.
- Cliccarne uno aggiorna `resizeSettings.scaleFactor`.
- Selezionato di default: `0.5` (1/2).

### `canProcess`

In modalità scala, `canProcess` è `true` se ci sono file caricati e non si sta processando (non serve validare width/height).

---

## Hook — `useResizeProcessing.ts`

La firma del callback `processResize` riceve l'intero `ResizeSettings` anziché `width` e `height` separati:

```ts
processResize(entries: FileEntry[], settings: ResizeSettings, batchId: string)
```

Logica di invio:

```ts
if (settings.mode === 'scale') {
  form.append('scale_factor', String(settings.scaleFactor))
} else {
  form.append('width', String(settings.width))
  form.append('height', String(settings.height))
}
```

---

## Backend — `routers/process.py`

### Endpoint `/resize`

I parametri `width` e `height` diventano opzionali; si aggiunge `scale_factor`:

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
```

**Validazione:** se né `(width, height)` né `scale_factor` sono presenti, restituisce HTTP 422 con messaggio `"Provide either width+height or scale_factor"`.

### Runner `_run_resize`

Firma estesa:

```python
async def _run_resize(
    job_id, input_path, output_format, session_id, batch_id,
    width=None, height=None, scale_factor=None
)
```

Se `scale_factor` è presente, le dimensioni vengono calcolate dopo la lettura dell'immagine originale:

```python
if scale_factor is not None:
    width = max(1, round(original_width * scale_factor))
    height = max(1, round(original_height * scale_factor))
```

Da quel punto in poi il flusso è identico a quello attuale (`resize_image(data, width, height, output_format)`).

### `meta` del job

`output_width` e `output_height` vengono sempre popolati con le dimensioni effettive dell'output — comportamento invariato.

---

## Componente `App.tsx`

Stato iniziale di `resizeSettings` aggiornato:

```ts
const [resizeSettings, setResizeSettings] = useState<ResizeSettings>({
  mode: 'dimensions',
  width: 800,
  height: 600,
  lockAspect: true,
  scaleFactor: 0.5,
})
```

La prop `onProcess` per il resize chiama `processResize(files, resizeSettings, batchId)` con il nuovo signature.

---

## File modificati

| File | Tipo di modifica |
|------|-----------------|
| `frontend/src/types/index.ts` | Aggiunge `ResizeMode`, estende `ResizeSettings` |
| `frontend/src/components/ResizePanel.tsx` | Aggiunge selettore radio + pulsanti scala |
| `frontend/src/hooks/useResizeProcessing.ts` | Riceve `ResizeSettings`, invia `scale_factor` o `width`/`height` |
| `frontend/src/App.tsx` | Aggiorna stato iniziale e firma callback |
| `backend/routers/process.py` | Rende `width`/`height` opzionali, aggiunge `scale_factor`, validazione |

---

## Casi limite

- **Scale factor con immagini molto piccole:** `max(1, round(...))` garantisce almeno 1×1 px.
- **Batch eterogeneo:** ogni file usa le proprie dimensioni originali moltiplicato per il fattore, non quelle del file di riferimento.
- **Switching modalità:** passare da Scala a Dimensioni ripristina i campi width/height ai valori precedenti (già in stato, non azzerati).
