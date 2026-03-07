import api from './api'

export type AlignmentStatus = 'correct' | 'missing' | 'insert' | 'substitute'

export interface AlignmentToken {
  text: string
  status: AlignmentStatus
}

export interface AlignmentCompareBlock {
  blockOrder: number
  reference: AlignmentToken[]
  recognized: AlignmentToken[]
}

export interface AlignmentNoiseSpan {
  startToken: number
  endToken: number
  reason: string
}

export interface AlignmentResult {
  accuracyRate: number
  refTokens: AlignmentToken[]
  hypTokens: AlignmentToken[]
  compareBlocks: AlignmentCompareBlock[]
  noiseSpans: AlignmentNoiseSpan[]
}

interface StartRecordingResponse {
  recording_id: string
  status: string
}

interface FinishRecordingResponse {
  recording_id: string
  job_id: string
  status: string
}

interface SttJobResponse {
  job_id: string
  status: string
  attempt_id?: string
  recognized_text?: string
  confidence?: number
  provider?: string
  model?: string
  error_code?: string
}

interface AlignResponse {
  accuracy_rate: number
  ref_tokens: Array<{ text: string; status: AlignmentStatus }>
  hyp_tokens: Array<{ text: string; status: AlignmentStatus }>
  compare_blocks: Array<{
    block_order: number
    reference: Array<{ text: string; status: AlignmentStatus }>
    recognized: Array<{ text: string; status: AlignmentStatus }>
  }>
  noise_spans: Array<{ start_token: number; end_token: number; reason: string }>
}

const toAlignmentResult = (payload: AlignResponse): AlignmentResult => ({
  accuracyRate: payload.accuracy_rate,
  refTokens: payload.ref_tokens,
  hypTokens: payload.hyp_tokens,
  compareBlocks: payload.compare_blocks.map((block) => ({
    blockOrder: block.block_order,
    reference: block.reference,
    recognized: block.recognized,
  })),
  noiseSpans: payload.noise_spans.map((span) => ({
    startToken: span.start_token,
    endToken: span.end_token,
    reason: span.reason,
  })),
})

export const practiceAttemptService = {
  async startRecording(segmentId: string): Promise<{ recordingId: string; status: string }> {
    const response = await api.post<StartRecordingResponse>(`/practice/segments/${segmentId}/recordings/start`, {
      client_ts: new Date().toISOString(),
    })
    return {
      recordingId: response.data.recording_id,
      status: response.data.status,
    }
  },

  async uploadChunk(recordingId: string, seq: number, chunk: Blob, durationMs?: number): Promise<void> {
    await api.post(`/practice/recordings/${recordingId}/chunks`, chunk, {
      headers: { 'Content-Type': 'audio/webm' },
      params: {
        seq,
        duration_ms: durationMs,
      },
    })
  },

  async finishRecording(
    recordingId: string,
    totalChunks: number,
    durationMs: number
  ): Promise<{ recordingId: string; jobId: string; status: string }> {
    const response = await api.post<FinishRecordingResponse>(`/practice/recordings/${recordingId}/finish`, {
      total_chunks: totalChunks,
      duration_ms: durationMs,
    })
    return {
      recordingId: response.data.recording_id,
      jobId: response.data.job_id,
      status: response.data.status,
    }
  },

  async getSttJob(jobId: string): Promise<SttJobResponse> {
    const response = await api.get<SttJobResponse>(`/stt-jobs/${jobId}`)
    return response.data
  },

  async waitSttDone(jobId: string, timeoutMs = 120000, intervalMs = 1200): Promise<SttJobResponse> {
    const startedAt = Date.now()
    while (Date.now() - startedAt <= timeoutMs) {
      const status = await this.getSttJob(jobId)
      if (status.status === 'done' || status.status === 'failed') return status
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    return {
      job_id: jobId,
      status: 'failed',
      error_code: 'STT_TIMEOUT',
    }
  },

  async alignAttempt(attemptId: string, segmentId: string, recognizedText?: string): Promise<AlignmentResult> {
    const response = await api.post<AlignResponse>(`/practice/attempts/${attemptId}/align`, {
      segment_id: segmentId,
      recognized_text: recognizedText,
    })
    return toAlignmentResult(response.data)
  },
}
