import { useCallback, useRef, useState } from 'react'
import type { FileEntry } from '../types'

interface EnhanceResultProps {
  entry: FileEntry
}

export function EnhanceResult({ entry }: EnhanceResultProps) {
  const [sliderX, setSliderX] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const { result, previewUrl } = entry
  if (!result) return null

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setSliderX(pct)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) updateSlider(e.clientX)
  }, [updateSlider])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    updateSlider(e.touches[0].clientX)
  }, [updateSlider])

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none cursor-ew-resize min-h-0"
        onMouseDown={() => { dragging.current = true }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      >
        <img
          src={`${result.outputUrl}?t=${Date.now()}`}
          alt="Enhanced"
          className="absolute inset-0 w-full h-full object-contain bg-bg-panel"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
          <img src={previewUrl} alt="Original" className="w-full h-full object-contain bg-bg-base" />
        </div>
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
             style={{ left: `${sliderX}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-on-accent text-xs font-bold"
             style={{ left: `${sliderX}%` }}>
          ↔
        </div>
        <span className="absolute bottom-2 left-2 text-xs bg-black/60 rounded px-2 py-0.5 text-white">Before</span>
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-white">After</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-accent">Original</p>
          <p className="text-xs text-text-muted mt-0.5">Resolution</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-success">{result.scale}×</p>
          <p className="text-xs text-text-muted mt-0.5">Upscaled</p>
        </div>
        <div className="bg-bg-panel rounded-lg p-3 text-center">
          <p className="text-base font-bold text-info truncate">{result.model ?? 'Real-ESRGAN'}</p>
          <p className="text-xs text-text-muted mt-0.5">AI Model</p>
        </div>
      </div>
    </div>
  )
}
