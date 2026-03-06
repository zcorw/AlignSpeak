import { NorthRounded, PersonOutlineRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { useNavigate, Link } from 'react-router-dom'

export const StartPage = () => {
  const navigate = useNavigate()

  const currentArticle = {
    title: 'The Little Prince — Chapter I',
    language: '🇺🇸 English',
    level: 2,
    segment: 3,
    totalSegments: 5,
    passedSegments: 2,
    lastPracticedAt: '今天',
  }
  const progress = Math.round((currentArticle.passedSegments / currentArticle.totalSegments) * 100)

  const recentArticles = [
    {
      id: '2',
      to: '/practice',
      icon: '📖',
      title: 'Pride and Prejudice — Opening',
      meta: '英语 · 2天前 · 段落 2/4',
      level: 'L1',
    },
    {
      id: '3',
      to: '/practice',
      icon: '📗',
      title: '《围城》第一章节选',
      meta: '中文 · 13天前 · 段落 5/8',
      level: 'L3',
    },
  ]

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: '20px',
          pt: '16px',
          pb: '12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '8px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          🎯
        </Box>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, flex: 1 }}>
          AlignSpeak
        </Typography>
        <Box
          component="button"
          type="button"
          aria-label="我的"
          onClick={() => navigate('/me')}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.13)',
            bgcolor: '#1a1a2c',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'background-color 0.15s, color 0.15s',
            '&:hover': {
              bgcolor: '#22223a',
              color: 'text.primary',
            },
          }}
        >
          <PersonOutlineRounded sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '24px',
          pt: '32px',
          pb: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '32px',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.13)',
            borderRadius: '4px',
          },
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '14px', color: 'text.secondary', mb: '4px' }}>
            欢迎回来，<Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>张明</Box>
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            bgcolor: '#1a1a2c',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: '14px',
            p: '22px',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #6e60ee, #8b7fff)',
            },
          }}
        >
          <Typography
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              mb: '10px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'text.disabled',
            }}
          >
            {currentArticle.language}
          </Typography>

          <Typography sx={{ mb: '20px', fontSize: '17px', fontWeight: 600, lineHeight: 1.4 }}>
            {currentArticle.title}
          </Typography>

          <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.7px',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                }}
              >
                当前等级
              </Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                <Box component="span" sx={{ color: 'primary.light' }}>L{currentArticle.level}</Box>
              </Typography>
            </Box>

            <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.7px',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                }}
              >
                当前段落
              </Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                {currentArticle.segment}
                <Box component="span" sx={{ ml: 0.5, fontSize: '13px', color: 'text.secondary', fontWeight: 400 }}>
                  / {currentArticle.totalSegments}
                </Box>
              </Typography>
            </Box>

            <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.7px',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                }}
              >
                上次练习
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'text.secondary', fontWeight: 500 }}>
                {currentArticle.lastPracticedAt}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'text.secondary' }}>
              <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                L{currentArticle.level} 整体进度
              </Typography>
              <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                {currentArticle.passedSegments} / {currentArticle.totalSegments} 段达标
              </Typography>
            </Box>
            <Box sx={{ height: 4, bgcolor: '#22223a', borderRadius: '4px', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${progress}%`,
                  height: '100%',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease',
                  background: 'linear-gradient(90deg, #6e60ee, #8b7fff)',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => navigate('/practice')}
            sx={{
              boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
              '&:hover': {
                bgcolor: 'primary.light',
              },
            }}
          >
            继续上次练习
          </Button>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'text.disabled',
              fontSize: '12px',
              '&::before, &::after': {
                content: '""',
                flex: 1,
                height: 1,
                bgcolor: 'divider',
              },
            }}
          >
            或
          </Box>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<NorthRounded sx={{ fontSize: '16px !important' }} />}
            onClick={() => navigate('/editor')}
            sx={{
              bgcolor: '#22223a',
              borderColor: 'rgba(255,255,255,0.13)',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.13)',
                bgcolor: '#1a1a2c',
              },
            }}
          >
            导入新文章
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Typography
            sx={{
              px: '2px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: 'text.disabled',
            }}
          >
            历史文章
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentArticles.map((article) => (
              <Box
                key={article.id}
                component={Link}
                to={article.to}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  p: '13px 16px',
                  bgcolor: '#1a1a2c',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.13)',
                    bgcolor: '#22223a',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    bgcolor: '#22223a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                  }}
                >
                  {article.icon}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {article.title}
                  </Typography>
                  <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
                    {article.meta}
                  </Typography>
                </Box>

                <Typography
                  sx={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'primary.light',
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    flexShrink: 0,
                  }}
                >
                  {article.level}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
