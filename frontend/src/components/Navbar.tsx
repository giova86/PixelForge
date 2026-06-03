import { useState } from 'react'
import type { ProcessingMode } from '../types'
import { useTheme } from '../hooks/useTheme'
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
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <nav className="relative flex items-center px-6 h-14 bg-bg-panel border-b border-border-subtle flex-shrink-0">
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

        <div className="absolute left-1/2 -translate-x-1/2 flex bg-bg-elevated border border-border rounded-xl p-1 gap-1">
          {(['compress', 'enhance', 'resize'] as ProcessingMode[]).map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`w-24 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'text-on-accent font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              style={mode === m ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label="Toggle color theme"
            className="w-7 h-7 flex items-center justify-center text-sm bg-bg-elevated border border-border rounded-md text-text-muted hover:text-text-primary hover:border-text-faint transition-colors"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            onClick={() => setShowAlgorithms(true)}
            className="text-xs px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-text-muted hover:text-text-primary hover:border-text-faint transition-colors"
          >
            Algorithms
          </button>
          <span className={`text-xs px-2.5 py-1 border rounded-md ${
            backendOnline
              ? 'bg-bg-elevated border-[#065f46] text-success'
              : 'bg-bg-elevated border-[#7f1d1d] text-error'
          }`}>
            {backendOnline ? '● Backend online' : '● Backend offline'}
          </span>
        </div>
      </nav>

      {showAlgorithms && <AlgorithmsModal onClose={() => setShowAlgorithms(false)} />}
    </>
  )
}
