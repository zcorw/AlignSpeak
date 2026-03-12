import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const AuthBrandIntro = () => {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        mb: 2.5,
        p: '14px 14px 12px',
        borderRadius: '12px',
        border: '1px solid rgba(110,96,238,0.28)',
        background: 'linear-gradient(140deg, rgba(110,96,238,0.18), rgba(29,201,138,0.08))',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '8px' }}>
        <Box
          component="svg"
          viewBox="0 0 40 40"
          sx={{ width: 34, height: 34, flexShrink: 0 }}
          aria-hidden
        >
          <defs>
            <linearGradient id="alignspeak-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7f72ff" />
              <stop offset="100%" stopColor="#22d8a4" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="none" stroke="url(#alignspeak-logo-gradient)" strokeWidth="2.2" />
          <path d="M11 23c2.2-5.8 5.8-8.6 9-8.6 3.6 0 6.4 2.4 9 8.6" fill="none" stroke="#c5beff" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="14" cy="17.5" r="2.2" fill="#8f84ff" />
          <circle cx="26" cy="17.5" r="2.2" fill="#24d2a3" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.2 }}>
            {t('pages.login.brandName')}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', lineHeight: 1.3 }}>
            {t('pages.login.brandTagline')}
          </Typography>
        </Box>
      </Box>

      <Typography sx={{ fontSize: '12px', color: 'text.secondary', mb: '8px' }}>
        {t('pages.login.brandSummary')}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {[t('pages.login.featureImport'), t('pages.login.featureShadowing'), t('pages.login.featureFeedback')].map((item) => (
          <Box
            key={item}
            sx={{
              px: '8px',
              py: '4px',
              borderRadius: '999px',
              fontSize: '11px',
              color: 'text.primary',
              bgcolor: 'rgba(10,12,28,0.45)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            {item}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
