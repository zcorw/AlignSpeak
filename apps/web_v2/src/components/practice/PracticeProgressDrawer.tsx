import { CloseRounded, GridViewRounded } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import type { PracticeLevel } from '../../services/practiceService'
import { PracticeLevelSelector } from './PracticeLevelSelector'
import { PracticeProgressMatrix } from './PracticeProgressMatrix'
import { PracticeSegmentSelector } from './PracticeSegmentSelector'
import { iconButtonSx, type PracticeMatrix } from './shared'

interface PracticeProgressDrawerProps {
  open: boolean
  loading: boolean
  title: string
  articleInfo: string
  loadingLabel: string
  matrix: PracticeMatrix
  level: PracticeLevel
  totalSegments: number
  currentSegmentOrder: number
  switchLevelLabel: string
  switchLevelHint: string
  legend: {
    pass: string
    current: string
    skipped: string
    incomplete: string
  }
  onSwitchLevel: (nextLevel: PracticeLevel) => void
  onSelectSegment: (segmentOrder: number) => void
  onClose: () => void
}

export const PracticeProgressDrawer = ({
  open,
  loading,
  title,
  articleInfo,
  loadingLabel,
  matrix,
  level,
  totalSegments,
  currentSegmentOrder,
  switchLevelLabel,
  switchLevelHint,
  legend,
  onSwitchLevel,
  onSelectSegment,
  onClose,
}: PracticeProgressDrawerProps) => (
  <>
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 90, bgcolor: 'rgba(0,0,0,0.6)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.3s' }} />
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        width: '100%',
        maxWidth: '430px',
        maxHeight: '80svh',
        transform: open ? 'translate(-50%,0)' : 'translate(-50%,100%)',
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
        <Typography sx={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>
          {title}
        </Typography>
        <Box component="button" type="button" sx={{ ...iconButtonSx, border: '1px solid transparent', bgcolor: 'transparent' }} onClick={onClose}>
          <CloseRounded sx={{ fontSize: 14 }} />
        </Box>
      </Box>
      <Box sx={{ p: '4px 20px 32px', overflowY: 'auto' }}>
        <Typography sx={{ mb: '16px', fontSize: '13px', color: 'text.secondary' }}>
          {articleInfo}
        </Typography>
        {loading && (
          <Typography sx={{ mb: '10px', fontSize: '12px', color: 'text.disabled' }}>
            {loadingLabel}
          </Typography>
        )}
        <PracticeProgressMatrix matrix={matrix} />
        <Box sx={{ mt: '14px' }}>
          <Typography sx={{ mb: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'text.disabled' }}>
            {switchLevelLabel}
          </Typography>
          <PracticeLevelSelector level={level} disabled={loading} onSwitchLevel={onSwitchLevel} />
          <Typography sx={{ mt: '8px', fontSize: '12px', color: 'text.disabled' }}>
            {switchLevelHint}
          </Typography>
        </Box>
        <Box sx={{ mt: '14px' }}>
          <PracticeSegmentSelector
            totalSegments={totalSegments}
            currentSegmentOrder={currentSegmentOrder}
            disabled={loading}
            onSelectSegment={onSelectSegment}
          />
        </Box>
        <Box sx={{ mt: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'text.disabled' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(29,201,138,0.1)', border: '1px solid rgba(29,201,138,0.2)', color: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>OK</Box>
            {legend.pass}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(110,96,238,0.25)', border: '1px solid #6e60ee', color: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-&gt;</Box>
            {legend.current}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: 'rgba(240,166,35,0.1)', border: '1px solid rgba(240,166,35,0.2)', color: 'warning.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-&gt;</Box>
            {legend.skipped}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: '#22223a', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>-</Box>
            {legend.incomplete}
          </Box>
        </Box>
      </Box>
    </Box>
  </>
)
