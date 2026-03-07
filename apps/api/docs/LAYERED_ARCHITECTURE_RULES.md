# API Layered Architecture Rules (Mandatory)

Last updated: 2026-03-07
Scope: `apps/api`

## 1. Layer boundaries

The API project must use the following dependency direction:

`routers (presentation) -> application (usecases) -> infrastructure (repositories) -> db/models`

Allowed:
- `routers` can do request parsing, auth dependency injection, and response shaping only.
- `application` can contain business orchestration and DTO assembly.
- `infrastructure` can contain SQLAlchemy query/write logic.

Forbidden:
- Routers directly executing SQLAlchemy queries.
- Routers implementing business rules (progress, ranking, cross-entity merge logic).
- Cross-layer reverse imports (e.g. infrastructure importing routers).

## 2. Folder convention

Required folders and responsibilities:

- `app/routers/*`
  - HTTP routes only.
  - No DB query code.
- `app/application/usecases/*`
  - Use-case level orchestration.
  - Aggregation logic for BFF/page-level payloads.
- `app/infrastructure/repositories/*`
  - Persistence access (SQLAlchemy statements).
  - Entity-level query methods.

## 3. BFF endpoint rule

For BFF endpoints (e.g. `/api/bff/v1/*`), implementation must follow:

1. Router receives HTTP input.
2. Router creates repository using `db: Session`.
3. Router calls usecase.
4. Usecase assembles final response payload.

This keeps page-level aggregation testable without HTTP coupling.

## 4. Mandatory review checklist

Before merge, each API change must pass:

1. Router file has no `select(...)`, `update(...)`, `delete(...)`, or direct session query.
2. New DB read/write is implemented in repository.
3. New business aggregation is implemented in usecase.
4. `python -m compileall apps/api/app` passes.

## 5. Current adoption

As of this update, `/api/me-summary` and `/api/bff/v1/me` have been migrated to:

- Repository: `app/infrastructure/repositories/protected_repository.py`
- Usecase: `app/application/usecases/protected_me_usecase.py`
- Router: `app/routers/protected.py` (presentation-only for these endpoints)

As of this update, article module endpoints have also been migrated:

- Endpoints:
  - `/api/articles`
  - `/api/articles/{article_id}`
  - `/api/articles/detect-language`
  - `/api/bff/v1/articles`
  - `/api/bff/v1/articles/{article_id}`
  - `/api/bff/v1/articles/detect-language`
- Repository: `app/infrastructure/repositories/article_repository.py`
- Usecase: `app/application/usecases/article_usecase.py`
- Router helpers (request parsing): `app/routers/article_request_parser.py`
- Router: `app/routers/articles.py` (presentation-only)
