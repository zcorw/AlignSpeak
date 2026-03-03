import { HttpResponse, http } from "msw";
import {
  getPracticeBundleByDocIdAndSegmentId,
  getPracticeResultByDocIdAndSegmentId,
  homeSummary,
  meSummary,
  progressSummary,
} from "./data";

const mockToken = "mock-access-token";
const mockUserEmail = "you@example.com";
const mockVerificationCode = "123456";
let isVerified = false;

const readBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [type, token] = authorization.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

const ensureAuthorized = (request: Request): ReturnType<typeof HttpResponse.json> | null => {
  const token = readBearerToken(request);
  if (!token) {
    return HttpResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Login required.",
        },
      },
      { status: 401 },
    );
  }
  return null;
};

export const handlers = [
  http.post("/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    isVerified = false;
    return HttpResponse.json(
      {
        user_id: "usr_mock001",
        message: "Verification code sent. Please verify before login.",
        verification_required: true,
        verification_code: mockVerificationCode,
        email: body.email ?? mockUserEmail,
      },
      { status: 201 },
    );
  }),

  http.post("/auth/verify-email", async ({ request }) => {
    const body = (await request.json()) as { email?: string; code?: string };
    if (!body.email || body.code !== mockVerificationCode) {
      return HttpResponse.json(
        {
          error: {
            code: "AUTH_VERIFICATION_CODE_INVALID",
            message: "Invalid verification code.",
          },
        },
        { status: 400 },
      );
    }
    isVerified = true;
    return HttpResponse.json({
      user_id: "usr_mock001",
      message: "Email verified. You can now sign in.",
    });
  }),

  http.post("/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: {
            code: "AUTH_INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        },
        { status: 401 },
      );
    }
    if (!isVerified) {
      return HttpResponse.json(
        {
          error: {
            code: "AUTH_EMAIL_NOT_VERIFIED",
            message: "Email not verified.",
          },
        },
        { status: 403 },
      );
    }
    return HttpResponse.json({
      access_token: mockToken,
      token_type: "bearer",
      expires_in: 43200,
    });
  }),

  http.get("/auth/me", ({ request }) => {
    const token = readBearerToken(request);
    if (token !== mockToken) {
      return HttpResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Login required.",
          },
        },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      user_id: "usr_mock001",
      email: mockUserEmail,
      role: "user",
      display_name: "Mock User",
      status: "active",
    });
  }),

  http.get("/api/home-summary", ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    return HttpResponse.json(homeSummary);
  }),

  http.get("/api/practice-bundle", ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    const url = new URL(request.url);
    const docId = url.searchParams.get("docId") ?? undefined;
    const segmentId = url.searchParams.get("segmentId") ?? undefined;
    return HttpResponse.json(getPracticeBundleByDocIdAndSegmentId(docId, segmentId));
  }),

  http.post("/api/practice-recognition", async ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    const body = (await request.json()) as { docId?: string; segmentId?: string };
    return HttpResponse.json(getPracticeResultByDocIdAndSegmentId(body.docId, body.segmentId));
  }),

  http.get("/api/progress-summary", ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    return HttpResponse.json(progressSummary);
  }),

  http.get("/api/me-summary", ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    return HttpResponse.json(meSummary);
  }),
];
