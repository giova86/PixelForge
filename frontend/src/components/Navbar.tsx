import { useState } from 'react'
import type { ProcessingMode } from '../types'
import { AlgorithmsModal } from './AlgorithmsModal'

interface NavbarProps {
  mode: ProcessingMode
  onModeChange: (mode: ProcessingMode) => void
  backendOnline: boolean
}

const MODE_LABELS: Record<ProcessingMode, string> = {
  compress: 'Compress',
  enhance: 'Enhance',
  resize: 'Resize',
}

export function Navbar({ mode, onModeChange, backendOnline }: NavbarProps) {
  const [showAlgorithms, setShowAlgorithms] = useState(false)

  return (
    <>
      <nav className="relative flex items-center px-6 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            ✦
          </div>
          <span className="font-bold text-base tracking-tight"
                style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            PixelForge
          </span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex bg-[#1f2937] border border-[#374151] rounded-xl p-1 gap-1">
          {(['compress', 'enhance', 'resize'] as ProcessingMode[]).map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`w-24 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'text-[#111827] font-semibold'
                  : 'text-[#9ca3af] hover:text-[#e5e7eb]'
              }`}
              style={mode === m ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => setShowAlgorithms(true)}
            className="text-xs px-2.5 py-1 bg-[#1f2937] border border-[#374151] rounded-md text-[#6b7280] hover:text-[#e5e7eb] hover:border-[#4b5563] transition-colors"
          >
            Algorithms
          </button>
          <span className={`text-xs px-2.5 py-1 border rounded-md ${
            backendOnline
              ? 'bg-[#1f2937] border-[#065f46] text-[#34d399]'
              : 'bg-[#1f2937] border-[#7f1d1d] text-[#f87171]'
          }`}>
            {backendOnline ? '● Backend online' : '● Backend offline'}
          </span>
        </div>
      </nav>

      {showAlgorithms && <AlgorithmsModal onClose={() => setShowAlgorithms(false)} />}
    </>
  )
}
