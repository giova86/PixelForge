import { useCallback } from 'react'
import type { FileEntry, JobResult } from '../types'

interface ProcessingCallbacks {
  onProgress: (id: string, percent: number) => void
  onDone: (id: string, result: JobResult) => void
  onError: (id: string, message: string) => void
}

export function useResizeProcessing(
  callbacks: React.MutableRefObject<ProcessingCallbacks>,
  sessionId: string,
) {
  const processResize = useCallback(async (
    entries: FileEntry[],
    width: number,
    height: number,
    batchId: string,
  ) => {
    for (const entry of entries) {
      await new Promise<void>(async (resolve) => {
        const form = new FormData()
        form.append('file', entry.file)
        form.append('session_id', sessionId)
        form.append('batch_id', batchId)
        form.append('width', String(width))
        form.append('height', String(height))

        let jobId: string
        try {
          const res = await fetch('/resize', { method: 'POST', body: form })
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
            mode: 'resize',
            outputUrl: data.output_url,
            outputFormat: data.output_format,
            originalWidth: data.original_width,
            originalHeight: data.original_height,
            outputWidth: data.output_width,
            outputHeight: data.output_height,
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

  return { processResize }
}
