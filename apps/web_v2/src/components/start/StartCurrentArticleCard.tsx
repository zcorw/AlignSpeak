import { Box, Typography } from '@mui/material'

interface StartCurrentArticleCardProps {
  languageLabel: string
  title: string
  currentLevelLabel: string
  currentSegmentLabel: string
  currentLevel: number
  currentSegment: number
  totalSegments: number
  lastPracticeLabel: string
  lastPracticeValue: string
  overallProgressLabel: string
  passedSegmentsLabel: string
  progress: number
}

export const StartCurrentArticleCard = ({
  languageLabel,
  title,
  currentLevelLabel,
  currentSegmentLabel,
  currentLevel,
  currentSegment,
  totalSegments,
  lastPracticeLabel,
  lastPracticeValue,
  overallProgressLabel,
  passedSegmentsLabel,
  progress,
}: StartCurrentArticleCardProps) => (
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
      {languageLabel}
    </Typography>

    <Typography sx={{ mb: '20px', fontSize: '17px', fontWeight: 600, lineHeight: 1.4 }}>
      {title}
    </Typography>

    <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {currentLevelLabel}
        </Typography>
        <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
          <Box component="span" sx={{ color: 'primary.light' }}>L{currentLevel}</Box>
        </Typography>
      </Box>

      <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {currentSegmentLabel}
        </Typography>
        <Typography sx={{ fontSize: '15px', fontWeight: 700, fontFamily: '"SF Mono", "Fira Code", monospace' }}>
          {currentSegment}
          <Box component="span" sx={{ ml: 0.5, fontSize: '13px', color: 'text.secondary', fontWeight: 400 }}>
            / {Math.max(totalSegments, 1)}
          </Box>
        </Typography>
      </Box>

      <Box sx={{ width: 1, alignSelf: 'stretch', mx: '4px', bgcolor: 'divider' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'text.disabled' }}>
          {lastPracticeLabel}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: 'text.secondary', fontWeight: 500 }}>
          {lastPracticeValue}
        </Typography>
      </Box>
    </Box>

    <Box sx={{ mt: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'text.secondary' }}>
        <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
          {overallProgressLabel}
        </Typography>
        <Typography component="span" sx={{ fontSize: '12px', color: 'text.secondary' }}>
          {passedSegmentsLabel}
        </Typography>
      </Box>
      <Box sx={{ height: 4, bgcolor: '#22223a', borderRadius: '4px', overflow: 'hidden' }}>
        <Box
          sx={{
            width: `${Math.max(0, Math.min(100, progress))}%`,
            height: '100%',
            borderRadius: '4px',
            transition: 'width 0.4s ease',
            background: 'linear-gradient(90deg, #6e60ee, #8b7fff)',
          }}
        />
      </Box>
    </Box>
  </Box>
)
