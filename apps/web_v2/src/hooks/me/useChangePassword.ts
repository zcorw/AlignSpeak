import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ZodError } from 'zod'
import { authService, getApiErrorMessage } from '../../services/authService'
import { changePasswordSchema } from '../../utils/validation'

interface PasswordFeedback {
  type: 'success' | 'error'
  message: string
}

export const useChangePassword = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<PasswordFeedback | null>(null)

  const reset = () => {
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setFieldErrors({})
    setFeedback(null)
  }

  const close = () => {
    if (submitting) return
    setOpen(false)
    reset()
  }

  const submit = async () => {
    if (submitting) return
    setFieldErrors({})
    setFeedback(null)

    try {
      const validated = changePasswordSchema.parse({
        currentPassword: currentPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
      })
      setSubmitting(true)
      const result = await authService.changePassword({
        currentPassword: validated.currentPassword,
        newPassword: validated.newPassword,
      })
      setFeedback({ type: 'success', message: result.message })
      window.setTimeout(() => {
        close()
      }, 800)
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {}
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setFieldErrors(errors)
      } else {
        setFeedback({
          type: 'error',
          message: getApiErrorMessage(error, t('common.error')),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return {
    open,
    setOpen,
    close,
    currentPwd,
    setCurrentPwd,
    newPwd,
    setNewPwd,
    confirmPwd,
    setConfirmPwd,
    fieldErrors,
    setFieldErrors,
    submitting,
    feedback,
    submit,
  }
}

