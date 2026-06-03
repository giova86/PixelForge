import type { ProcessingMode, ProcessingSettings } from '../types'

interface SettingsBoxProps {
  mode: ProcessingMode
  settings: ProcessingSettings
  onChange: (s: ProcessingSettings) => void
}

export function SettingsBox({ mode, settings, onChange }: SettingsBoxProps) {
  const update = (patch: Partial<ProcessingSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4 flex flex-col gap-3">
      {mode === 'compress' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">Output quality</span>
          <div className="flex items-center gap-2.5">
            <input
              type="range" min={1} max={100} value={settings.quality}
              onChange={e => update({ quality: Number(e.target.value) })}
              className="w-28 accent-accent"
            />
            <span className="text-sm font-semibold text-accent w-8 text-right">{settings.quality}%</span>
          </div>
        </div>
      )}

      {mode === 'enhance' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">Upscaling scale</span>
          <div className="flex gap-1.5">
            {([1, 2, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => update({ scale: s })}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                  settings.scale === s
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-transparent text-text-secondary'
                }`}
              >{s === 1 ? '1× (enhance)' : `${s}×`}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">Output format</span>
        <select
          value={settings.outputFormat}
          onChange={e => update({ outputFormat: e.target.value as ProcessingSettings['outputFormat'] })}
          className="bg-bg-panel border border-border rounded-md px-2 py-1 text-sm text-accent font-semibold"
        >
          <option value="original">Original</option>
          <option value="webp">WebP</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">Keep EXIF metadata</span>
        <button
          onClick={() => update({ keepExif: !settings.keepExif })}
          className={`w-9 h-5 rounded-full transition-all relative ${settings.keepExif ? '' : 'bg-border'}`}
          style={settings.keepExif ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.keepExif ? 'right-0.5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
