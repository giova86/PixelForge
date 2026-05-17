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
  quality: 85,
  scale: 4,
  outputFormat: 'webp',
  keepExif: true,
}

export default function App() {
  const [mode, setMode] = useState<ProcessingMode>('compress')
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [processing, setProcessing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)

  const { files, addFiles, updateStatus, setResult, setError, clearAll } = useFileQueue()

  const callbacks = useRef({
    onProgress: (_id: string, _percent: number) => {},
    onDone: (_id: string, _result: JobResult) => {},
    onError: (_id: string, _message: string) => {},
  })
  callbacks.current = useMemo(() => ({
    onProgress: (id: string, _percent: number) => updateStatus(id, 'processing'),
    onDone: (id: string, result: JobResult) => setResult(id, result),
    onError: (id: string, message: string) => setError(id, message),
  }), [updateStatus, setResult, setError])

  const { processQueue } = useProcessing(callbacks, SESSION_ID)

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
    setProcessing(true)
    await processQueue(files, mode, settings)
    setProcessing(false)
  }, [files, mode, settings, processQueue])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar mode={mode} onModeChange={setMode} backendOnline={backendOnline} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-[#1f2937] overflow-hidden">
          <UploadPanel
            files={files}
            mode={mode}
            settings={settings}
            onFiles={addFiles}
            onSettingsChange={setSettings}
            onProcess={handleProcess}
            onClear={clearAll}
            processing={processing}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ResultPanel files={files} mode={mode} />
        </div>
      </div>
      <Footer files={files} sessionId={SESSION_ID} />
    </div>
  )
}
