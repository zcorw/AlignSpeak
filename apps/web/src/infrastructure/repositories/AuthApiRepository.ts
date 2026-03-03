import type {
  AuthUser,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  RegisterResult,
  VerifyEmailPayload,
  VerifyEmailResult,
} from "../../domain/auth/entities";
import { getJSON, postJSON } from "../http/httpClient";

interface RegisterApiResponse {
  user_id: string;
  message: string;
  verification_required: boolean;
  verification_code?: string | null;
}

interface VerifyEmailApiResponse {
  user_id: string;
  message: string;
}

interface LoginApiResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MeApiResponse {
  user_id: string;
  email: string;
  role: string;
  display_name: string;
  status: string;
}

export class AuthApiRepository {
  async register(payload: RegisterPayload): Promise<RegisterResult> {
    const response = await postJSON<RegisterApiResponse, Record<string, unknown>>(
      "/auth/register",
      {
        email: payload.email,
        password: payload.password,
        display_name: payload.displayName,
      },
      { auth: false },
    );

    return {
      userId: response.user_id,
      message: response.message,
      verificationRequired: response.verification_required,
      verificationCode: response.verification_code ?? undefined,
    };
  }

  async verifyEmail(payload: VerifyEmailPayload): Promise<VerifyEmailResult> {
    const response = await postJSON<VerifyEmailApiResponse, Record<string, unknown>>(
      "/auth/verify-email",
      {
        email: payload.email,
        code: payload.code,
      },
      { auth: false },
    );
    return {
      userId: response.user_id,
      message: response.message,
    };
  }

  async login(payload: LoginPayload): Promise<LoginResult> {
    const response = await postJSON<LoginApiResponse, Record<string, unknown>>(
      "/auth/login",
      {
        email: payload.email,
        password: payload.password,
      },
      {
        auth: false,
      },
    );
    return {
      accessToken: response.access_token,
      tokenType: response.token_type,
      expiresIn: response.expires_in,
    };
  }

  async getMe(): Promise<AuthUser> {
    const response = await getJSON<MeApiResponse>("/auth/me");
    return {
      userId: response.user_id,
      email: response.email,
      role: response.role,
      displayName: response.display_name,
      status: response.status,
    };
  }
}
