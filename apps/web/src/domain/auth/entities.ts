export interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResult {
  userId: string;
  message: string;
  verificationRequired: boolean;
  verificationCode?: string;
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface VerifyEmailResult {
  userId: string;
  message: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  displayName: string;
  status: string;
}
