import type { FileEntry } from '../types'

interface FooterProps {
  files: FileEntry[]
  batchId: string
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

function triggerDirectDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function Footer({ files, batchId }: FooterProps) {
  const total = files.reduce((s, f) => s + f.file.size, 0)
  const doneFiles = files.filter(f => f.status === 'done')
  const done = doneFiles.length
  const processing = files.filter(f => f.status === 'processing').length
  const pending = files.filter(f => f.status === 'pending').length
  const allSettled = processing === 0 && pending === 0

  const handleDownload = () => {
    if (done === 1) {
      const result = doneFiles[0].result
      if (!result?.outputUrl) return
      const ext = result.outputFormat
        ? `.${result.outputFormat === 'jpeg' ? 'jpg' : result.outputFormat}`
        : ''
      triggerDirectDownload(result.outputUrl, doneFiles[0].file.name.replace(/\.[^.]+$/, '') + ext)
    } else {
      triggerDirectDownload(`/download/batch/${batchId}`, `pixelforge_${batchId.slice(0, 8)}.zip`)
    }
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
            <span>{done} processed · {processing} in progress · {pending} queued</span>
          </>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={done === 0 || !allSettled}
        className="px-4 py-2 rounded-lg text-xs font-bold text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
      >
        {done === 1
          ? 'Download'
          : `Download ZIP${done > 0 ? ` (${done} file${done > 1 ? 's' : ''})` : ''}`}
      </button>
    </footer>
  )
}
