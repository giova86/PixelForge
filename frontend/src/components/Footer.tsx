import type { FileEntry } from '../types'

interface FooterProps {
  files: FileEntry[]
  sessionId: string
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function Footer({ files, sessionId }: FooterProps) {
  const total = files.reduce((s, f) => s + f.file.size, 0)
  const done = files.filter(f => f.status === 'done').length
  const processing = files.filter(f => f.status === 'processing').length
  const pending = files.filter(f => f.status === 'pending').length

  const handleDownload = () => {
    window.open(`/download/${sessionId}`, '_blank')
  }

  return (
    <footer className="flex items-center justify-between px-6 py-2.5 bg-[#111827] border-t border-[#1f2937] flex-shrink-0">
      <div className="flex items-center gap-5 text-xs text-[#4b5563]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
          Backend FastAPI · SSE
        </span>
        {files.length > 0 && (
          <>
            <span>{files.length} file · {formatBytes(total)}</span>
            <span>{done} elaborati · {processing} in corso · {pending} in coda</span>
          </>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={done === 0}
        className="px-4 py-2 rounded-lg text-xs font-bold text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
      >
        ⬇ Scarica ZIP {done > 0 ? `(${done} file)` : ''}
      </button>
    </footer>
  )
}
