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
      <div className="flex items-center justify-between px-5 h-14 bg-bg-panel border-b border-border-subtle flex-shrink-0">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Uploaded Files</span>
        <div className="flex gap-2">
          {hasFiles && (
            <button onClick={onClear} className="text-xs px-3 py-1 bg-bg-elevated border border-border text-text-secondary rounded-md hover:text-text-primary transition-colors">
              Clear all
            </button>
          )}
          <button
            onClick={() => document.getElementById('file-input-trigger')?.click()}
            className="text-xs px-3 py-1 rounded-md border border-transparent text-on-accent font-semibold"
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
          <SettingsBox mode={mode} settings={settings} onChange={onSettingsChange} />
          <FileList files={files} onRemove={onRemove} />
        </div>
      )}

      {hasFiles && (
        <div className="flex-shrink-0 p-4 border-t border-border-subtle">
          <button
            onClick={onProcess}
            disabled={(!hasPending && !settingsDirty) || processing}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-on-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
          >
            {processing ? 'Processing…' : 'Process'}
          </button>
        </div>
      )}
    </div>
  )
}
