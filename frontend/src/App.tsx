import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { ResizePanel } from './components/ResizePanel'
import { ResultPanel } from './components/ResultPanel'
import { UploadPanel } from './components/UploadPanel'
import { useFileQueue } from './hooks/useFileQueue'
import { useProcessing } from './hooks/useProcessing'
import { useResizeProcessing } from './hooks/useResizeProcessing'
import type { JobResult, ProcessingMode, ProcessingSettings, ResizeSettings } from './types'

const SESSION_ID = crypto.randomUUID()

const DEFAULT_SETTINGS: ProcessingSettings = {
  quality: 75,
  scale: 4,
  outputFormat: 'original',
  keepExif: true,
}

const DEFAULT_RESIZE_SETTINGS: ResizeSettings = {
  mode: 'dimensions',
  width: 800,
  height: 600,
  lockAspect: true,
  scaleFactor: 0.5,
}

export default function App() {
  const [mode, setMode] = useState<ProcessingMode>('compress')
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [resizeSettings, setResizeSettings] = useState<ResizeSettings>(DEFAULT_RESIZE_SETTINGS)
  const [backendOnline, setBackendOnline] = useState(false)

  const handleSettingsChange = useCallback((s: ProcessingSettings) => {
    setSettings(s)
    setSettingsDirty(true)
  }, [])

  const compressQueue = useFileQueue()
  const enhanceQueue = useFileQueue()
  const resizeQueue = useFileQueue()

  const [compressBatchId, setCompressBatchId] = useState(() => crypto.randomUUID())
  const [enhanceBatchId, setEnhanceBatchId] = useState(() => crypto.randomUUID())
  const [resizeBatchId, setResizeBatchId] = useState(() => crypto.randomUUID())
  const [compressProcessing, setCompressProcessing] = useState(false)
  const [enhanceProcessing, setEnhanceProcessing] = useState(false)
  const [resizeProcessing, setResizeProcessing] = useState(false)

  const compressCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  compressCallbacks.current = {
    onProgress: (id: string, _percent: number) => compressQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => compressQueue.setResult(id, result),
    onError: (id: string, message: string) => compressQueue.setError(id, message),
  }

  const enhanceCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  enhanceCallbacks.current = {
    onProgress: (id: string, _percent: number) => enhanceQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => enhanceQueue.setResult(id, result),
    onError: (id: string, message: string) => enhanceQueue.setError(id, message),
  }

  const resizeCallbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  resizeCallbacks.current = {
    onProgress: (id: string, _percent: number) => resizeQueue.updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => resizeQueue.setResult(id, result),
    onError: (id: string, message: string) => resizeQueue.setError(id, message),
  }

  const { processQueue: compressProcessQueue } = useProcessing(compressCallbacks, SESSION_ID, compressBatchId)
  const { processQueue: enhanceProcessQueue } = useProcessing(enhanceCallbacks, SESSION_ID, enhanceBatchId)
  const { processResize } = useResizeProcessing(resizeCallbacks, SESSION_ID)

  const activeQueue = mode === 'compress' ? compressQueue : mode === 'enhance' ? enhanceQueue : resizeQueue
  const activeBatchId = mode === 'compress' ? compressBatchId : mode === 'enhance' ? enhanceBatchId : resizeBatchId
  const activeProcessing = mode === 'compress' ? compressProcessing : mode === 'enhance' ? enhanceProcessing : resizeProcessing

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

  const handleResizeFile = useCallback((incoming: File[]) => {
    resizeQueue.addFiles(incoming)
  }, [resizeQueue.addFiles])

  const handleProcess = useCallback(async () => {
    const newBatchId = crypto.randomUUID()
    if (mode === 'compress') {
      setCompressBatchId(newBatchId)
      setCompressProcessing(true)
      const toProcess = compressQueue.resetAll()
      try {
        await compressProcessQueue(toProcess, mode, settings, newBatchId)
      } finally {
        setSettingsDirty(false)
        setCompressProcessing(false)
      }
    } else if (mode === 'enhance') {
      setEnhanceBatchId(newBatchId)
      setEnhanceProcessing(true)
      const toProcess = enhanceQueue.resetAll()
      try {
        await enhanceProcessQueue(toProcess, mode, settings, newBatchId)
      } finally {
        setSettingsDirty(false)
        setEnhanceProcessing(false)
      }
    } else {
      setResizeBatchId(newBatchId)
      setResizeProcessing(true)
      const toProcess = resizeQueue.resetAll()
      try {
        await processResize(toProcess, resizeSettings, newBatchId)
      } finally {
        setResizeProcessing(false)
      }
    }
  }, [mode, settings, resizeSettings, compressQueue.resetAll, enhanceQueue.resetAll, resizeQueue.resetAll, compressProcessQueue, enhanceProcessQueue, processResize])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar mode={mode} onModeChange={setMode} backendOnline={backendOnline} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-[#1f2937] overflow-hidden">
          {mode === 'resize' ? (
            <ResizePanel
              files={resizeQueue.files}
              resizeSettings={resizeSettings}
              onFiles={handleResizeFile}
              onResizeSettingsChange={setResizeSettings}
              onProcess={handleProcess}
              onClear={resizeQueue.clearAll}
              onRemove={resizeQueue.removeFile}
              processing={resizeProcessing}
            />
          ) : (
            <UploadPanel
              files={activeQueue.files}
              mode={mode}
              settings={settings}
              onFiles={activeQueue.addFiles}
              onSettingsChange={handleSettingsChange}
              onProcess={handleProcess}
              onClear={activeQueue.clearAll}
              onRemove={activeQueue.removeFile}
              processing={activeProcessing}
              settingsDirty={settingsDirty}
            />
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <ResultPanel files={activeQueue.files} mode={mode} />
        </div>
      </div>
      <Footer files={activeQueue.files} batchId={activeBatchId} />
    </div>
  )
}
