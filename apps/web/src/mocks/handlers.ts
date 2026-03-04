import { HttpResponse, http } from "msw";
import {
  createMockArticle,
  detectMockLanguage,
  getPracticeBundleByDocIdAndSegmentId,
  getPracticeResultByDocIdAndSegmentId,
  homeSummary,
  listMockArticles,
  meSummary,
  progressSummary,
} from "./data";
import type { ArticleLanguage, ArticleSourceType } from "../domain/article/entities";

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

  http.get("/articles", ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
    const list = listMockArticles(Number.isFinite(limit) ? limit : 20);
    return HttpResponse.json({
      items: list.items.map((item) => ({
        article_id: item.articleId,
        title: item.title,
        language: item.language,
        segment_count: item.segmentCount,
        created_at: item.createdAt,
      })),
      next_cursor: list.nextCursor ?? null,
    });
  }),

  http.post("/articles", async ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    let title = "";
    let language: ArticleLanguage = "ja";
    let sourceType: ArticleSourceType = "manual";
    let text = "";

    if (contentType.startsWith("application/json")) {
      const body = (await request.json()) as {
        title?: string;
        language?: ArticleLanguage;
        source_type?: ArticleSourceType;
        text?: string;
      };
      title = body.title?.trim() ?? "";
      language = body.language ?? "ja";
      sourceType = body.source_type ?? "manual";
      text = body.text ?? "";
    } else if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      title = String(formData.get("title") ?? "").trim();
      language = String(formData.get("language") ?? "ja") as ArticleLanguage;
      sourceType = String(formData.get("source_type") ?? "upload") as ArticleSourceType;
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "File is required.",
            },
          },
          { status: 400 },
        );
      }
      if (sourceType === "upload") {
        text = await file.text();
      } else {
        text = `[OCR] ${file.name}`;
      }
    } else {
      return HttpResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Unsupported content type.",
          },
        },
        { status: 400 },
      );
    }

    if (!title || !text.trim()) {
      return HttpResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Title and content are required.",
          },
        },
        { status: 400 },
      );
    }

    const created = createMockArticle({
      title,
      language,
      sourceType,
      text,
    });

    return HttpResponse.json(
      {
        article_id: created.articleId,
        title: created.title,
        language: created.language,
        detected_language: created.detectedLanguage ?? "unknown",
        detected_confidence: created.detectedConfidence ?? null,
        detected_reliable: created.detectedReliable ?? false,
        detected_raw_language: created.detectedRawLanguage ?? "unknown",
        segments: created.segments.map((segment) => ({
          id: segment.id,
          order: segment.order,
          preview: segment.preview,
        })),
      },
      { status: 201 },
    );
  }),

  http.post("/articles/detect-language", async ({ request }) => {
    const unauthorized = ensureAuthorized(request);
    if (unauthorized) return unauthorized;

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    let text = "";

    if (contentType.startsWith("application/json")) {
      const body = (await request.json()) as { text?: string };
      text = body.text ?? "";
    } else if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      const sourceType = String(formData.get("source_type") ?? "upload") as ArticleSourceType;
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "File is required.",
            },
          },
          { status: 400 },
        );
      }
      if (sourceType === "upload") {
        text = await file.text();
      } else if (sourceType === "ocr") {
        text = `[OCR] ${file.name}`;
      }
    }

    const detected = detectMockLanguage(text);
    return HttpResponse.json({
      detected_language: detected.detectedLanguage,
      detected_confidence: detected.detectedConfidence ?? null,
      detected_reliable: detected.detectedReliable,
      detected_raw_language: detected.detectedRawLanguage,
      text_length: detected.textLength,
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
