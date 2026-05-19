import type { FileEntry } from '../types'
import { FileItem } from './FileItem'

interface FileListProps {
  files: FileEntry[]
  onRemove: (id: string) => void
}

export function FileList({ files, onRemove }: FileListProps) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {files.map(f => <FileItem key={f.id} entry={f} onRemove={onRemove} />)}
    </div>
  )
}
