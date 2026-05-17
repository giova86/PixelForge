import { useCallback } from 'react'
import type { FileEntry, JobResult, ProcessingSettings } from '../types'

interface ProcessingCallbacks {
  onProgress: (id: string, percent: number) => void
  onDone: (id: string, result: JobResult) => void
  onError: (id: string, message: string) => void
}

export function useProcessing(
  callbacks: React.MutableRefObject<ProcessingCallbacks>,
  sessionId: string,
) {
  const processQueue = useCallback(async (
    entries: FileEntry[],
    mode: 'compress' | 'enhance',
    settings: ProcessingSettings,
  ) => {
    for (const entry of entries.filter(e => e.status === 'pending')) {
      await new Promise<void>(async (resolve) => {
        const form = new FormData()
        form.append('file', entry.file)
        form.append('session_id', sessionId)
        form.append('mode', mode)
        form.append('quality', String(settings.quality))
        form.append('scale', String(settings.scale))
        form.append('output_format', settings.outputFormat)
        form.append('keep_exif', String(settings.keepExif))

        let jobId: string
        try {
          const res = await fetch('/process', { method: 'POST', body: form })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          jobId = json.job_id
        } catch {
          callbacks.current.onError(entry.id, 'Failed to start job')
          resolve()
          return
        }

        const es = new EventSource(`/stream/${jobId}`)

        es.addEventListener('progress', (e) => {
          const data = JSON.parse((e as MessageEvent).data)
          callbacks.current.onProgress(entry.id, data.percent)
        })

        es.addEventListener('done', (e) => {
          const data = JSON.parse((e as MessageEvent).data)
          es.close()
          const result: JobResult = {
            mode,
            outputUrl: data.output_url,
            originalSize: data.original_size,
            compressedSize: data.compressed_size,
            savingPercent: data.saving_percent,
            scale: data.scale,
            model: data.model,
          }
          callbacks.current.onDone(entry.id, result)
          resolve()
        })

        es.addEventListener('error', (e) => {
          const raw = (e as MessageEvent).data
          const data = raw ? JSON.parse(raw) : { message: 'Stream error' }
          es.close()
          callbacks.current.onError(entry.id, data.message)
          resolve()
        })
      })
    }
  }, [callbacks, sessionId])

  return { processQueue }
}
