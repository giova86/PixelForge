import { useRef } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  isAdding?: boolean
}

export function DropZone({ onFiles, isAdding = false }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isAdding) onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="relative">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => { if (!isAdding) inputRef.current?.click() }}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 bg-bg-panel transition-colors ${
          isAdding ? 'border-accent cursor-wait' : 'border-border cursor-pointer hover:border-accent'
        }`}
      >
        <span className="text-3xl opacity-40">⬆</span>
        <p className="text-sm text-text-muted text-center">
          Drag images here<br />
          <span style={{ color: '#f59e0b' }}>or click to choose</span>
        </p>
        <p className="text-xs text-text-faint">JPEG · PNG · WebP · TIFF · BMP · HEIC</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => onFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {isAdding && (
        <div className="absolute inset-0 bg-bg-panel/75 rounded-xl flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">Loading files…</span>
        </div>
      )}
    </div>
  )
}
