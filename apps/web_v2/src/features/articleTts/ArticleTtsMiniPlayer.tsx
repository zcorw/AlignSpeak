import CloseRounded from '@mui/icons-material/CloseRounded'
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded'
import PauseRounded from '@mui/icons-material/PauseRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import ReplayRounded from '@mui/icons-material/ReplayRounded'
import {
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useArticleTtsPlayer } from './articleTtsPlayerContext'

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const ArticleTtsMiniPlayer = () => {
  const { t } = useTranslation()
  const { state, prepare, retry, play, pause, reset } = useArticleTtsPlayer()
  if (state.phase === 'idle') return null

  const preparationProgress = state.totalSegments
    ? Math.min((state.completedSegments / state.totalSegments) * 100, 100)
    : 0
  const downloadProgress = state.downloadTotalBytes
    ? Math.min((state.downloadedBytes / state.downloadTotalBytes) * 100, 100)
    : 0
  const isBusy = ['checking', 'preparing', 'downloading'].includes(state.phase)
  const statusText = (() => {
    if (state.phase === 'checking') return t('articleTts.player.checking')
    if (state.phase === 'preparing') {
      return t('articleTts.player.preparing', {
        completed: state.completedSegments,
        total: state.totalSegments || '?',
      })
    }
    if (state.phase === 'downloading') {
      const total = state.downloadTotalBytes
        ? formatBytes(state.downloadTotalBytes)
        : t('articleTts.player.unknownSize')
      return t('articleTts.player.downloading', {
        loaded: formatBytes(state.downloadedBytes),
        total,
      })
    }
    if (state.phase === 'ready') return t('articleTts.player.ready')
    if (state.phase === 'playing') return t('articleTts.player.playing')
    if (state.phase === 'paused') return t('articleTts.player.paused')
    const segment = state.error?.failedSegment?.segmentOrder
    return segment
      ? t('articleTts.player.failedSegment', { segment })
      : state.error?.message || t('articleTts.player.failed')
  })()

  const progress =
    state.phase === 'preparing'
      ? preparationProgress
      : state.phase === 'downloading'
        ? downloadProgress
        : null

  const updateAudio = () => {
    if (!state.articleId || !state.articleTitle) return
    void prepare({
      articleId: state.articleId,
      articleTitle: state.articleTitle,
      forceRefresh: true,
    })
  }

  return (
    <>
      <Box
        aria-hidden="true"
        sx={{ height: 'calc(72px + env(safe-area-inset-bottom))', flexShrink: 0 }}
      />
      <Paper
      elevation={16}
      aria-label={t('articleTts.player.label')}
      sx={{
        position: 'fixed',
        zIndex: 1400,
        left: '50%',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '406px',
        overflow: 'hidden',
        borderRadius: '16px',
        bgcolor: 'rgba(26,26,44,0.98)',
        border: '1px solid rgba(139,127,255,0.35)',
        backdropFilter: 'blur(18px)',
      }}
    >
      {progress !== null && (
        <LinearProgress
          variant="determinate"
          value={progress}
          aria-label={t('articleTts.player.progressLabel')}
          sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.07)' }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '11px 10px 11px 13px' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: state.phase === 'failed' ? 'error.main' : 'primary.light',
            bgcolor: state.phase === 'failed' ? 'rgba(240,82,82,0.1)' : 'rgba(110,96,238,0.16)',
          }}
        >
          {isBusy ? <CircularProgress size={18} /> : <GraphicEqRounded sx={{ fontSize: 21 }} />}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '13px', fontWeight: 700 }}>
            {state.articleTitle || t('articleTts.player.untitled')}
          </Typography>
          <Typography
            noWrap
            title={statusText}
            sx={{ mt: '2px', fontSize: '11px', color: state.phase === 'failed' ? 'error.light' : 'text.secondary' }}
          >
            {statusText}
          </Typography>
        </Box>

        {state.phase === 'failed' && state.jobId && (
          <Tooltip title={t('articleTts.player.retry')}>
            <IconButton
              size="small"
              aria-label={t('articleTts.player.retry')}
              onClick={() => { void retry() }}
            >
              <ReplayRounded />
            </IconButton>
          </Tooltip>
        )}
        {(state.phase === 'ready' || state.phase === 'paused') && (
          <IconButton
            color="primary"
            aria-label={t('articleTts.player.play')}
            onClick={() => { void play() }}
            sx={{ bgcolor: 'rgba(110,96,238,0.16)' }}
          >
            <PlayArrowRounded />
          </IconButton>
        )}
        {state.phase === 'playing' && (
          <IconButton
            color="primary"
            aria-label={t('articleTts.player.pause')}
            onClick={pause}
            sx={{ bgcolor: 'rgba(110,96,238,0.16)' }}
          >
            <PauseRounded />
          </IconButton>
        )}
        {state.asset && !isBusy && (
          <Tooltip title={t('articleTts.player.update')}>
            <IconButton
              size="small"
              aria-label={t('articleTts.player.update')}
              onClick={updateAudio}
            >
              <RefreshRounded sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton
          size="small"
          aria-label={t('common.close')}
          onClick={reset}
        >
          <CloseRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      </Paper>
    </>
  )
}
