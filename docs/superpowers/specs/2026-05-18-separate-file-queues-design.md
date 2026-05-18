# Design: Code file separate per modalità (compress / enhance)

**Data:** 2026-05-18  
**Scope:** Frontend only — un solo file modificato (`App.tsx`)

---

## Problema

Attualmente esiste un unico `useFileQueue` condiviso tra le modalità "Comprimi" e "Migliora qualità". I file caricati in una modalità compaiono anche nell'altra, rendendo le due sezioni indistinguibili.

## Soluzione

Istanziare `useFileQueue()` due volte in `App.tsx` — una per compress, una per enhance — e selezionare la coda attiva in base al `mode` corrente.

---

## Architettura

### Stato in App.tsx

```ts
const compressQueue = useFileQueue()
const enhanceQueue  = useFileQueue()

const activeQueue = mode === 'compress' ? compressQueue : enhanceQueue
```

### batchId e processing per-mode

```ts
const [compressBatchId, setCompressBatchId] = useState(() => crypto.randomUUID())
const [enhanceBatchId,  setEnhanceBatchId]  = useState(() => crypto.randomUUID())

const [compressProcessing, setCompressProcessing] = useState(false)
const [enhanceProcessing,  setEnhanceProcessing]  = useState(false)

const activeBatchId   = mode === 'compress' ? compressBatchId  : enhanceBatchId
const activeProcessing = mode === 'compress' ? compressProcessing : enhanceProcessing
const setActiveBatchId   = mode === 'compress' ? setCompressBatchId  : setEnhanceBatchId
const setActiveProcessing = mode === 'compress' ? setCompressProcessing : setEnhanceProcessing
```

### Propagazione ai componenti

Tutti i componenti esistenti (`UploadPanel`, `ResultPanel`, `Footer`) continuano a ricevere le stesse props di prima — cambiano solo i valori passati, non le interfacce.

```tsx
<UploadPanel
  files={activeQueue.files}
  onFiles={activeQueue.addFiles}
  onClear={activeQueue.clearAll}
  onRemove={activeQueue.removeFile}
  processing={activeProcessing}
  ...
/>
<ResultPanel files={activeQueue.files} mode={mode} />
<Footer files={activeQueue.files} batchId={activeBatchId} />
```

---

## Comportamento atteso

| Azione | Risultato |
|--------|-----------|
| Carica file in "Comprimi" | Visibili solo nella tab Comprimi |
| Passa a "Migliora qualità" | Lista vuota (o con file propri se già caricati) |
| Torna a "Comprimi" | File ancora presenti con i loro risultati |
| "Cancella tutto" | Cancella solo la coda della tab attiva |
| Download ZIP | Scarica solo i job della tab attiva (filtro per `batchId`) |
| Elaborazione in una tab | Non blocca l'altra tab |

---

## File modificati

| File | Modifica |
|------|----------|
| `frontend/src/App.tsx` | Doppia istanza `useFileQueue`, stato per-mode |

Nessuna modifica a: hook, componenti figli, tipi, backend.

---

## Fuori scope

- Settings separate per modalità (quality, format, ecc.) — rimangono condivise
- Navbar o layout changes
