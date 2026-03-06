import {
  ArrowBackRounded,
  ArrowForwardRounded,
  CloseRounded,
  GridViewRounded,
  MicRounded,
  PersonOutlineRounded,
  RefreshRounded,
  ReplayRounded,
  StopRounded,
} from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type CellState = 'pass' | 'current' | 'skip' | 'fail'
type Level = 'L1' | 'L2' | 'L3' | 'L4'
type AlignmentType = 'ok' | 'err' | 'miss' | 'ins'

const PROGRESS: Record<Level, CellState[]> = {
  L1: ['pass', 'pass', 'pass', 'pass', 'pass'],
  L2: ['pass', 'pass', 'current', 'fail', 'fail'],
  L3: ['fail', 'fail', 'fail', 'fail', 'fail'],
  L4: ['fail', 'fail', 'fail', 'fail', 'fail'],
}

const TRENDS = [62, 70, 75, 78]
const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']

const TOKENS: { word: string; type: AlignmentType }[] = [
  { word: 'After', type: 'ok' },
  { word: 'that', type: 'ok' },
  { word: 'I', type: 'ok' },
  { word: 'use', type: 'err' },
  { word: 'used', type: 'miss' },
  { word: 'to', type: 'ok' },
  { word: 'think', type: 'ok' },
  { word: 'a', type: 'ok' },
  { word: 'lot', type: 'ok' },
  { word: 'about', type: 'ok' },
  { word: 'jungle', type: 'ok' },
  { word: 'adventure', type: 'err' },
  { word: 'adventures', type: 'miss' },
  { word: ',', type: 'ok' },
  { word: 'and', type: 'ok' },
  { word: 'eventually', type: 'ok' },
  { word: 'managed', type: 'ok' },
  { word: 'to', type: 'ok' },
  { word: 'make', type: 'ok' },
  { word: 'my', type: 'miss' },
  { word: 'first', type: 'ok' },
  { word: 'drawing', type: 'ok' },
  { word: '…', type: 'ins' },
]

const iconButtonSx = {
  width: 36,
  height: 36,
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.13)',
  bgcolor: '#1a1a2c',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  '&:hover': { bgcolor: '#22223a', color: 'text.primary' },
} as const

const Matrix = ({ compact = false }: { compact?: boolean }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {LEVELS.map((level) => (
      <Box key={level} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Typography
          sx={{
            width: 22,
            fontSize: '11px',
            fontWeight: 700,
            color: 'text.disabled',
            fontFamily: '"SF Mono", "Fira Code", monospace',
          }}
        >
          {level}
        </Typography>
        <Box sx={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {PROGRESS[level].map((state, i) => (
            <Box
              key={`${level}-${i}`}
              sx={{
                width: compact ? 20 : 28,
                height: compact ? 20 : 28,
                borderRadius: '6px',
                border: '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 9 : 11,
                fontWeight: 700,
                ...(state === 'pass' && {
                  bgcolor: 'rgba(29,201,138,0.1)',
                  color: 'success.main',
                  borderColor: 'rgba(29,201,138,0.2)',
                }),
                ...(state === 'current' && {
                  bgcolor: 'rgba(110,96,238,0.25)',
                  color: 'primary.light',
                  borderColor: '#6e60ee',
                }),
                ...(state === 'skip' && {
                  bgcolor: 'rgba(240,166,35,0.1)',
                  color: 'warning.main',
                  borderColor: 'rgba(240,166,35,0.2)',
                }),
                ...(state === 'fail' && {
                  bgcolor: '#22223a',
                  color: 'text.disabled',
                }),
              }}
            >
              {state === 'pass' ? '✓' : state === 'current' ? i + 1 : state === 'skip' ? '↷' : '·'}
            </Box>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
)

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

export const PracticePage = () => {
  const navigate = useNavigate()
  const [showSyncBar, setShowSyncBar] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const [showFullMode, setShowFullMode] = useState(false)
  const [recordOverlayOpen, setRecordOverlayOpen] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [level, setLevel] = useState<Level>('L2')

  useEffect(() => {
    if (!recordOverlayOpen) return undefined
    const timer = window.setInterval(() => setRecordSeconds((prev) => prev + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recordOverlayOpen])

  useEffect(() => {
    if (!showSyncBar || syncing) return undefined
    const timer = window.setTimeout(() => setShowSyncBar(false), 4000)
    return () => window.clearTimeout(timer)
  }, [showSyncBar, syncing])

  const segmentText =
    'After that I used to think a lot about jungle adventures, and eventually managed to make my first drawing with colored pencils.'
  const score = 78
  const passed = score >= 85

  const startRecording = () => {
    setRecordSeconds(0)
    setRecordOverlayOpen(true)
  }

  const stopRecording = () => {
    setRecordOverlayOpen(false)
    setRecognizing(true)
    window.setTimeout(() => {
      setRecognizing(false)
      setShowScore(true)
      setShowSyncBar(true)
    }, 1800)
  }

  const retrySync = () => {
    setSyncing(true)
    setShowSyncBar(true)
    window.setTimeout(() => {
      setSyncing(false)
      setShowSyncBar(false)
    }, 1500)
  }

  const switchLevel = (nextLevel: Level) => {
    if (nextLevel === level) return
    if (window.confirm(`切换到 ${nextLevel} 将重置当前等级进度。确认切换？`)) {
      setLevel(nextLevel)
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/start')}>
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            The Little Prince — Ch.I
          </Typography>
          <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>英语</Typography>
        </Box>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => setDrawerOpen(true)}>
          <GridViewRounded sx={{ fontSize: 15 }} />
        </Box>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate('/me')}>
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {showSyncBar && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: '20px', pb: '8px' }}>
          <Box
            component="button"
            type="button"
            onClick={retrySync}
            disabled={syncing}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              px: '10px',
              py: '5px',
              bgcolor: 'rgba(240,166,35,0.1)',
              border: '1px solid rgba(240,166,35,0.25)',
              borderRadius: '999px',
              color: 'warning.main',
              fontSize: '12px',
              cursor: syncing ? 'default' : 'pointer',
            }}
          >
            {syncing ? <CircularProgress size={12} thickness={5} sx={{ color: 'warning.main' }} /> : <RefreshRounded sx={{ fontSize: 13 }} />}
            {syncing ? '同步中…' : '未同步 · 点击重试'}
          </Box>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '20px',
          pt: '4px',
          pb: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ px: '10px', py: '3px', borderRadius: '999px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid rgba(110,96,238,0.3)', color: 'primary.light', fontSize: '12px', fontWeight: 600 }}>
            {level}
          </Box>
          <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>段落 3 / 5</Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>目标 ≥85%</Typography>
        </Box>

        <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '20px' }}>
          <Typography sx={{ mb: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
            §3 跟读段落
          </Typography>
          <Typography sx={{ fontSize: '17px', lineHeight: 1.75 }}>{segmentText}</Typography>
        </Box>

        {!recognizing && !showScore && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', pt: '8px', pb: '4px' }}>
            <Box
              component="button"
              type="button"
              onClick={startRecording}
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: 'none',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            >
              <MicRounded sx={{ fontSize: 24 }} />
            </Box>
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>点击开始录音</Typography>
          </Box>
        )}

        {recognizing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', p: '32px' }}>
            <CircularProgress size={28} thickness={4} />
            <Typography sx={{ fontSize: '14px', color: 'text.secondary' }}>识别中…</Typography>
          </Box>
        )}

        {showScore && (
          <Box
            sx={{
              bgcolor: '#1a1a2c',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: '24px',
              p: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', minWidth: 126 }}>
                <Typography
                  sx={{
                    fontSize: '72px',
                    lineHeight: 0.85,
                    fontWeight: 800,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    color: 'success.main',
                  }}
                >
                  {score}%
                </Typography>
                <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>{passed ? '达标' : '未达标'}</Typography>
              </Box>

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>正确词</Typography>
                  <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>11 / 18</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>错误词</Typography>
                  <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>3</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Typography component="span" sx={{ color: 'text.secondary' }}>漏读词</Typography>
                  <Typography component="span" sx={{ minWidth: 72, textAlign: 'right', color: 'text.primary', fontFamily: 'monospace' }}>4</Typography>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                p: '12px',
                bgcolor: '#22223a',
                borderRadius: '16px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {TOKENS.map((token, i) => (
                <Box
                  key={`${token.word}-${i}`}
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: '4px',
                    py: '1px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: 1.3,
                    ...(token.type === 'ok' && { bgcolor: 'rgba(29,201,138,0.12)' }),
                    ...(token.type === 'err' && { bgcolor: 'rgba(240,82,82,0.2)', color: 'error.main', textDecoration: 'line-through' }),
                    ...(token.type === 'miss' && { bgcolor: 'rgba(240,166,35,0.18)', color: 'warning.main' }),
                    ...(token.type === 'ins' && { bgcolor: 'rgba(240,82,82,0.1)', color: 'text.secondary' }),
                  }}
                >
                  {token.word}
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="contained"
                startIcon={<ReplayRounded sx={{ fontSize: '14px !important' }} />}
                onClick={() => setShowScore(false)}
                sx={{
                  flex: 1.8,
                  boxShadow: '0 8px 24px rgba(110,96,238,0.3)',
                  background: 'linear-gradient(90deg, #6e60ee, #7a6cff)',
                }}
              >
                再练一次
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/result')}
                sx={{
                  flex: 1,
                  bgcolor: '#22223a',
                  borderColor: 'rgba(255,255,255,0.13)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.13)',
                    bgcolor: '#1a1a2c',
                  },
                }}
              >
                提交查看
              </Button>
            </Box>

            <Box
              component="button"
              type="button"
              onClick={() => {
                if (window.confirm('跳过本段将标记为未完成，需要在本等级结束前补齐。确认跳过？')) setShowScore(false)
              }}
              sx={{
                border: 'none',
                bgcolor: 'transparent',
                p: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'text.disabled',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <ArrowForwardRounded sx={{ fontSize: 18 }} />
              跳过本段（标记未完成）
            </Box>
          </Box>
        )}

        <Box component="button" type="button" onClick={() => setShowFullMode((prev) => !prev)} sx={{ border: 'none', bgcolor: 'transparent', p: '8px 0', color: 'text.secondary', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowBackRounded sx={{ fontSize: 14, transform: showFullMode ? 'rotate(-90deg)' : 'rotate(-270deg)', transition: 'transform 0.25s' }} />
          {showFullMode ? '收起完整模式' : '展开完整模式'}
        </Box>

        {showFullMode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                最近成绩趋势
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                {TRENDS.map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <Box sx={{ width: 24, height: 40, borderRadius: '4px', bgcolor: '#1a1a2c', position: 'relative', overflow: 'hidden' }}>
                      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', height: `${Math.max(4, Math.round((item / 100) * 40))}px`, borderRadius: '4px', bgcolor: item >= 85 ? 'success.main' : 'primary.main' }} />
                    </Box>
                    <Typography sx={{ fontSize: '10px', color: 'text.disabled', fontFamily: '"SF Mono", "Fira Code", monospace' }}>{item}%</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Typography sx={{ mb: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                等级达标矩阵
              </Typography>
              <Matrix />
            </Box>

            <Box sx={{ p: '16px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
                  手动切换等级
                </Typography>
                <Box sx={{ display: 'flex', gap: '6px' }}>
                  {LEVELS.map((item) => (
                    <Button
                      key={item}
                      size="small"
                      variant="outlined"
                      onClick={() => switchLevel(item)}
                      sx={{
                        minWidth: '42px',
                        borderColor: item === level ? 'rgba(110,96,238,0.3)' : 'rgba(255,255,255,0.07)',
                        bgcolor: item === level ? 'rgba(110,96,238,0.25)' : 'transparent',
                        color: item === level ? 'primary.light' : 'text.secondary',
                      }}
                    >
                      {item}
                    </Button>
                  ))}
                </Box>
              </Box>
              <Typography sx={{ mt: '8px', fontSize: '12px', color: 'text.disabled' }}>切换等级将重置当前等级进度</Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          left: '50%',
          width: '100%',
          maxWidth: '430px',
          transform: recordOverlayOpen ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 300,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', p: '16px 20px' }}>
          <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={() => setRecordOverlayOpen(false)}>
            <CloseRounded sx={{ fontSize: 16 }} />
          </Box>
          <Typography sx={{ color: 'error.main', fontSize: '14px', fontWeight: 600 }}>录音中</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'text.secondary' }}>{formatTimer(recordSeconds)}</Typography>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: '32px 28px', gap: '32px' }}>
          <Typography sx={{ fontSize: '12px', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>§3 · 跟读段落</Typography>
          <Typography sx={{ fontSize: '20px', lineHeight: 1.7, textAlign: 'center' }}>{segmentText}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 32 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 4,
                  borderRadius: '2px',
                  bgcolor: 'error.main',
                  animation: 'wave 0.8s ease-in-out infinite alternate',
                  animationDelay: `${(i % 3) * 0.1}s`,
                  '@keyframes wave': { from: { height: 4 }, to: { height: 28 } },
                }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ p: '20px 24px 40px' }}>
          <Button variant="contained" color="error" size="large" fullWidth startIcon={<StopRounded />} onClick={stopRecording}>
            结束录音
          </Button>
        </Box>
      </Box>

      <Box onClick={() => setDrawerOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 90, bgcolor: 'rgba(0,0,0,0.6)', opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? 'auto' : 'none', transition: 'opacity 0.3s' }} />
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '80svh',
          transform: drawerOpen ? 'translate(-50%,0)' : 'translate(-50%,100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 100,
          bgcolor: 'background.paper',
          borderRadius: '14px 14px 0 0',
          border: '1px solid rgba(255,255,255,0.13)',
          borderBottom: 'none',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.13)', borderRadius: '4px', m: '10px auto 0' }} />
        <Box sx={{ p: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GridViewRounded sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography sx={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>本文练习进度</Typography>
          <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={() => setDrawerOpen(false)}>
            <CloseRounded sx={{ fontSize: 14 }} />
          </Box>
        </Box>
        <Box sx={{ p: '4px 20px 32px', overflowY: 'auto' }}>
          <Typography sx={{ mb: '16px', fontSize: '13px', color: 'text.secondary' }}>The Little Prince — Chapter I · 5 段</Typography>
          <Matrix />
          <Box sx={{ mt: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'text.disabled' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(29,201,138,0.1)', border: '1px solid rgba(29,201,138,0.2)', color: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>✓</Box>
              已达标
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid #6e60ee', color: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>→</Box>
              当前
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(240,166,35,0.1)', border: '1px solid rgba(240,166,35,0.2)', color: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>↷</Box>
              已跳过
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: '#22223a', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>·</Box>
              未完成
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
