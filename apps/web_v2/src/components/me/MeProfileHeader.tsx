import { Box, Typography } from '@mui/material'

interface MeProfileHeaderProps {
  avatarText: string
  displayName: string
  statsText: string
  currentLang: 'zh' | 'en'
  onOpenPassword: () => void
  onSwitchLanguage: () => void
  changePasswordLabel: string
}

export const MeProfileHeader = ({
  avatarText,
  displayName,
  statsText,
  currentLang,
  onOpenPassword,
  onSwitchLanguage,
  changePasswordLabel,
}: MeProfileHeaderProps) => (
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
      {avatarText}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>
        {displayName}
      </Typography>
      <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
        {statsText}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
      <Box
        component="button"
        type="button"
        onClick={onOpenPassword}
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
        {changePasswordLabel}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onSwitchLanguage}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          p: '2px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.07)',
          bgcolor: '#1a1a2c',
          gap: '2px',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.13)',
          },
        }}
      >
        <Box
          component="span"
          sx={{
            px: '8px',
            py: '2px',
            borderRadius: '999px',
            bgcolor: currentLang === 'zh' ? 'rgba(110,96,238,0.2)' : 'transparent',
            color: currentLang === 'zh' ? 'primary.light' : 'text.disabled',
            fontSize: '11px',
            lineHeight: 1.2,
          }}
        >
          ZH
        </Box>
        <Box
          component="span"
          sx={{
            px: '8px',
            py: '2px',
            borderRadius: '999px',
            bgcolor: currentLang === 'en' ? 'rgba(110,96,238,0.2)' : 'transparent',
            color: currentLang === 'en' ? 'primary.light' : 'text.disabled',
            fontSize: '11px',
            lineHeight: 1.2,
          }}
        >
          EN
        </Box>
      </Box>
    </Box>
  </Box>
)

