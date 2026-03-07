# OCR Plugin Module

## Goal
The upload parsing flow supports pluggable OCR providers and defaults to OpenAI OCR.

## Entry Point
- `app/services/article_service.py`
  - `extract_text_from_image(...)` validates file extension.
  - Delegates OCR work to `app/services/ocr_service.py`.

## Provider Contract
- `OCRProvider` protocol:
  - `extract_text(filename: str, content: bytes, language: str) -> str`

## Built-in Providers
- `openai` (default)
  - Calls OpenAI Responses API with image input.
  - Returns plain extracted text.
- `tesseract`
  - Local OCR fallback based on `pytesseract`.

## Runtime Configuration
- `OCR_PROVIDER` (`openai` or `tesseract`, default: `openai`)
- `OPENAI_API_KEY` (required when provider is `openai`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- `OPENAI_OCR_MODEL` (default: `gpt-4.1-mini`)
- `OPENAI_OCR_TIMEOUT_SECONDS` (default: `45`)

### Secrets File
- Docker compose loads sensitive values from `apps/api/.env.secrets`.
- Commit-safe template: `apps/api/.env.secrets.example`.
- Keep real keys only in local `apps/api/.env.secrets` (git-ignored).
- Current sensitive keys in this file:
  - `OPENAI_API_KEY`
  - `JWT_SECRET`
  - `POSTGRES_PASSWORD`
  - `DATABASE_URL`

## API Behavior
`POST /api/bff/v1/articles/parse-upload`
- `txt/md`: parse as text file
- `png/jpg/jpeg/webp`: parse with configured OCR provider
- OCR returns empty text: `OCR_EMPTY_TEXT`
- OpenAI call failure: `OCR_PROVIDER_ERROR`
