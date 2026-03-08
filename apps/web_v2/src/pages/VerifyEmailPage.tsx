import { useState, type FormEvent } from 'react'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyEmailSchema } from '../utils/validation'
import { Alert } from '../components/Alert'
import { AuthCardLayout } from '../components/auth/AuthCardLayout'
import { AuthField } from '../components/auth/AuthField'
import { AuthPrimaryButton } from '../components/auth/AuthPrimaryButton'
import { AuthSecondaryButton } from '../components/auth/AuthSecondaryButton'
import { ZodError } from 'zod'
import { authService, getApiErrorMessage } from '../services/authService'

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      // Validate form data
      const validatedData = verifyEmailSchema.parse({ email, code })
      const result = await authService.verifyEmail(validatedData)
      setSuccessMessage(result.message || t('pages.verifyEmail.success'))
      setTimeout(() => navigate('/login', { replace: true }), 1200)
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
        setError(getApiErrorMessage(err, 'Verification failed. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title={t('pages.verifyEmail.title')}
      description={t('pages.verifyEmail.description')}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box>
          <AuthField
            type="email"
            label={t('pages.verifyEmail.email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            placeholder={t('pages.verifyEmail.emailPlaceholder')}
            autoComplete="email"
            error={fieldErrors.email}
          />
        </Box>

        <Box>
          <AuthField
            label={t('pages.verifyEmail.code')}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.trim())
              setFieldErrors((prev) => ({ ...prev, code: '' }))
            }}
            placeholder={t('pages.verifyEmail.codePlaceholder')}
            inputProps={{ maxLength: 6 }}
            error={fieldErrors.code}
            textFieldSx={{
              '& input': {
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                letterSpacing: '0.5em',
                textAlign: 'center',
                fontSize: 18,
              },
            }}
          />
        </Box>

        {state.verificationCode && (
          <Alert type="info" message={`${t('pages.verifyEmail.devCodePrefix')} ${state.verificationCode}`} />
        )}
        {successMessage && <Alert type="success" message={successMessage} />}
        {error && <Alert type="error" message={error} />}

        <AuthPrimaryButton
          type="submit"
          loading={loading}
          label={t('pages.verifyEmail.submit')}
          loadingLabel={t('pages.verifyEmail.submitting')}
        />

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <AuthSecondaryButton
            fullWidth
            disabled={loading}
            label={t('pages.verifyEmail.backToRegister')}
            onClick={() => navigate('/register')}
          />
          <AuthSecondaryButton
            fullWidth
            disabled={loading}
            label={t('pages.verifyEmail.backToLogin')}
            onClick={() => navigate('/login')}
          />
        </Box>
      </Box>
    </AuthCardLayout>
  )
}
