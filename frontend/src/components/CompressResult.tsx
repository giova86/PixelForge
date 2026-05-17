import type { FileEntry } from '../types'

interface CompressResultProps {
  entry: FileEntry
}

function formatBytes(b: number) {
  return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

export function CompressResult({ entry }: CompressResultProps) {
  const { result, previewUrl } = entry
  if (!result) return null
  const { originalSize = 0, compressedSize = 0, savingPercent = 0, outputUrl } = result

  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
      <div className="relative h-52 overflow-hidden">
        <img
          src={`${outputUrl}?t=${Date.now()}`}
          alt="Compressed"
          className="w-full h-full object-contain bg-[#111827]"
          onError={e => { (e.target as HTMLImageElement).src = previewUrl }}
        />
        <span className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-0.5 text-[#e5e7eb]">
          Anteprima compressa
        </span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#f59e0b]">{formatBytes(originalSize)}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Originale</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#34d399]">{formatBytes(compressedSize)}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Compresso</p>
        </div>
        <div className="bg-[#111827] rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#34d399]">−{savingPercent}%</p>
          <p className="text-xs text-[#6b7280] mt-0.5">Riduzione</p>
          <p className="text-xs text-[#4b5563]">{formatBytes(originalSize - compressedSize)} risparmiati</p>
        </div>
      </div>
    </div>
  )
}
