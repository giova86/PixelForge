import { useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { FileEntry, FileStatus, JobResult } from '../types'

const ACCEPTED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/tiff', 'image/bmp', 'image/heic', 'image/heif',
])
const ACCEPTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'heic', 'heif'])
const MAX_SIZE_BYTES = 50 * 1024 * 1024

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

const isAccepted = (f: File) => {
  if (f.size > MAX_SIZE_BYTES) return false
  if (ACCEPTED_TYPES.has(f.type)) return true
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_EXTENSIONS.has(ext)
}

export function useFileQueue() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isAdding, setIsAdding] = useState(false)

  const addFiles = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return
    setIsAdding(true)
    // yield to the browser so the spinner can render before the heavy work
    await new Promise<void>(r => setTimeout(r, 0))
    const entries: FileEntry[] = await Promise.all(
      incoming.filter(isAccepted).map(async f => {
        const previewUrl = URL.createObjectURL(f)
        const { width, height } = await getImageDimensions(previewUrl)
        return {
          id: uuidv4(),
          file: f,
          status: 'pending' as FileStatus,
          previewUrl,
          width: width || undefined,
          height: height || undefined,
        }
      })
    )
    setFiles(prev => [...prev, ...entries])
    setIsAdding(false)
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

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(f => f.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    setFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return [] })
  }, [])

  const resetAll = useCallback((): FileEntry[] => {
    const reset = files.map(f => ({ ...f, status: 'pending' as FileStatus, result: undefined, errorMessage: undefined }))
    setFiles(reset)
    return reset
  }, [files])

  return { files, isAdding, addFiles, updateStatus, setResult, setError, removeFile, clearAll, resetAll }
}
