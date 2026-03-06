import { ArrowBackRounded, CloseRounded, NorthRounded } from '@mui/icons-material'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type FilterType = 'all' | 'en' | 'zh' | 'done'

type Article = {
  id: string
  title: string
  lang: 'en' | 'zh'
  langLabel: string
  langFlag: string
  icon: string
  level: number
  segment: number
  totalSegments: number
  lastPracticed: string
  progress: number
  isActive: boolean
  isDone: boolean
  practiceCount: number
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'en', label: '🇺🇸 英语' },
  { id: 'zh', label: '🇨🇳 中文' },
  { id: 'done', label: '✓ 已完成' },
]

const ARTICLES: Article[] = [
  {
    id: 'a1',
    title: 'The Little Prince — Chapter I',
    lang: 'en',
    langLabel: '英语',
    langFlag: '🇺🇸',
    icon: '📖',
    level: 2,
    segment: 3,
    totalSegments: 5,
    lastPracticed: '今天',
    progress: 0.4,
    isActive: true,
    isDone: false,
    practiceCount: 18,
  },
  {
    id: 'a2',
    title: 'Pride and Prejudice — Opening',
    lang: 'en',
    langLabel: '英语',
    langFlag: '🇺🇸',
    icon: '📗',
    level: 1,
    segment: 2,
    totalSegments: 4,
    lastPracticed: '2天前',
    progress: 0.5,
    isActive: false,
    isDone: false,
    practiceCount: 14,
  },
  {
    id: 'a3',
    title: '《围城》第一章节选',
    lang: 'zh',
    langLabel: '中文',
    langFlag: '🇨🇳',
    icon: '📕',
    level: 4,
    segment: 8,
    totalSegments: 8,
    lastPracticed: '13天前',
    progress: 1,
    isActive: false,
    isDone: true,
    practiceCount: 32,
  },
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

export const MePage = () => {
  const navigate = useNavigate()

  const [filter, setFilter] = useState<FilterType>('all')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  const filteredArticles = useMemo(() => {
    if (filter === 'en') return ARTICLES.filter((item) => item.lang === 'en')
    if (filter === 'zh') return ARTICLES.filter((item) => item.lang === 'zh')
    if (filter === 'done') return ARTICLES.filter((item) => item.isDone)
    return ARTICLES
  }, [filter])

  const totalPractices = ARTICLES.reduce((sum, item) => sum + item.practiceCount, 0)

  const closePasswordModal = () => {
    setPasswordModalOpen(false)
  }

  const submitPasswordChange = () => {
    if (!currentPwd || !newPwd || !confirmPwd) return
    if (newPwd !== confirmPwd) {
      window.alert('两次密码不一致')
      return
    }
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
    closePasswordModal()
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', px: '20px', pt: '16px', pb: '12px' }}>
        <Box component="button" type="button" sx={iconButtonSx} onClick={() => navigate(-1)}>
          <ArrowBackRounded sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: '17px', fontWeight: 600 }}>我的</Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<NorthRounded sx={{ fontSize: '13px !important' }} />}
          onClick={() => navigate('/editor')}
          sx={{ px: '14px', py: '7px' }}
        >
          新建
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', px: '20px', pt: '20px', pb: '16px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6e60ee, #8b7fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            张
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>张明</Typography>
            <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
              共 {ARTICLES.length} 篇文章 · 已练 {totalPractices} 次
            </Typography>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            sx={{
              fontSize: '13px',
              color: 'text.disabled',
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
              '&:hover': { color: 'text.secondary' },
            }}
          >
            修改密码
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: '8px', px: '20px', py: '14px', overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          {FILTERS.map((item) => {
            const active = item.id === filter
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                onClick={() => setFilter(item.id)}
                sx={{
                  px: '14px',
                  py: '6px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: active ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
                  bgcolor: active ? 'rgba(110,96,238,0.25)' : '#1a1a2c',
                  color: active ? 'primary.light' : 'text.secondary',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': active
                    ? undefined
                    : {
                        borderColor: 'rgba(255,255,255,0.13)',
                        color: 'text.primary',
                      },
                }}
              >
                {item.label}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', px: '20px', pt: '4px', pb: '32px', gap: '10px' }}>
          {filteredArticles.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', py: '60px', px: '32px', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '40px' }}>📭</Typography>
              <Typography sx={{ fontSize: '15px', color: 'text.secondary' }}>当前筛选条件下暂无文章</Typography>
            </Box>
          ) : (
            filteredArticles.map((article) => (
              <Box
                key={article.id}
                component="button"
                type="button"
                onClick={() => navigate(`/practice?a=${article.id}`)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  p: '16px',
                  textAlign: 'left',
                  bgcolor: article.isActive ? 'rgba(110,96,238,0.04)' : '#1a1a2c',
                  border: '1px solid',
                  borderColor: article.isActive ? 'rgba(110,96,238,0.4)' : 'rgba(255,255,255,0.07)',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.13)',
                    bgcolor: '#22223a',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '9px', bgcolor: '#22223a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
                    {article.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3, color: 'text.primary' }}>
                      {article.title}
                    </Typography>
                    <Typography sx={{ mt: '3px', fontSize: '12px', color: 'text.secondary' }}>
                      {article.langFlag} {article.langLabel}
                    </Typography>
                  </Box>
                  <Box sx={{ px: '9px', py: '3px', borderRadius: '999px', border: '1px solid rgba(110,96,238,0.25)', bgcolor: 'rgba(110,96,238,0.25)', color: 'primary.light', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
                    {article.isDone ? '完成' : `L${article.level}`}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Box sx={{ flex: 1, height: 3, borderRadius: '3px', bgcolor: '#22223a', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${article.progress * 100}%`, borderRadius: '3px', background: 'linear-gradient(90deg, #6e60ee, #8b7fff)' }} />
                  </Box>
                  <Typography sx={{ fontSize: '11px', color: 'text.disabled', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {article.isDone ? '全部达标' : `§${article.segment}/${article.totalSegments}`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>上次练习：{article.lastPracticed}</Typography>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>·</Typography>
                  <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>练习 {article.practiceCount} 次</Typography>
                  {article.isDone && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', px: '8px', py: '2px', borderRadius: '999px', bgcolor: 'rgba(29,201,138,0.1)', color: 'success.main', fontSize: '11px', fontWeight: 600 }}>
                      ✓ 已完成
                    </Box>
                  )}
                  {article.isActive && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'primary.light' }}>
                      ▶ 当前
                    </Box>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box
        onClick={(event) => {
          if (event.target === event.currentTarget) closePasswordModal()
        }}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          bgcolor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          opacity: passwordModalOpen ? 1 : 0,
          pointerEvents: passwordModalOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '430px',
            p: '20px 20px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            bgcolor: 'background.paper',
            borderRadius: '14px 14px 0 0',
            border: '1px solid rgba(255,255,255,0.13)',
            borderBottom: 'none',
            transform: passwordModalOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>修改密码</Typography>
            <Box sx={{ flex: 1 }} />
            <Box
              component="button"
              type="button"
              onClick={closePasswordModal}
              sx={{
                ...iconButtonSx,
                border: '1px solid transparent',
                bgcolor: 'transparent',
              }}
            >
              <CloseRounded sx={{ fontSize: 14 }} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <TextField
              value={currentPwd}
              onChange={(event) => setCurrentPwd(event.target.value)}
              type="password"
              size="small"
              fullWidth
              placeholder="当前密码"
              sx={{
                '.MuiOutlinedInput-root': {
                  bgcolor: '#22223a',
                },
              }}
            />
            <TextField
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              type="password"
              size="small"
              fullWidth
              placeholder="新密码"
              sx={{
                '.MuiOutlinedInput-root': {
                  bgcolor: '#22223a',
                },
              }}
            />
            <TextField
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              type="password"
              size="small"
              fullWidth
              placeholder="确认新密码"
              sx={{
                '.MuiOutlinedInput-root': {
                  bgcolor: '#22223a',
                },
              }}
            />
          </Box>

          <Button variant="contained" fullWidth onClick={submitPasswordChange}>
            确认修改
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
