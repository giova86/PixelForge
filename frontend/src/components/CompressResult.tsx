import type { FileEntry } from '../types'

interface CompressResultProps {
  entry: FileEntry
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function CompressResult({ entry }: CompressResultProps) {
  const { result, previewUrl } = entry
  if (!result) return null
  const { originalSize = 0, compressedSize = 0, savingPercent = 0, outputUrl } = result

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 overflow-hidden min-h-0">
        <img
          src={`${outputUrl}?t=${Date.now()}`}
          alt="Compressed"
          className="w-full h-full object-contain bg-bg-panel"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-white">
          Compressed preview
        </span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-accent">{formatBytes(originalSize)}</p>
          <p className="text-xs text-text-muted mt-0.5">Original</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-success">{formatBytes(compressedSize)}</p>
          <p className="text-xs text-text-muted mt-0.5">Compressed</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-success">−{savingPercent}%</p>
          <p className="text-xs text-text-muted mt-0.5">Reduction</p>
          <p className="text-xs text-text-faint">{formatBytes(originalSize - compressedSize)} saved</p>
        </div>
      </div>
    </div>
  )
}
