import type { FileEntry } from '../types'
import { FileItem } from './FileItem'

interface FileListProps {
  files: FileEntry[]
}

export function FileList({ files }: FileListProps) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {files.map(f => <FileItem key={f.id} entry={f} />)}
    </div>
  )
}
