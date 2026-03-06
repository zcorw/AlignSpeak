import { useState, FormEvent } from 'react'
import { Box, TextField, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'

interface LocationState {
  email?: string
  verificationCode?: string
}

export const VerifyEmailPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState) ?? {}

  const [email, setEmail] = useState(state.email ?? '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // TODO: Call verify-email API
    setTimeout(() => {
      setLoading(false)
      setSuccessMessage(t('pages.verifyEmail.success'))
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    }, 1000)
  }

  const labelSx = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.8px',
    textTransform: 'uppercase' as const,
    color: '#55556a',
    mb: 0.75,
  }

  const inputSx = {
    '& .MuiInputBase-root': {
      bgcolor: '#22223a',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: '8px',
      fontSize: 15,
      color: '#eeeef6',
    },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiInputBase-input::placeholder': {
      color: '#55556a',
      opacity: 1,
    },
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2.5,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 400,
          bgcolor: '#1a1a2c',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
          p: '24px',
        }}
      >
        <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 1 }}>
          {t('pages.verifyEmail.title')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#8888aa', mb: 3 }}>
          {t('pages.verifyEmail.description')}
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Box>
            <Typography component="label" sx={labelSx}>{t('pages.verifyEmail.email')}</Typography>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('pages.verifyEmail.emailPlaceholder')}
              required
              autoComplete="email"
              fullWidth
              sx={inputSx}
            />
          </Box>

          <Box>
            <Typography component="label" sx={labelSx}>{t('pages.verifyEmail.code')}</Typography>
            <TextField
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder={t('pages.verifyEmail.codePlaceholder')}
              required
              inputProps={{ maxLength: 6, pattern: '[0-9]{6}' }}
              fullWidth
              sx={{
                ...inputSx,
                '& input': {
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  letterSpacing: '0.5em',
                  textAlign: 'center',
                  fontSize: 18,
                },
              }}
            />
          </Box>

          {/* Dev verification code hint */}
          {state.verificationCode && (
            <Box
              sx={{
                px: '12px',
                py: '12px',
                bgcolor: 'rgba(110,96,238,0.15)',
                border: '1px solid rgba(110,96,238,0.3)',
                borderRadius: '8px',
                color: '#8b7fff',
                fontSize: 14,
              }}
            >
              {t('pages.verifyEmail.devCodePrefix')}{' '}
              <Box
                component="span"
                sx={{ fontFamily: "'SF Mono', monospace", fontWeight: 600 }}
              >
                {state.verificationCode}
              </Box>
            </Box>
          )}

          {successMessage && (
            <Box
              sx={{
                px: '12px',
                py: '12px',
                bgcolor: 'rgba(29,201,138,0.1)',
                border: '1px solid rgba(29,201,138,0.3)',
                borderRadius: '8px',
                color: '#1dc98a',
                fontSize: 14,
              }}
            >
              {successMessage}
            </Box>
          )}

          {error && (
            <Box
              sx={{
                px: '12px',
                py: '12px',
                bgcolor: 'rgba(240,82,82,0.1)',
                border: '1px solid rgba(240,82,82,0.3)',
                borderRadius: '8px',
                color: '#f05252',
                fontSize: 14,
              }}
            >
              {error}
            </Box>
          )}

          <Button
            type="submit"
            disabled={loading}
            fullWidth
            sx={{
              bgcolor: '#6e60ee',
              color: '#fff',
              borderRadius: '999px',
              padding: '13px 24px',
              fontSize: 15,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 2px 12px rgba(110,96,238,0.25)',
              '&:hover': { bgcolor: '#8b7fff' },
              '&:disabled': { opacity: 0.4 },
            }}
          >
            {loading ? t('pages.verifyEmail.submitting') : t('pages.verifyEmail.submit')}
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              type="button"
              onClick={() => navigate('/register')}
              disabled={loading}
              sx={{
                flex: 1,
                bgcolor: 'transparent',
                color: '#8888aa',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '999px',
                padding: '13px 24px',
                fontSize: 15,
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { color: '#eeeef6', borderColor: 'rgba(255,255,255,0.13)' },
              }}
            >
              {t('pages.verifyEmail.backToRegister')}
            </Button>
            <Button
              type="button"
              onClick={() => navigate('/login')}
              disabled={loading}
              sx={{
                flex: 1,
                bgcolor: 'transparent',
                color: '#8888aa',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '999px',
                padding: '13px 24px',
                fontSize: 15,
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { color: '#eeeef6', borderColor: 'rgba(255,255,255,0.13)' },
              }}
            >
              {t('pages.verifyEmail.backToLogin')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
