import { useState, FormEvent } from 'react'
import { Box, TextField, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // TODO: Call login API
    setTimeout(() => {
      setLoading(false)
      // Mock: navigate to start page
      navigate('/start')
    }, 1000)
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
        <Typography
          variant="h5"
          sx={{
            fontSize: 24,
            fontWeight: 700,
            mb: 1,
          }}
        >
          {t('pages.login.title')}
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: '#8888aa',
            mb: 3,
          }}
        >
          {t('pages.login.description')}
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Box>
            <Typography
              component="label"
              sx={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: '#55556a',
                mb: 0.75,
              }}
            >
              {t('pages.login.email')}
            </Typography>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('pages.login.emailPlaceholder')}
              required
              autoComplete="email"
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#22223a',
                  border: '1px solid rgba(255,255,255,0.13)',
                  borderRadius: '8px',
                  fontSize: 15,
                  color: '#eeeef6',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#55556a',
                  opacity: 1,
                },
              }}
            />
          </Box>

          <Box>
            <Typography
              component="label"
              sx={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: '#55556a',
                mb: 0.75,
              }}
            >
              {t('pages.login.password')}
            </Typography>
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('pages.login.passwordPlaceholder')}
              required
              autoComplete="current-password"
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#22223a',
                  border: '1px solid rgba(255,255,255,0.13)',
                  borderRadius: '8px',
                  fontSize: 15,
                  color: '#eeeef6',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#55556a',
                  opacity: 1,
                },
              }}
            />
          </Box>

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
              '&:hover': {
                bgcolor: '#8b7fff',
              },
              '&:disabled': {
                opacity: 0.4,
              },
            }}
          >
            {loading ? t('pages.login.submitting') : t('pages.login.submit')}
          </Button>

          <Button
            type="button"
            onClick={() => navigate('/register')}
            disabled={loading}
            fullWidth
            sx={{
              bgcolor: 'transparent',
              color: '#8888aa',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '999px',
              padding: '13px 24px',
              fontSize: 15,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                color: '#eeeef6',
                borderColor: 'rgba(255,255,255,0.13)',
              },
            }}
          >
            {t('pages.login.switchToRegister')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
