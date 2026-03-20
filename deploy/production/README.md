# Production Deployment

## Design

- CI and CD are separated. Pull requests only verify quality; merges to `main` publish images and deploy.
- Production uses immutable Docker images instead of building on the server. This makes deployment deterministic and rollback simple.
- The Ubuntu host keeps the public Nginx role. Compose only runs `web`, `api`, and `db`, all bound to `127.0.0.1`.
- Application secrets stay on the server in `.env.production`. GitHub Actions only needs SSH access, plus optional GHCR credentials if the registry is private.

## Repository workflows

- `.github/workflows/ci.yml`
  - Trigger: pull requests and pushes to `main`
  - Web: install dependencies, lint, run Vitest in CI mode, build Vite production bundle
  - API: install Python dependencies, compile source, import the FastAPI app as a smoke test
- `.github/workflows/deploy-production.yml`
  - Trigger: push to `main`
  - Optional trigger: `workflow_dispatch` with an existing image tag for rollback
  - Detect which application area changed on `main`
  - Only build and push the changed image to GHCR
  - Only restart the changed service on the server when the change is limited to `web` or `api`
  - Upload the compose bundle to the server
  - Poll the updated container health status before marking the deployment successful

## Server layout

Use a dedicated release directory, for example `/opt/alignspeak`:

```text
/opt/alignspeak
|- compose.yml
|- .env.production
|- .images.env
`- data
   |- media/tts
   |- media/stt
   `- postgres
```

## Server Initialization

### 1. Prepare the host

Complete these one-time prerequisites on the Ubuntu 22.04 server:

- Install Docker Engine and the Docker Compose plugin
- Confirm host Nginx is installed and running
- Make sure ports `80` and `443` are reachable from the internet
- Make sure the deploy user can run Docker commands

### 2. Create the deployment directory

Create the release directory on the server:

- `/opt/alignspeak`
- `/opt/alignspeak/data/postgres`
- `/opt/alignspeak/data/media/tts`
- `/opt/alignspeak/data/media/stt`

If you use a different root directory, keep it consistent with the GitHub secret `DEPLOY_PATH`.

### 3. Put repository files onto the server

Place these files at the target paths before the first deployment:

- [`deploy/production/compose.yml`](/d:/Workspace/money/AlignSpeak/deploy/production/compose.yml) -> `/opt/alignspeak/compose.yml`
- [`deploy/production/.env.production.example`](/d:/Workspace/money/AlignSpeak/deploy/production/.env.production.example) -> `/opt/alignspeak/.env.production`
- [`deploy/production/readonly-user.sql`](/d:/Workspace/money/AlignSpeak/deploy/production/readonly-user.sql) -> `/opt/alignspeak/readonly-user.sql`
- [`deploy/production/host-nginx/alignspeak.conf`](/d:/Workspace/money/AlignSpeak/deploy/production/host-nginx/alignspeak.conf) -> `/etc/nginx/sites-available/alignspeak.conf`
- [`deploy/production/host-nginx/alignspeak-db-admin.conf`](/d:/Workspace/money/AlignSpeak/deploy/production/host-nginx/alignspeak-db-admin.conf) -> `/etc/nginx/sites-available/alignspeak-db-admin.conf` if you want Adminer behind host Nginx

The deployment workflow will later update `compose.yml` and `.images.env` automatically inside `DEPLOY_PATH`.

### 4. Update values in `.env.production`

Edit `/opt/alignspeak/.env.production` and replace the placeholder values.

Required values:

- `JWT_SECRET`: the signing secret used by the API to generate and validate JWT access tokens
- `POSTGRES_PASSWORD`: the password for the production Postgres application user
- `DATABASE_URL`: the SQLAlchemy connection string used by the API container to reach the `db` service
- `OPENAI_API_KEY`: the production API key for OCR and STT features

Optional values:

- `OCR_PROVIDER`: selects which OCR backend the API should use
- `OPENAI_BASE_URL`: base URL for OpenAI-compatible requests
- `OPENAI_OCR_MODEL`: OCR model name used by the backend
- `OPENAI_OCR_TIMEOUT_SECONDS`: OCR request timeout in seconds
- `STT_PROVIDER`: selects which speech-to-text backend the API should use
- `OPENAI_STT_MODEL`: speech-to-text model name used by the backend
- `OPENAI_STT_TIMEOUT_SECONDS`: speech-to-text request timeout in seconds
- `ACCESS_TOKEN_EXPIRE_SECONDS`: JWT validity duration in seconds
- `WEB_PORT`: loopback port exposed by the frontend container for host Nginx upstream
- `API_PORT`: loopback port exposed by the API container for host Nginx upstream
- `DB_ADMIN_PORT`: loopback port reserved for the optional browser-based database admin container
- `DB_ADMIN_ENABLED`: whether the deployment workflow should include the `db-admin` Compose profile on the server

### 5. Update values in the host Nginx config

Edit `/etc/nginx/sites-available/alignspeak.conf` before enabling it.

Values to replace:

- `server_name`: the public domain name that should serve AlignSpeak
- `ssl_certificate`: the full-chain certificate path used by Nginx on port `443`
- `ssl_certificate_key`: the private key path matching the certificate above

The upstream ports in this file should match `WEB_PORT` and `API_PORT` from `/opt/alignspeak/.env.production`.

After that:

- Link the file into `/etc/nginx/sites-enabled/`
- Run `nginx -t`
- Reload Nginx

If you also want browser access to Adminer through host Nginx, edit [`deploy/production/host-nginx/alignspeak-db-admin.conf`](/d:/Workspace/money/AlignSpeak/deploy/production/host-nginx/alignspeak-db-admin.conf) before enabling it:

- Replace `server_name` with a dedicated admin-only domain such as `db-admin.your-domain.com`
- Replace `ssl_certificate` and `ssl_certificate_key`
- Replace the sample `allow` rule with your fixed office IP or VPN CIDR
- Keep `deny all` unless you are intentionally opening access more broadly

Then:

- Enable the `db-admin` Compose profile
- Link `/etc/nginx/sites-available/alignspeak-db-admin.conf` into `/etc/nginx/sites-enabled/`
- Run `nginx -t`
- Reload Nginx

### 6. Optional GHCR authentication

If the GHCR packages are private, authenticate the server with `ghcr.io` once, or provide `GHCR_USERNAME` and `GHCR_PAT` in the GitHub `production` environment.

### 7. Create the read-only database account

Edit `/opt/alignspeak/readonly-user.sql` and replace:

- `replace-with-readonly-password`: password for the local inspection account `alignspeak_ro`

Then run the SQL inside the production Postgres container:

```bash
cd /opt/alignspeak
docker compose -f compose.yml exec -T db psql -U alignspeak -d alignspeak < readonly-user.sql
```

### 8. First deployment verification

After the first successful GitHub deployment:

- Check `docker compose -f /opt/alignspeak/compose.yml ps`
- Check `https://your-domain/`
- Check `https://your-domain/api/health`

## Browser Database Admin

For local development, `docker-compose.yml` now includes an `Adminer` container bound to `127.0.0.1:${DB_ADMIN_PORT:-18080}`.

Open:

- `http://127.0.0.1:18080` by default

Start the local stack as usual:

```bash
docker compose up -d
```

Use these login values:

- System: `PostgreSQL`
- Server: `db`
- Username: `alignspeak`
- Password: the `POSTGRES_PASSWORD` value from your secrets file
- Database: `alignspeak`

For production, the same `Adminer` container is present but disabled by default and only binds to loopback when enabled:

```bash
cd /opt/alignspeak
docker compose -f compose.yml --profile db-admin up -d db_admin
```

If you want future GitHub deployments to keep this container running automatically, set `DB_ADMIN_ENABLED=true` in `/opt/alignspeak/.env.production`.

Then access:

- `http://127.0.0.1:18080`

Keep this profile off when not in use. It is meant for temporary maintenance on the server or via SSH tunnel, not for public exposure.

## GitHub configuration

Create a GitHub Environment named `production` and define:

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME` (optional)
- `GHCR_PAT` (optional)

Recommended repository settings:

- Protect `main`
- Require the `CI` workflow to pass before merge
- Restrict direct pushes to `main`

## Local Access To Production Data

The production database should stay bound to `127.0.0.1:5432` on the Ubuntu host. Do not open it to the public internet.

Use this model instead:

- Local read access: SSH tunnel from your laptop to the server
- Local debugging: connect DBeaver/DataGrip/pgAdmin to the tunneled port
- Stronger safety: use the dedicated `alignspeak_ro` account, not the application account

### 1. Create the read-only role

Run this once on the server after replacing the password placeholder in [`readonly-user.sql`](/d:/Workspace/money/AlignSpeak/deploy/production/readonly-user.sql):

```bash
cd /opt/alignspeak
docker compose -f compose.yml exec -T db psql -U alignspeak -d alignspeak < readonly-user.sql
```

### 2. Open an SSH tunnel from your local machine

On Windows PowerShell:

```powershell
.\deploy\production\scripts\open-prod-db-tunnel.ps1 -Host your.server.ip -User deploy -Port 22 -LocalPort 15432
```

This forwards local `127.0.0.1:15432` to the server-side Postgres `127.0.0.1:5432`.

### 3. Connect your local SQL client

Use these connection settings in DBeaver, DataGrip, `psql`, or pgAdmin:

- Host: `127.0.0.1`
- Port: `15432`
- Database: `alignspeak`
- Username: `alignspeak_ro`
- Password: the read-only password you set in `readonly-user.sql`

If you want your local backend to temporarily run against production data for inspection, override `DATABASE_URL` locally:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://alignspeak_ro:your_password@127.0.0.1:15432/alignspeak"
```

Use that only for read-only troubleshooting. Do not point local write flows or migrations at production.

## Rollback

1. Open the `Deploy Production` workflow in GitHub Actions.
2. Run `workflow_dispatch`.
3. Pass a previously published commit SHA as `image_tag`.

Because `web` and `api` images are tagged with the same commit SHA, rollback is consistent across both services.
