import { ContentCopyRounded, GroupAddRounded } from '@mui/icons-material'
import { Box, Button, Typography } from '@mui/material'
import { Alert } from '../Alert'

interface MeInviteEntryProps {
  title: string
  description: string
  generateLabel: string
  generatingLabel: string
  copyLabel: string
  generatedCodeLabel: string
  usageHint: string
  isGenerating: boolean
  latestCode: string | null
  feedback: { type: 'success' | 'error' | 'info'; message: string } | null
  onGenerate: () => void
  onCopy: () => void
}

export const MeInviteEntry = ({
  title,
  description,
  generateLabel,
  generatingLabel,
  copyLabel,
  generatedCodeLabel,
  usageHint,
  isGenerating,
  latestCode,
  feedback,
  onGenerate,
  onCopy,
}: MeInviteEntryProps) => (
  <Box
    sx={{
      px: '20px',
      pb: '14px',
      borderBottom: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <Box>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: 'text.disabled', mt: '2px' }}>
          {description}
        </Typography>
      </Box>
      <Button
        variant="text"
        size="small"
        startIcon={<GroupAddRounded sx={{ fontSize: '14px !important' }} />}
        onClick={onGenerate}
        disabled={isGenerating}
        sx={{
          px: '10px',
          py: '5px',
          borderRadius: '999px',
          fontSize: '12px',
          color: 'text.secondary',
          border: '1px solid rgba(255,255,255,0.14)',
          bgcolor: 'rgba(255,255,255,0.02)',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.2)',
            bgcolor: 'rgba(255,255,255,0.04)',
          },
        }}
      >
        {isGenerating ? generatingLabel : generateLabel}
      </Button>
    </Box>

    {latestCode && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          px: '10px',
          py: '8px',
          bgcolor: '#1b1b2d',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '11px', color: 'text.disabled' }}>
            {generatedCodeLabel}
          </Typography>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {latestCode}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: 'text.disabled', mt: '2px' }}>
            {usageHint}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyRounded sx={{ fontSize: '14px !important' }} />}
          onClick={onCopy}
          sx={{ px: '10px', py: '4px' }}
        >
          {copyLabel}
        </Button>
      </Box>
    )}

    {feedback && (
      <Alert type={feedback.type} message={feedback.message} />
    )}
  </Box>
)

