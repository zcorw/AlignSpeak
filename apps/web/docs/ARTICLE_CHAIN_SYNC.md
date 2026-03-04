# Web Article Chain Sync (MVP)

Updated: 2026-03-03

## Scope
- Home page now prioritizes article creation.
- Web is connected to API article endpoints:
  - `POST /articles` (manual/upload/ocr)
  - `GET /articles`
- Auth token is injected through axios interceptor for these endpoints.

## Implementation Notes
- Added article domain models:
  - `src/domain/article/entities.ts`
- Extended app repository/use cases:
  - `createArticle`
  - `listArticles`
- Home page behavior:
  - Supports `manual` text creation.
  - Supports file-based creation (`upload` / `ocr`) via multipart.
  - Shows latest create result with returned `segments`.
  - Shows recent article list from `GET /articles`.
- HTTP client:
  - Added `postMultipart`.
  - Avoids forcing `Content-Type: application/json` for `FormData`.
- Dev setup:
  - Added Vite proxy for `/articles`.
  - Added MSW handlers for `/articles` in mock mode.

## Remaining Gaps
- `GET /articles/{article_id}` is not yet connected in web UI.
- Practice flow still uses existing `/api/practice-*` mock-style endpoints; full article-to-practice binding is pending later modules.

## Verification
- `yarn lint` passed.
- `yarn build` passed.
