import type { FileEntry } from '../types'

interface ResultTabsProps {
  files: FileEntry[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ResultTabs({ files, activeId, onSelect }: ResultTabsProps) {
  const done = files.filter(f => f.status === 'done')
  if (done.length === 0) return null

  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1f2937] rounded-lg p-1 overflow-x-auto">
      {done.map(f => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            activeId === f.id
              ? 'bg-[#1f2937] text-[#f59e0b]'
              : 'text-[#6b7280] hover:text-[#e5e7eb]'
          }`}
        >
          {f.file.name.length > 16 ? f.file.name.slice(0, 14) + '…' : f.file.name}
        </button>
      ))}
    </div>
  )
}
