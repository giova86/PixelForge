import { useState } from 'react'
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

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

export function Footer({ files, batchId }: FooterProps) {
  const [downloading, setDownloading] = useState(false)

  const total = files.reduce((s, f) => s + f.file.size, 0)
  const doneFiles = files.filter(f => f.status === 'done')
  const done = doneFiles.length
  const processing = files.filter(f => f.status === 'processing').length
  const pending = files.filter(f => f.status === 'pending').length
  const allSettled = processing === 0 && pending === 0

  const handleDownload = async () => {
    if (downloading) return
    if (done === 1) {
      const result = doneFiles[0].result
      if (!result?.outputUrl) return
      const ext = result.outputFormat
        ? `.${result.outputFormat === 'jpeg' ? 'jpg' : result.outputFormat}`
        : ''
      triggerDirectDownload(result.outputUrl, doneFiles[0].file.name.replace(/\.[^.]+$/, '') + ext)
    } else {
      setDownloading(true)
      try {
        const response = await fetch(`/download/batch/${batchId}`)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        triggerDirectDownload(url, `pixelforge_${batchId.slice(0, 8)}.zip`)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } finally {
        setDownloading(false)
      }
    }
  }

  const buttonLabel = done === 1
    ? 'Download'
    : `Download ZIP${done > 0 ? ` (${done} file${done > 1 ? 's' : ''})` : ''}`

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
        disabled={done === 0 || !allSettled || downloading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:brightness-110 active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
      >
        {downloading && <Spinner />}
        {downloading ? 'Preparing…' : buttonLabel}
      </button>
    </footer>
  )
}
