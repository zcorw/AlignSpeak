import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken } from "../auth/tokenStorage";

interface RequestOptions {
  auth?: boolean;
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface FailureState {
  count: number;
  lastFailureAt: number;
}

declare module "axios" {
  export interface AxiosRequestConfig {
    requiresAuth?: boolean;
    _requestKey?: string;
  }
}

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MAX_CONSECUTIVE_FAILURES = 2;
const FAILURE_COOLDOWN_MS = 10_000;

const failureStates = new Map<string, FailureState>();
const http = axios.create();

const toRequestKey = (config: InternalAxiosRequestConfig): string => {
  const method = (config.method ?? "get").toUpperCase();
  const url = config.url ?? "";
  return `${method}:${url}`;
};

const readFailureState = (key: string): FailureState => {
  return failureStates.get(key) ?? { count: 0, lastFailureAt: 0 };
};

const guardByFailureLimit = (key: string): void => {
  const state = readFailureState(key);
  if (state.count < MAX_CONSECUTIVE_FAILURES) return;
  const now = Date.now();
  if (now - state.lastFailureAt >= FAILURE_COOLDOWN_MS) return;
  throw new HttpError(429, "Request blocked temporarily due to repeated failures.", "CLIENT_RETRY_LIMIT");
};

const markFailure = (key: string): void => {
  const state = readFailureState(key);
  failureStates.set(key, {
    count: state.count + 1,
    lastFailureAt: Date.now(),
  });
};

const clearFailure = (key: string): void => {
  failureStates.delete(key);
};

const toHttpError = (error: unknown): HttpError => {
  if (!(error instanceof AxiosError)) {
    if (error instanceof HttpError) return error;
    if (error instanceof Error) return new HttpError(0, error.message);
    return new HttpError(0, "Unknown request error.");
  }

  const status = error.response?.status ?? 0;
  let message = status ? `Request failed (status ${status}).` : "Network request failed.";
  const body = error.response?.data as ErrorBody | undefined;
  if (body?.error?.message) {
    message = body.error.message;
  }
  const code = body?.error?.code;
  return new HttpError(status, message, code);
};

http.interceptors.request.use((config) => {
  const requestKey = toRequestKey(config);
  guardByFailureLimit(requestKey);

  config._requestKey = requestKey;
  config.headers = config.headers ?? {};
  if (!(config.data instanceof FormData) && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  const authEnabled = config.requiresAuth ?? true;
  if (authEnabled) {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

http.interceptors.response.use(
  (response) => {
    const requestKey = response.config._requestKey;
    if (requestKey) {
      clearFailure(requestKey);
    }
    return response;
  },
  (error: unknown) => {
    const axiosError = error as AxiosError;
    const requestKey = axiosError.config?._requestKey;
    if (requestKey) {
      markFailure(requestKey);
    }
    return Promise.reject(toHttpError(error));
  },
);

export const getJSON = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await http.get<T>(path, {
    requiresAuth: options.auth ?? true,
  });
  return response.data as T;
};

export const postJSON = async <T, B extends Record<string, unknown>>(
  path: string,
  body: B,
  options: RequestOptions = {},
): Promise<T> => {
  const response = await http.post<T>(path, body, {
    requiresAuth: options.auth ?? true,
  });
  return response.data as T;
};

export const postMultipart = async <T>(
  path: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> => {
  const response = await http.post<T>(path, formData, {
    requiresAuth: options.auth ?? true,
  });
  return response.data as T;
};
