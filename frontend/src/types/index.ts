export type ProcessingMode = 'compress' | 'enhance' | 'resize'
export type OutputFormat = 'original' | 'webp' | 'jpeg' | 'png'
export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface ProcessingSettings {
  quality: number
  scale: 1 | 2 | 4
  outputFormat: OutputFormat
  keepExif: boolean
}

export type ResizeMode = 'dimensions' | 'scale'

export interface ResizeSettings {
  mode: ResizeMode
  width: number
  height: number
  lockAspect: boolean
  scaleFactor: number
}

export interface JobResult {
  mode: ProcessingMode
  outputUrl: string
  outputFormat?: string
  // compress
  originalSize?: number
  compressedSize?: number
  savingPercent?: number
  // enhance
  scale?: number
  model?: string
  // resize
  originalWidth?: number
  originalHeight?: number
  outputWidth?: number
  outputHeight?: number
  outputSize?: number
}

export interface FileEntry {
  id: string
  file: File
  status: FileStatus
  jobId?: string
  result?: JobResult
  errorMessage?: string
  previewUrl: string
  width?: number
  height?: number
}

export interface SSEProgressEvent {
  step: string
  percent: number
}

export interface SSEDoneEvent {
  output_url: string
  mode: ProcessingMode
  // compress
  original_size?: number
  compressed_size?: number
  saving_percent?: number
  // enhance
  scale?: number
  model?: string
  // resize
  original_width?: number
  original_height?: number
  output_width?: number
  output_height?: number
  output_size?: number
  output_format?: string
}

export interface SSEErrorEvent {
  message: string
}
