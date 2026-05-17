import type { FileEntry } from '../types'

interface FileItemProps {
  entry: FileEntry
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function FileItem({ entry }: FileItemProps) {
  const statusEl = {
    pending: <span className="text-xs text-[#4b5563]">In coda</span>,
    processing: <span className="inline-block w-3.5 h-3.5 border-2 border-[#374151] border-t-[#f59e0b] rounded-full animate-spin" />,
    done: <span className="text-xs font-semibold text-[#f59e0b]">✓ Pronto</span>,
    error: <span className="text-xs text-[#f87171]">✗ Errore</span>,
  }[entry.status]

  return (
    <div className={`flex items-center gap-3 bg-[#1f2937] rounded-lg px-3 py-2.5 border ${
      entry.status === 'processing' ? 'border-[#f59e0b]/40' : 'border-[#374151]'
    }`}>
      <img src={entry.previewUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-[#e5e7eb]">{entry.file.name}</p>
        <p className="text-xs text-[#6b7280]">{formatBytes(entry.file.size)}</p>
        {entry.errorMessage && <p className="text-xs text-[#f87171] truncate">{entry.errorMessage}</p>}
      </div>
      <div className="flex-shrink-0">{statusEl}</div>
    </div>
  )
}
