import { useEffect, useRef, useState } from 'react'
import type { FileEntry, ResizeSettings } from '../types'
import { DropZone } from './DropZone'

interface ResizePanelProps {
  files: FileEntry[]
  resizeSettings: ResizeSettings
  onFiles: (files: File[]) => void
  onResizeSettingsChange: (s: ResizeSettings) => void
  onProcess: () => void
  onClear: () => void
  processing: boolean
}

export function ResizePanel({
  files, resizeSettings, onFiles, onResizeSettingsChange, onProcess, onClear, processing,
}: ResizePanelProps) {
  const file = files[0] ?? null
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)
  const lockAspectRef = useRef(resizeSettings.lockAspect)
  lockAspectRef.current = resizeSettings.lockAspect

  useEffect(() => {
    if (!file) { setOriginalDims(null); return }
    const img = new window.Image()
    img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = file.previewUrl
  }, [file?.id])

  useEffect(() => {
    if (!originalDims) return
    onResizeSettingsChange({ width: originalDims.w, height: originalDims.h, lockAspect: lockAspectRef.current })
  }, [originalDims, onResizeSettingsChange])

  const handleWidthChange = (newW: number) => {
    if (resizeSettings.lockAspect && originalDims && originalDims.w > 0) {
      const newH = Math.max(1, Math.round(newW * originalDims.h / originalDims.w))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      onResizeSettingsChange({ ...resizeSettings, width: newW })
    }
  }

  const handleHeightChange = (newH: number) => {
    if (resizeSettings.lockAspect && originalDims && originalDims.h > 0) {
      const newW = Math.max(1, Math.round(newH * originalDims.w / originalDims.h))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      onResizeSettingsChange({ ...resizeSettings, height: newH })
    }
  }

  const canProcess = !!file && resizeSettings.width >= 1 && resizeSettings.height >= 1 && !processing

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Immagine</span>
        {file && (
          <button
            onClick={onClear}
            className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors"
          >
            Rimuovi
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <DropZone onFiles={onFiles} />

        {file && originalDims && (
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-4">
            <p className="text-xs text-[#6b7280]">
              Dimensioni originali:{' '}
              <span className="text-[#9ca3af] font-semibold">{originalDims.w} × {originalDims.h} px</span>
            </p>

            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-[#9ca3af]">Larghezza (px)</label>
                <input
                  type="number"
                  min={1}
                  value={resizeSettings.width}
                  onChange={e => handleWidthChange(Math.max(1, Number(e.target.value) || 1))}
                  className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                />
              </div>

              <button
                onClick={() => onResizeSettingsChange({ ...resizeSettings, lockAspect: !resizeSettings.lockAspect })}
                title={resizeSettings.lockAspect ? 'Sblocca proporzioni' : 'Blocca proporzioni'}
                className={`mb-0.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                  resizeSettings.lockAspect
                    ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                    : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                }`}
              >
                {resizeSettings.lockAspect ? '= AR' : '/ AR'}
              </button>

              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-[#9ca3af]">Altezza (px)</label>
                <input
                  type="number"
                  min={1}
                  value={resizeSettings.height}
                  onChange={e => handleHeightChange(Math.max(1, Number(e.target.value) || 1))}
                  className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                />
              </div>
            </div>

            {file.status === 'error' && file.errorMessage && (
              <p className="text-xs text-[#f87171]">{file.errorMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
        <button
          onClick={onProcess}
          disabled={!canProcess}
          className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
        >
          {processing ? 'Ridimensionamento in corso…' : 'Ridimensiona'}
        </button>
      </div>
    </div>
  )
}
