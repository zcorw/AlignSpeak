import api from './api'

export interface CreateTtsJobResult {
  jobId: string
  status: 'queued' | 'processing' | 'done' | 'failed'
}

export interface TtsJobStatusResult {
  jobId: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  audioUrl?: string
  cached?: boolean
  errorCode?: string
}

interface CreateTtsJobResponse {
  job_id: string
  status: CreateTtsJobResult['status']
}

interface TtsJobStatusResponse {
  job_id: string
  status: TtsJobStatusResult['status']
  audio_url?: string
  cached?: boolean
  error_code?: string
}

const normalizeCreateResult = (data: CreateTtsJobResponse): CreateTtsJobResult => ({
  jobId: data.job_id,
  status: data.status,
})

const normalizeStatusResult = (data: TtsJobStatusResponse): TtsJobStatusResult => ({
  jobId: data.job_id,
  status: data.status,
  audioUrl: data.audio_url,
  cached: data.cached,
  errorCode: data.error_code,
})

export const ttsService = {
  async createTtsJob(articleId: string, segmentId: string, speed = 1.0): Promise<CreateTtsJobResult> {
    const response = await api.post<CreateTtsJobResponse>(`/articles/${articleId}/tts-jobs`, {
      segment_id: segmentId,
      speed,
    })
    return normalizeCreateResult(response.data)
  },

  async getTtsJob(jobId: string): Promise<TtsJobStatusResult> {
    const response = await api.get<TtsJobStatusResponse>(`/tts-jobs/${jobId}`)
    return normalizeStatusResult(response.data)
  },

  async waitForDone(jobId: string, timeoutMs = 25000, intervalMs = 800): Promise<TtsJobStatusResult> {
    const startAt = Date.now()
    while (Date.now() - startAt <= timeoutMs) {
      const status = await this.getTtsJob(jobId)
      if (status.status === 'done' || status.status === 'failed') return status
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    return {
      jobId,
      status: 'failed',
      errorCode: 'TTS_TIMEOUT',
    }
  },

  async fetchAudioObjectUrl(audioUrl: string): Promise<string> {
    const normalizedPath = audioUrl.startsWith('/api/') ? audioUrl.replace(/^\/api/, '') : audioUrl
    const response = await api.get<Blob>(normalizedPath, { responseType: 'blob' })
    return URL.createObjectURL(response.data)
  },
}
