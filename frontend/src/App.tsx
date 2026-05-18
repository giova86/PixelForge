import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { ResultPanel } from './components/ResultPanel'
import { UploadPanel } from './components/UploadPanel'
import { useFileQueue } from './hooks/useFileQueue'
import { useProcessing } from './hooks/useProcessing'
import type { JobResult, ProcessingMode, ProcessingSettings } from './types'

const SESSION_ID = crypto.randomUUID()

const DEFAULT_SETTINGS: ProcessingSettings = {
  quality: 75,
  scale: 4,
  outputFormat: 'original',
  keepExif: true,
}

export default function App() {
  const [mode, setMode] = useState<ProcessingMode>('compress')
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [backendOnline, setBackendOnline] = useState(false)

  const compressQueue = useFileQueue()
  const enhanceQueue = useFileQueue()

  const [compressBatchId, setCompressBatchId] = useState(() => crypto.randomUUID())
  const [enhanceBatchId, setEnhanceBatchId] = useState(() => crypto.randomUUID())
  const [compressProcessing, setCompressProcessing] = useState(false)
  const [enhanceProcessing, setEnhanceProcessing] = useState(false)

  const compressCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  compressCallbacks.current = useMemo(() => ({
    onProgress: (id: string, _percent: number) => compressQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => compressQueue.setResult(id, result),
    onError: (id: string, message: string) => compressQueue.setError(id, message),
  }), [compressQueue.updateStatus, compressQueue.setResult, compressQueue.setError])

  const enhanceCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  enhanceCallbacks.current = useMemo(() => ({
    onProgress: (id: string, _percent: number) => enhanceQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => enhanceQueue.setResult(id, result),
    onError: (id: string, message: string) => enhanceQueue.setError(id, message),
  }), [enhanceQueue.updateStatus, enhanceQueue.setResult, enhanceQueue.setError])

  const { processQueue: compressProcessQueue } = useProcessing(compressCallbacks, SESSION_ID, compressBatchId)
  const { processQueue: enhanceProcessQueue } = useProcessing(enhanceCallbacks, SESSION_ID, enhanceBatchId)

  const activeQueue = mode === 'compress' ? compressQueue : enhanceQueue
  const activeBatchId = mode === 'compress' ? compressBatchId : enhanceBatchId
  const activeProcessing = mode === 'compress' ? compressProcessing : enhanceProcessing

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/health')
        setBackendOnline(r.ok)
      } catch {
        setBackendOnline(false)
      }
    }
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [])

  const handleProcess = useCallback(async () => {
    const newBatchId = crypto.randomUUID()
    if (mode === 'compress') {
      setCompressBatchId(newBatchId)
      setCompressProcessing(true)
      const toProcess = compressQueue.resetAll()
      await compressProcessQueue(toProcess, mode, settings, newBatchId)
      setCompressProcessing(false)
    } else {
      setEnhanceBatchId(newBatchId)
      setEnhanceProcessing(true)
      const toProcess = enhanceQueue.resetAll()
      await enhanceProcessQueue(toProcess, mode, settings, newBatchId)
      setEnhanceProcessing(false)
    }
  }, [mode, settings, compressQueue, enhanceQueue, compressProcessQueue, enhanceProcessQueue])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar mode={mode} onModeChange={setMode} backendOnline={backendOnline} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-[#1f2937] overflow-hidden">
          <UploadPanel
            files={activeQueue.files}
            mode={mode}
            settings={settings}
            onFiles={activeQueue.addFiles}
            onSettingsChange={setSettings}
            onProcess={handleProcess}
            onClear={activeQueue.clearAll}
            onRemove={activeQueue.removeFile}
            processing={activeProcessing}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ResultPanel files={activeQueue.files} mode={mode} />
        </div>
      </div>
      <Footer files={activeQueue.files} batchId={activeBatchId} />
    </div>
  )
}
