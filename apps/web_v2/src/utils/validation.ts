import { z } from 'zod'

// Login form validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// Register form validation
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  invitationCode: z
    .string()
    .trim()
    .min(4, 'Invitation code is required')
    .max(32, 'Invitation code is too long'),
  displayName: z.string().optional(),
})

export type RegisterFormData = z.infer<typeof registerSchema>

// Verify email form validation
export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
})

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>

// Change password form validation
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
