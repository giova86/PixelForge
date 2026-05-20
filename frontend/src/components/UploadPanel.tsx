import type { FileEntry, ProcessingMode, ProcessingSettings } from '../types'
import { DropZone } from './DropZone'
import { FileList } from './FileList'
import { SettingsBox } from './SettingsBox'

interface UploadPanelProps {
  files: FileEntry[]
  mode: ProcessingMode
  settings: ProcessingSettings
  onFiles: (files: File[]) => void
  onSettingsChange: (s: ProcessingSettings) => void
  onProcess: () => void
  onClear: () => void
  onRemove: (id: string) => void
  processing: boolean
  settingsDirty: boolean
  isAdding?: boolean
}

export function UploadPanel({ files, mode, settings, onFiles, onSettingsChange, onProcess, onClear, onRemove, processing, settingsDirty, isAdding = false }: UploadPanelProps) {
  const hasFiles = files.length > 0
  const hasPending = files.some(f => f.status === 'pending')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-14 bg-[#111827] border-b border-[#1f2937] flex-shrink-0">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Uploaded Files</span>
        <div className="flex gap-2">
          {hasFiles && (
            <button onClick={onClear} className="text-xs px-3 py-1 bg-[#1f2937] border border-[#374151] text-[#9ca3af] rounded-md hover:text-[#e5e7eb] transition-colors">
              Clear all
            </button>
          )}
          <button
            onClick={() => document.getElementById('file-input-trigger')?.click()}
            className="text-xs px-3 py-1 rounded-md border border-transparent text-[#111827] font-semibold"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            + Add
          </button>
        </div>
      </div>

      {!hasFiles ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-2/5">
            <DropZone onFiles={onFiles} isAdding={isAdding} />
          </div>
          <input id="file-input-trigger" type="file" multiple accept="image/*" className="hidden"
                 onChange={e => onFiles(Array.from(e.target.files ?? []))} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <DropZone onFiles={onFiles} isAdding={isAdding} />
          <input id="file-input-trigger" type="file" multiple accept="image/*" className="hidden"
                 onChange={e => onFiles(Array.from(e.target.files ?? []))} />
          <FileList files={files} onRemove={onRemove} />
          <SettingsBox mode={mode} settings={settings} onChange={onSettingsChange} />
        </div>
      )}

      {hasFiles && (
        <div className="flex-shrink-0 p-4 border-t border-[#1f2937]">
          <button
            onClick={onProcess}
            disabled={(!hasPending && !settingsDirty) || processing}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-[#111827] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            {processing ? 'Processing…' : 'Process'}
          </button>
        </div>
      )}
    </div>
  )
}
