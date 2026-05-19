import { useEffect, useState } from 'react'
import type { FileEntry, ProcessingMode } from '../types'
import { CompressResult } from './CompressResult'
import { EnhanceResult } from './EnhanceResult'
import { ResizeResult } from './ResizeResult'

interface ResultPanelProps {
  files: FileEntry[]
  mode: ProcessingMode
}

export function ResultPanel({ files, mode }: ResultPanelProps) {
  const done = files.filter(f => f.status === 'done')
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (done.length > 0) {
      setActiveId(done[done.length - 1].id)
    }
  }, [done.length])

  const activeEntry = done.find(f => f.id === activeId)
  const activeIndex = done.findIndex(f => f.id === activeId)

  const goToPrev = () => { if (activeIndex > 0) setActiveId(done[activeIndex - 1].id) }
  const goToNext = () => { if (activeIndex < done.length - 1) setActiveId(done[activeIndex + 1].id) }

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex items-center px-5 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Result</span>
        {activeEntry && (
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-[#f59e0b] font-medium max-w-[40%] truncate">
            {activeEntry.file.name}
          </span>
        )}
        {done.length > 1 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[#6b7280]">{activeIndex + 1} / {done.length}</span>
            <div className="flex gap-1">
              <button
                onClick={goToPrev}
                disabled={activeIndex <= 0}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[#374151] text-[#9ca3af] hover:text-[#e5e7eb] hover:border-[#4b5563] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              >
                ‹
              </button>
              <button
                onClick={goToNext}
                disabled={activeIndex >= done.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[#374151] text-[#9ca3af] hover:text-[#e5e7eb] hover:border-[#4b5563] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {!activeEntry && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#4b5563]">
            <span className="text-4xl opacity-30">✦</span>
            <p className="text-sm">Process an image to see the result</p>
          </div>
        )}
        {activeEntry && mode === 'compress' && <CompressResult entry={activeEntry} />}
        {activeEntry && mode === 'enhance' && <EnhanceResult entry={activeEntry} />}
        {activeEntry && mode === 'resize' && <ResizeResult entry={activeEntry} />}
      </div>
    </div>
  )
}
