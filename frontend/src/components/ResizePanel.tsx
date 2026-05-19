import { useEffect, useRef, useState } from 'react'
import type { FileEntry, ResizeSettings } from '../types'
import { DropZone } from './DropZone'
import { FileItem } from './FileItem'

interface ResizePanelProps {
  files: FileEntry[]
  resizeSettings: ResizeSettings
  onFiles: (files: File[]) => void
  onResizeSettingsChange: (s: ResizeSettings) => void
  onProcess: () => void
  onClear: () => void
  onRemove: (id: string) => void
  processing: boolean
  isAdding?: boolean
}

export function ResizePanel({
  files, resizeSettings, onFiles, onResizeSettingsChange, onProcess, onClear, onRemove, processing, isAdding = false,
}: ResizePanelProps) {
  const firstFile = files[0] ?? null
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)

  const lockAspectRef = useRef(resizeSettings.lockAspect)
  lockAspectRef.current = resizeSettings.lockAspect
  const modeRef = useRef(resizeSettings.mode)
  modeRef.current = resizeSettings.mode
  const scaleFactorRef = useRef(resizeSettings.scaleFactor)
  scaleFactorRef.current = resizeSettings.scaleFactor

  const aspectRatioRef = useRef<number | null>(null)

  const [localW, setLocalW] = useState(() => String(resizeSettings.width))
  const [localH, setLocalH] = useState(() => String(resizeSettings.height))

  useEffect(() => { setLocalW(String(resizeSettings.width)) }, [resizeSettings.width])
  useEffect(() => { setLocalH(String(resizeSettings.height)) }, [resizeSettings.height])

  useEffect(() => {
    if (!firstFile) { setOriginalDims(null); return }
    const img = new window.Image()
    img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setOriginalDims(null)
    img.src = firstFile.previewUrl
  }, [firstFile?.id])

  useEffect(() => {
    if (!originalDims) return
    aspectRatioRef.current = originalDims.h / originalDims.w
    onResizeSettingsChange({
      mode: modeRef.current,
      width: originalDims.w,
      height: originalDims.h,
      lockAspect: lockAspectRef.current,
      scaleFactor: scaleFactorRef.current,
    })
  }, [originalDims, onResizeSettingsChange])

  const handleWidthChange = (newW: number) => {
    if (resizeSettings.lockAspect && aspectRatioRef.current !== null) {
      const newH = Math.max(1, Math.round(newW * aspectRatioRef.current))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      if (!resizeSettings.lockAspect) aspectRatioRef.current = resizeSettings.height / newW
      onResizeSettingsChange({ ...resizeSettings, width: newW })
    }
  }

  const handleHeightChange = (newH: number) => {
    if (resizeSettings.lockAspect && aspectRatioRef.current !== null) {
      const newW = Math.max(1, Math.round(newH / aspectRatioRef.current))
      onResizeSettingsChange({ ...resizeSettings, width: newW, height: newH })
    } else {
      if (!resizeSettings.lockAspect) aspectRatioRef.current = newH / resizeSettings.width
      onResizeSettingsChange({ ...resizeSettings, height: newH })
    }
  }

  const canProcess = files.length > 0 && !processing && (
    resizeSettings.mode === 'scale' || (resizeSettings.width >= 1 && resizeSettings.height >= 1)
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Uploaded files</span>
        <div className="flex gap-2">
          {files.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => document.getElementById('file-input-resize')?.click()}
            className="text-xs px-3 py-1 rounded-md border border-transparent text-[#111827] font-semibold"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            + Add
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-2/5">
            <DropZone onFiles={onFiles} isAdding={isAdding} />
          </div>
          <input
            id="file-input-resize"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => onFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <DropZone onFiles={onFiles} isAdding={isAdding} />
          <input
            id="file-input-resize"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => onFiles(Array.from(e.target.files ?? []))}
          />

          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {files.map(f => <FileItem key={f.id} entry={f} onRemove={onRemove} />)}
            </div>
          )}

          {firstFile && (
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 flex flex-col gap-4">
              {/* Reference dims (only in dimensions mode when loaded) */}
              {resizeSettings.mode === 'dimensions' && originalDims && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#6b7280]">
                    Reference:{' '}
                    <span className="text-[#9ca3af] font-semibold">{originalDims.w} × {originalDims.h} px</span>
                  </p>
                  {files.length > 1 && (
                    <span className="text-xs text-[#6b7280]">→ applied to {files.length} files</span>
                  )}
                </div>
              )}

              {/* Mode selector */}
              <div className="flex gap-2">
                {(['dimensions', 'scale'] as const).map(m => (
                  <label
                    key={m}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-md border cursor-pointer text-xs font-semibold transition-all ${
                      resizeSettings.mode === m
                        ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                        : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resize-mode"
                      value={m}
                      checked={resizeSettings.mode === m}
                      onChange={() => onResizeSettingsChange({ ...resizeSettings, mode: m })}
                      className="hidden"
                    />
                    {m === 'dimensions' ? 'Dimensioni' : 'Scala'}
                  </label>
                ))}
              </div>

              {/* Conditional controls */}
              {resizeSettings.mode === 'dimensions' ? (
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-[#9ca3af]">Width (px)</label>
                    <input
                      type="number"
                      min={1}
                      value={localW}
                      onChange={e => {
                        const str = e.target.value
                        setLocalW(str)
                        const n = parseInt(str, 10)
                        if (!isNaN(n) && n >= 1) handleWidthChange(n)
                      }}
                      className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                    />
                  </div>

                  <button
                    onClick={() => onResizeSettingsChange({ ...resizeSettings, lockAspect: !resizeSettings.lockAspect })}
                    title={resizeSettings.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                    className={`mb-0.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                      resizeSettings.lockAspect
                        ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                        : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                    }`}
                  >
                    {resizeSettings.lockAspect ? '= AR' : '/ AR'}
                  </button>

                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-[#9ca3af]">Height (px)</label>
                    <input
                      type="number"
                      min={1}
                      value={localH}
                      onChange={e => {
                        const str = e.target.value
                        setLocalH(str)
                        const n = parseInt(str, 10)
                        if (!isNaN(n) && n >= 1) handleHeightChange(n)
                      }}
                      className="bg-[#111827] border border-[#374151] rounded-md px-3 py-1.5 text-sm text-[#e5e7eb] w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {([
                    { factor: 0.5 as const, label: '1/2' },
                    { factor: 1/3, label: '1/3' },
                    { factor: 0.25 as const, label: '1/4' },
                  ]).map(({ factor, label }) => (
                    <button
                      key={label}
                      onClick={() => onResizeSettingsChange({ ...resizeSettings, scaleFactor: factor })}
                      className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                        resizeSettings.scaleFactor === factor
                          ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#f59e0b]'
                          : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
          <button
            onClick={onProcess}
            disabled={!canProcess}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            {processing
              ? 'Resizing…'
              : files.length > 1
                ? `Resize ${files.length} images`
                : 'Resize'}
          </button>
        </div>
      )}
    </div>
  )
}
