import { useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { FileEntry, FileStatus, JobResult } from '../types'

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'image/tiff', 'image/bmp', 'image/heic',
]
const MAX_SIZE_BYTES = 50 * 1024 * 1024

export function useFileQueue() {
  const [files, setFiles] = useState<FileEntry[]>([])

  const addFiles = useCallback((incoming: File[]) => {
    const entries: FileEntry[] = incoming
      .filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES)
      .map(f => ({
        id: uuidv4(),
        file: f,
        status: 'pending' as FileStatus,
        previewUrl: URL.createObjectURL(f),
      }))
    setFiles(prev => [...prev, ...entries])
  }, [])

  const updateStatus = useCallback((id: string, status: FileStatus, extra?: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, ...extra } : f))
  }, [])

  const setResult = useCallback((id: string, result: JobResult) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', result } : f))
  }, [])

  const setError = useCallback((id: string, message: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMessage: message } : f))
  }, [])

  const clearAll = useCallback(() => {
    setFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return [] })
  }, [])

  return { files, addFiles, updateStatus, setResult, setError, clearAll }
}
