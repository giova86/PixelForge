export type ProcessingMode = 'compress' | 'enhance'
export type OutputFormat = 'webp' | 'jpeg' | 'png'
export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ProcessingSettings {
  quality: number
  scale: 2 | 4
  outputFormat: OutputFormat
  keepExif: boolean
}

export interface JobResult {
  mode: ProcessingMode
  outputUrl: string
  // compress
  originalSize?: number
  compressedSize?: number
  savingPercent?: number
  // enhance
  scale?: number
  model?: string
}

export interface FileEntry {
  id: string
  file: File
  status: FileStatus
  jobId?: string
  result?: JobResult
  errorMessage?: string
  previewUrl: string
}

export interface SSEProgressEvent {
  step: string
  percent: number
}

export interface SSEDoneEvent {
  output_url: string
  mode: ProcessingMode
  original_size?: number
  compressed_size?: number
  saving_percent?: number
  scale?: number
  model?: string
}

export interface SSEErrorEvent {
  message: string
}
