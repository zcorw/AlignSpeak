import { useState, type FormEvent } from 'react'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { registerSchema } from '../utils/validation'
import { Alert } from '../components/Alert'
import { AuthCardLayout } from '../components/auth/AuthCardLayout'
import { AuthField } from '../components/auth/AuthField'
import { AuthPrimaryButton } from '../components/auth/AuthPrimaryButton'
import { AuthSecondaryButton } from '../components/auth/AuthSecondaryButton'
import { ZodError } from 'zod'
import { authService, getApiErrorMessage } from '../services/authService'

export const RegisterPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setFieldErrors({})

    try {
      // Validate form data
      const validatedData = registerSchema.parse({ email, password, invitationCode, displayName })
      const result = await authService.register({
        ...validatedData,
        displayName: validatedData.displayName?.trim() || undefined,
      })
      setSuccessMessage(result.message || t('pages.register.success'))
      navigate('/login', { replace: true })
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
        setError(getApiErrorMessage(err, 'Registration failed. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title={t('pages.register.title')}
      description={t('pages.register.description')}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box>
          <AuthField
            type="email"
            label={t('pages.register.email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            placeholder={t('pages.register.emailPlaceholder')}
            autoComplete="email"
            error={fieldErrors.email}
          />
        </Box>

        <Box>
          <AuthField
            type="password"
            label={t('pages.register.password')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFieldErrors((prev) => ({ ...prev, password: '' }))
            }}
            placeholder={t('pages.register.passwordPlaceholder')}
            autoComplete="new-password"
            error={fieldErrors.password}
          />
        </Box>

        <Box>
          <AuthField
            label={t('pages.register.invitationCode')}
            value={invitationCode}
            onChange={(e) => {
              setInvitationCode(e.target.value.toUpperCase())
              setFieldErrors((prev) => ({ ...prev, invitationCode: '' }))
            }}
            placeholder={t('pages.register.invitationCodePlaceholder')}
            autoComplete="off"
            error={fieldErrors.invitationCode}
          />
        </Box>

        <Box>
          <AuthField
            label={t('pages.register.displayName')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('pages.register.displayNamePlaceholder')}
            autoComplete="nickname"
          />
        </Box>

        {successMessage && <Alert type="success" message={successMessage} />}
        {error && <Alert type="error" message={error} />}

        <AuthPrimaryButton
          type="submit"
          loading={loading}
          label={t('pages.register.submit')}
          loadingLabel={t('pages.register.submitting')}
        />

        <AuthSecondaryButton
          disabled={loading}
          label={t('pages.register.switchToLogin')}
          onClick={() => navigate('/login')}
        />
      </Box>
    </AuthCardLayout>
  )
}
