import { useCallback, useEffect, useState } from "react";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResult,
  VerifyEmailPayload,
  VerifyEmailResult,
} from "../domain/auth/entities";
import { clearAccessToken, getAccessToken, setAccessToken } from "../infrastructure/auth/tokenStorage";
import { HttpError } from "../infrastructure/http/httpClient";
import { AuthApiRepository } from "../infrastructure/repositories/AuthApiRepository";

type AuthStatus = "checking" | "authenticated" | "anonymous";

const messageFromError = (error: unknown, fallback: string): string => {
  if (error instanceof HttpError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};

export const useAuthController = (repository: AuthApiRepository) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("anonymous");
    setError(null);
  }, []);

  const bootstrap = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setStatus("anonymous");
      return;
    }

    setLoading(true);
    try {
      const me = await repository.getMe();
      setUser(me);
      setStatus("authenticated");
      setError(null);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, repository]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (payload: LoginPayload): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const loginResult = await repository.login(payload);
        setAccessToken(loginResult.accessToken);
        const me = await repository.getMe();
        setUser(me);
        setStatus("authenticated");
        return true;
      } catch (err) {
        logout();
        setError(messageFromError(err, "Login failed."));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [logout, repository],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterResult | null> => {
      setLoading(true);
      setError(null);
      try {
        return await repository.register(payload);
      } catch (err) {
        setError(messageFromError(err, "Registration failed."));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [repository],
  );

  const verifyEmail = useCallback(
    async (payload: VerifyEmailPayload): Promise<VerifyEmailResult | null> => {
      setLoading(true);
      setError(null);
      try {
        return await repository.verifyEmail(payload);
      } catch (err) {
        setError(messageFromError(err, "Email verification failed."));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [repository],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    loading,
    error,
    login,
    register,
    verifyEmail,
    logout,
    clearError,
  };
};
