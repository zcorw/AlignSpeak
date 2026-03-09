import { Box } from '@mui/material'

interface PracticeSegmentSelectorProps {
  totalSegments: number
  currentSegmentOrder: number
  disabled?: boolean
  onSelectSegment: (segmentOrder: number) => void
}

export const PracticeSegmentSelector = ({
  totalSegments,
  currentSegmentOrder,
  disabled = false,
  onSelectSegment,
}: PracticeSegmentSelectorProps) => {
  if (totalSegments <= 1) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        pb: '2px',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {Array.from({ length: totalSegments }, (_, index) => {
        const segmentOrder = index + 1
        const active = segmentOrder === currentSegmentOrder
        return (
          <Box
            key={segmentOrder}
            component="button"
            type="button"
            disabled={disabled}
            onClick={() => onSelectSegment(segmentOrder)}
            sx={{
              width: 34,
              height: 30,
              borderRadius: '999px',
              border: '1px solid',
              borderColor: active ? 'rgba(110,96,238,0.65)' : 'rgba(255,255,255,0.13)',
              bgcolor: active ? 'rgba(110,96,238,0.28)' : '#1a1a2c',
              color: active ? 'primary.light' : 'text.secondary',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1,
              p: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
              '&:hover': disabled
                ? undefined
                : {
                    borderColor: 'rgba(255,255,255,0.35)',
                    color: 'text.primary',
                  },
            }}
          >
            {segmentOrder}
          </Box>
        )
      })}
    </Box>
  )
}
