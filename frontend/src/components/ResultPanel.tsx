import { useEffect, useState } from 'react'
import type { FileEntry, ProcessingMode } from '../types'
import { CompressResult } from './CompressResult'
import { EnhanceResult } from './EnhanceResult'
import { ResultTabs } from './ResultTabs'

interface ResultPanelProps {
  files: FileEntry[]
  mode: ProcessingMode
}

export function ResultPanel({ files, mode }: ResultPanelProps) {
  const done = files.filter(f => f.status === 'done')
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (done.length > 0 && !done.find(f => f.id === activeId)) {
      setActiveId(done[done.length - 1].id)
    }
  }, [done.length])

  const activeEntry = done.find(f => f.id === activeId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Risultato</span>
        <ResultTabs files={files} activeId={activeId} onSelect={setActiveId} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!activeEntry && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#4b5563]">
            <span className="text-4xl opacity-30">✦</span>
            <p className="text-sm">Elabora un&apos;immagine per vedere il risultato</p>
          </div>
        )}
        {activeEntry && mode === 'compress' && <CompressResult entry={activeEntry} />}
        {activeEntry && mode === 'enhance' && <EnhanceResult entry={activeEntry} />}
      </div>
    </div>
  )
}
