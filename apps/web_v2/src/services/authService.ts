import axios from 'axios'
import api from './api'

interface RegisterApiResponse {
  user_id: string
  message: string
  verification_required: boolean
  verification_code: string | null
}

interface VerifyEmailApiResponse {
  user_id: string
  message: string
}

interface LoginApiResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface MeApiResponse {
  user_id: string
  email: string
  role: string
  display_name: string
  status: string
}

interface ChangePasswordApiResponse {
  message: string
}

interface CreateInvitationCodeApiResponse {
  invitation_code_id: string
  code: string
  max_uses: number
  used_count: number
  remaining_uses: number
  status: string
}

interface ApiErrorPayload {
  error?: {
    code?: string
    message?: string
  }
}

export interface RegisterPayload {
  email: string
  password: string
  displayName?: string
  invitationCode: string
}

export interface RegisterResult {
  userId: string
  message: string
  verificationRequired: boolean
  verificationCode?: string
}

export interface VerifyEmailPayload {
  email: string
  code: string
}

export interface VerifyEmailResult {
  userId: string
  message: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResult {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export interface MeResult {
  userId: string
  email: string
  role: string
  displayName: string
  status: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordResult {
  message: string
}

export interface CreateInvitationCodeResult {
  invitationCodeId: string
  code: string
  maxUses: number
  usedCount: number
  remainingUses: number
  status: string
}

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim()) return error.message
    return fallback
  }

  const payload = error.response?.data as ApiErrorPayload | undefined
  const message = payload?.error?.message
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}

export const authService = {
  async register(payload: RegisterPayload): Promise<RegisterResult> {
    const response = await api.post<RegisterApiResponse>('/auth/register', {
      email: payload.email,
      password: payload.password,
      display_name: payload.displayName,
      invitation_code: payload.invitationCode,
    })

    return {
      userId: response.data.user_id,
      message: response.data.message,
      verificationRequired: response.data.verification_required,
      verificationCode: response.data.verification_code ?? undefined,
    }
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<VerifyEmailResult> {
    const response = await api.post<VerifyEmailApiResponse>('/auth/verify-email', {
      email: payload.email,
      code: payload.code,
    })

    return {
      userId: response.data.user_id,
      message: response.data.message,
    }
  },

  async login(payload: LoginPayload): Promise<LoginResult> {
    const response = await api.post<LoginApiResponse>('/auth/login', {
      email: payload.email,
      password: payload.password,
    })

    return {
      accessToken: response.data.access_token,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
    }
  },

  async me(): Promise<MeResult> {
    const response = await api.get<MeApiResponse>('/auth/me')
    return {
      userId: response.data.user_id,
      email: response.data.email,
      role: response.data.role,
      displayName: response.data.display_name,
      status: response.data.status,
    }
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResult> {
    const response = await api.post<ChangePasswordApiResponse>('/auth/change-password', {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    })
    return {
      message: response.data.message,
    }
  },

  async createInvitationCode(): Promise<CreateInvitationCodeResult> {
    const response = await api.post<CreateInvitationCodeApiResponse>('/auth/invitation-codes')
    return {
      invitationCodeId: response.data.invitation_code_id,
      code: response.data.code,
      maxUses: response.data.max_uses,
      usedCount: response.data.used_count,
      remainingUses: response.data.remaining_uses,
      status: response.data.status,
    }
  },
}
