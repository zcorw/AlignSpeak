import { useState, type FormEvent } from 'react'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { loginSchema } from '../utils/validation'
import { Alert } from '../components/Alert'
import { AuthCardLayout } from '../components/auth/AuthCardLayout'
import { AuthField } from '../components/auth/AuthField'
import { AuthPrimaryButton } from '../components/auth/AuthPrimaryButton'
import { AuthSecondaryButton } from '../components/auth/AuthSecondaryButton'
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
      navigate('/', { replace: true })
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
    <AuthCardLayout
      title={t('pages.login.title')}
      description={t('pages.login.description')}
    >
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
          <AuthField
            type="email"
            label={t('pages.login.email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            placeholder={t('pages.login.emailPlaceholder')}
            autoComplete="email"
            error={fieldErrors.email}
          />
        </Box>

        <Box>
          <AuthField
            type="password"
            label={t('pages.login.password')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFieldErrors((prev) => ({ ...prev, password: '' }))
            }}
            placeholder={t('pages.login.passwordPlaceholder')}
            autoComplete="current-password"
            error={fieldErrors.password}
          />
        </Box>

        {error && <Alert type="error" message={error} />}

        <AuthPrimaryButton
          type="submit"
          loading={loading}
          label={t('pages.login.submit')}
          loadingLabel={t('pages.login.submitting')}
        />

        <AuthSecondaryButton
          disabled={loading}
          label={t('pages.login.switchToRegister')}
          onClick={() => navigate('/register')}
        />
      </Box>
    </AuthCardLayout>
  )
}
