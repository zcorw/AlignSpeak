# AlignSpeak

[中文](README.md) | [English](README.en.md)

AlignSpeak is an AI-assisted reading and speaking practice project.

## Project Structure

- `apps/web_v2`: frontend (React + Vite)
- `apps/api`: backend (FastAPI)
- `deploy/production`: production deployment files

## Quick Start (Local)

1. Prepare backend environment variables:

```powershell
Copy-Item apps/api/.env.secrets.example apps/api/.env.secrets
```

2. Edit `apps/api/.env.secrets` and fill at least:
`JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `OPENAI_API_KEY`.

3. Start all services:

```powershell
docker compose up -d --build
```

4. Open:

- Frontend: `http://localhost/`
- API health check: `http://localhost/api/health`
- DB admin (optional): `http://127.0.0.1:18080`

## Common Commands

```powershell
# Service status
docker compose ps

# Logs
docker compose logs -f web
docker compose logs -f api

# Stop services
docker compose down
```

## More Documentation

- `OVERVIEW.md`
- `ARCHITECTURE.md`
- `deploy/production/README.md`
