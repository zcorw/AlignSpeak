import { useState, type FormEvent } from 'react'
import { Box, TextField, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { loginSchema } from '../utils/validation'
import { Alert, FieldError } from '../components/Alert'
import { ZodError } from 'zod'
import { authService, getApiErrorMessage } from '../services/authService'
import { useAuthStore } from '../stores/authStore'

export const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setUser = useAuthStore((state) => state.setUser)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      // Validate form data
      const validatedData = loginSchema.parse({ email, password })
      const result = await authService.login(validatedData)
      setAccessToken(result.accessToken)
      const me = await authService.me()
      setUser({
        id: me.userId,
        email: me.email,
        role: me.role,
        displayName: me.displayName,
        status: me.status,
      })
      navigate('/start', { replace: true })
    } catch (err) {
      if (err instanceof ZodError) {
        // Handle validation errors
        const errors: Record<string, string> = {}
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setFieldErrors(errors)
      } else {
        clearAuth()
        setError(getApiErrorMessage(err, 'Sign in failed. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
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
              onChange={(e) => {
                setEmail(e.target.value)
                setFieldErrors((prev) => ({ ...prev, email: '' }))
              }}
              placeholder={t('pages.login.emailPlaceholder')}
              autoComplete="email"
              fullWidth
              error={!!fieldErrors.email}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#22223a',
                  border: `1px solid ${fieldErrors.email ? '#f05252' : 'rgba(255,255,255,0.13)'}`,
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
            {fieldErrors.email && <FieldError message={fieldErrors.email} />}
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
              onChange={(e) => {
                setPassword(e.target.value)
                setFieldErrors((prev) => ({ ...prev, password: '' }))
              }}
              placeholder={t('pages.login.passwordPlaceholder')}
              autoComplete="current-password"
              fullWidth
              error={!!fieldErrors.password}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: '#22223a',
                  border: `1px solid ${fieldErrors.password ? '#f05252' : 'rgba(255,255,255,0.13)'}`,
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
            {fieldErrors.password && <FieldError message={fieldErrors.password} />}
          </Box>

          {error && (
            <Alert type="error" message={error} />
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
