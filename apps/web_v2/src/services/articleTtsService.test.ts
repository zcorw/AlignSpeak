import api from './api'
import { articleTtsService } from './articleTtsService'

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

const apiAsset = {
  asset_id: 'asset-a',
  article_id: 'article-a',
  input_hash: 'hash-a',
  audio_url: '/api/media/tts/articles/asset-a',
  duration_ms: 12_000,
  file_size: 72000,
  voice: 'en-US-AriaNeural',
  speed: 1,
  timeline_version: 'article-v1',
  timeline: [
    {
      segment_id: 'segment-1',
      segment_order: 1,
      sentence_index: 0,
      text: 'First.',
      start_ms: 0,
      end_ms: 500,
    },
  ],
  ready_at: '2026-08-20T00:00:00Z',
}

describe('articleTtsService', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
    mockedApi.post.mockReset()
  })

  it('normalizes current asset and job payloads', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        article_id: 'article-a',
        input_hash: 'hash-a',
        is_stale: false,
        estimate: { bytes: 72000, is_estimate: false },
        asset: apiAsset,
        job: {
          job_id: 'job-a',
          article_id: 'article-a',
          input_hash: 'hash-a',
          status: 'done',
          total_segments: 1,
          completed_segments: 1,
          failed_segment: null,
          error_code: null,
          error_message: null,
          asset: apiAsset,
        },
      },
    })

    const result = await articleTtsService.getCurrent('article-a')

    expect(mockedApi.get).toHaveBeenCalledWith('/articles/article-a/full-tts', {
      signal: undefined,
    })
    expect(result).toMatchObject({
      articleId: 'article-a',
      estimate: { bytes: 72000, isEstimate: false },
      asset: {
        assetId: 'asset-a',
        durationMs: 12000,
        timeline: [
          {
            segmentId: 'segment-1',
            segmentOrder: 1,
            sentenceIndex: 0,
          },
        ],
      },
      job: { jobId: 'job-a', status: 'done', completedSegments: 1 },
    })
  })

  it('downloads the protected media path as a complete Blob', async () => {
    const blob = new Blob(['mp3'])
    mockedApi.get.mockImplementation(async (_path: string, config: { onDownloadProgress: (event: unknown) => void }) => {
      config.onDownloadProgress({ loaded: 3, total: 3 })
      return { data: blob }
    })
    const onProgress = vi.fn()

    const result = await articleTtsService.downloadAudio(
      {
        assetId: 'asset-a',
        articleId: 'article-a',
        inputHash: 'hash-a',
        audioUrl: '/api/media/tts/articles/asset-a',
        durationMs: 1000,
        fileSize: 3,
        voice: 'en-US-AriaNeural',
        speed: 1,
        timelineVersion: 'article-v1',
        timeline: [],
        readyAt: '2026-08-20T00:00:00Z',
      },
      onProgress
    )

    expect(mockedApi.get.mock.calls[0]?.[0]).toBe('/media/tts/articles/asset-a')
    expect(mockedApi.get.mock.calls[0]?.[1]).toMatchObject({
      responseType: 'blob',
      timeout: 300000,
    })
    expect(onProgress).toHaveBeenCalledWith({ loadedBytes: 3, totalBytes: 3 })
    expect(result).toBe(blob)
  })
})
