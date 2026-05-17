import { useRef } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
}

export function DropZone({ onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-[#374151] rounded-xl p-8 flex flex-col items-center gap-2 bg-[#111827] cursor-pointer hover:border-[#f59e0b] transition-colors"
    >
      <span className="text-3xl opacity-40">⬆</span>
      <p className="text-sm text-[#6b7280] text-center">
        Trascina le immagini qui<br />
        <span style={{ color: '#f59e0b' }}>o clicca per scegliere</span>
      </p>
      <p className="text-xs text-[#4b5563]">JPEG · PNG · WebP · TIFF · BMP · HEIC</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => onFiles(Array.from(e.target.files ?? []))}
      />
    </div>
  )
}
