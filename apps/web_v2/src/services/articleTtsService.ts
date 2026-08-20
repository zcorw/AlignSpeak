import type { AxiosProgressEvent } from 'axios'
import api from './api'

export type ArticleTtsJobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'cancelled'

export interface ArticleTtsTimelineSentence {
  segmentId: string
  segmentOrder: number
  sentenceIndex: number
  text: string
  startMs: number
  endMs: number
}

export interface ArticleTtsFailedSegment {
  segmentId: string | null
  segmentOrder: number | null
}

export interface ArticleTtsAsset {
  assetId: string
  articleId: string
  inputHash: string
  audioUrl: string
  durationMs: number
  fileSize: number
  voice: string
  speed: number
  timelineVersion: string
  timeline: ArticleTtsTimelineSentence[]
  readyAt: string
}

export interface ArticleTtsJob {
  jobId: string
  articleId: string
  inputHash: string
  status: ArticleTtsJobStatus
  totalSegments: number
  completedSegments: number
  failedSegment: ArticleTtsFailedSegment | null
  errorCode: string | null
  errorMessage: string | null
  asset: ArticleTtsAsset | null
}

export interface CurrentArticleTts {
  articleId: string
  inputHash: string
  isStale: boolean
  estimate: {
    bytes: number
    isEstimate: boolean
  }
  asset: ArticleTtsAsset | null
  job: ArticleTtsJob | null
}

interface ApiTimelineSentence {
  segment_id: string
  segment_order: number
  sentence_index: number
  text: string
  start_ms: number
  end_ms: number
}

interface ApiAsset {
  asset_id: string
  article_id: string
  input_hash: string
  audio_url: string
  duration_ms: number
  file_size: number
  voice: string
  speed: number
  timeline_version: string
  timeline: ApiTimelineSentence[]
  ready_at: string
}

interface ApiJob {
  job_id: string
  article_id: string
  input_hash: string
  status: ArticleTtsJobStatus
  total_segments: number
  completed_segments: number
  failed_segment: {
    segment_id: string | null
    segment_order: number | null
  } | null
  error_code: string | null
  error_message: string | null
  asset: ApiAsset | null
}

interface ApiCurrent {
  article_id: string
  input_hash: string
  is_stale: boolean
  estimate: {
    bytes: number
    is_estimate: boolean
  }
  asset: ApiAsset | null
  job: ApiJob | null
}

const normalizeAsset = (asset: ApiAsset): ArticleTtsAsset => ({
  assetId: asset.asset_id,
  articleId: asset.article_id,
  inputHash: asset.input_hash,
  audioUrl: asset.audio_url,
  durationMs: asset.duration_ms,
  fileSize: asset.file_size,
  voice: asset.voice,
  speed: asset.speed,
  timelineVersion: asset.timeline_version,
  timeline: asset.timeline.map((sentence) => ({
    segmentId: sentence.segment_id,
    segmentOrder: sentence.segment_order,
    sentenceIndex: sentence.sentence_index,
    text: sentence.text,
    startMs: sentence.start_ms,
    endMs: sentence.end_ms,
  })),
  readyAt: asset.ready_at,
})

const normalizeJob = (job: ApiJob): ArticleTtsJob => ({
  jobId: job.job_id,
  articleId: job.article_id,
  inputHash: job.input_hash,
  status: job.status,
  totalSegments: job.total_segments,
  completedSegments: job.completed_segments,
  failedSegment: job.failed_segment
    ? {
        segmentId: job.failed_segment.segment_id,
        segmentOrder: job.failed_segment.segment_order,
      }
    : null,
  errorCode: job.error_code,
  errorMessage: job.error_message,
  asset: job.asset ? normalizeAsset(job.asset) : null,
})

const normalizeMediaPath = (audioUrl: string) =>
  audioUrl.startsWith('/api/') ? audioUrl.replace(/^\/api/, '') : audioUrl

export interface ArticleTtsDownloadProgress {
  loadedBytes: number
  totalBytes: number | null
}

export interface ArticleTtsService {
  getCurrent: (articleId: string, signal?: AbortSignal) => Promise<CurrentArticleTts>
  createJob: (articleId: string, forceRefresh: boolean, signal?: AbortSignal) => Promise<ArticleTtsJob>
  retryJob: (jobId: string, signal?: AbortSignal) => Promise<ArticleTtsJob>
  getJob: (jobId: string, signal?: AbortSignal) => Promise<ArticleTtsJob>
  downloadAudio: (
    asset: ArticleTtsAsset,
    onProgress: (progress: ArticleTtsDownloadProgress) => void,
    signal?: AbortSignal
  ) => Promise<Blob>
}

export const articleTtsService: ArticleTtsService = {
  async getCurrent(articleId, signal) {
    const response = await api.get<ApiCurrent>(`/articles/${articleId}/full-tts`, { signal })
    return {
      articleId: response.data.article_id,
      inputHash: response.data.input_hash,
      isStale: response.data.is_stale,
      estimate: {
        bytes: response.data.estimate.bytes,
        isEstimate: response.data.estimate.is_estimate,
      },
      asset: response.data.asset ? normalizeAsset(response.data.asset) : null,
      job: response.data.job ? normalizeJob(response.data.job) : null,
    }
  },

  async createJob(articleId, forceRefresh, signal) {
    const response = await api.post<ApiJob>(
      `/articles/${articleId}/full-tts-jobs`,
      { force_refresh: forceRefresh },
      { signal }
    )
    return normalizeJob(response.data)
  },

  async retryJob(jobId, signal) {
    const response = await api.post<ApiJob>(`/full-tts-jobs/${jobId}/retry`, undefined, { signal })
    return normalizeJob(response.data)
  },

  async getJob(jobId, signal) {
    const response = await api.get<ApiJob>(`/full-tts-jobs/${jobId}`, { signal })
    return normalizeJob(response.data)
  },

  async downloadAudio(asset, onProgress, signal) {
    const response = await api.get<Blob>(normalizeMediaPath(asset.audioUrl), {
      responseType: 'blob',
      signal,
      timeout: 5 * 60 * 1000,
      onDownloadProgress: (event: AxiosProgressEvent) => {
        onProgress({
          loadedBytes: event.loaded,
          totalBytes: event.total ?? asset.fileSize ?? null,
        })
      },
    })
    return response.data
  },
}
