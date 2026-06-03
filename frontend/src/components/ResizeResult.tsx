import type { FileEntry } from '../types'

interface ResizeResultProps {
  entry: FileEntry
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`
  return `${bytes} B`
}

export function ResizeResult({ entry }: ResizeResultProps) {
  const { result, previewUrl, file } = entry
  if (!result) return null

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 overflow-hidden min-h-0">
        <img
          src={`${result.outputUrl}?t=${Date.now()}`}
          alt="Resized"
          className="w-full h-full object-contain bg-bg-panel"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-accent">{result.originalWidth} × {result.originalHeight} <span className="font-normal text-text-muted">({fmtBytes(file.size)})</span></p>
          <p className="text-xs text-text-muted mt-0.5">Original</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-success">{result.outputWidth} × {result.outputHeight}{result.outputSize != null ? <span className="font-normal text-text-muted"> ({fmtBytes(result.outputSize)})</span> : ''}</p>
          <p className="text-xs text-text-muted mt-0.5">Output</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-sm font-bold text-info">Lanczos</p>
          <p className="text-xs text-text-muted mt-0.5">Method</p>
        </div>
      </div>
    </div>
  )
}
