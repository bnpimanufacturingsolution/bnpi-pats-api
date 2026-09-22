# Bandai PATS API — Environment URLs & Deployment

## Environment Overview

| Environment | PATS_ENV | API Port | Web Port | DB Port | Seed Mode |
|-------------|----------|----------|----------|---------|-----------|
| **DEV**     | `dev`    | 3101     | 3100     | 15433   | `demo`    |
| **UAT**     | `uat`    | 3201     | 3200     | 15434   | `uat`     |
| **PROD**    | `prod`   | 3001     | 3000     | 15432   | `none`    |

---

## Local Development URLs

### DEV
```
API:       http://localhost:3101
Health:    http://localhost:3101/health
Dashboard: http://localhost:3101/health/dashboard
Endpoints: http://localhost:3101/
Web:       http://localhost:3100
```

### UAT
```
API:       http://localhost:3201
Health:    http://localhost:3201/health
Dashboard: http://localhost:3201/health/dashboard
Endpoints: http://localhost:3201/
Web:       http://localhost:3200
```

### PROD
```
API:       http://localhost:3001
Health:    http://localhost:3001/health
Dashboard: http://localhost:3001/health/dashboard
Endpoints: http://localhost:3001/
Web:       http://localhost:3000
```

---

## Production Public URLs (with nginx)

| Environment | API URL | Dashboard URL |
|-------------|---------|---------------|
| **DEV**     | `https://dev-api.bnpipats.tech` | `https://dev-api.bnpipats.tech/health/dashboard` |
| **UAT**     | `https://uat-api.bnpipats.tech` | `https://uat-api.bnpipats.tech/health/dashboard` |
| **PROD**    | `https://api.bnpipats.tech` | `https://api.bnpipats.tech/health/dashboard` |

> **Note:** Production uses nginx reverse proxy on port 80/443. The API container exposes port 3001 internally; nginx proxies `api.bnpipats.tech` → `app:3001`.

---

## Deployment Commands

### Prerequisites
```bash
# From project root
cd /path/to/bnpi-pats-api
```

### DEV
```bash
docker compose \
  -f deploy/docker-compose.pats.yml \
  -p pats-dev \
  --env-file deploy/contract/dev.env \
  up -d --build
```

### UAT
```bash
docker compose \
  -f deploy/docker-compose.pats.yml \
  -p pats-uat \
  --env-file deploy/contract/uat.env \
  up -d --build
```

### PROD
```bash
docker compose \
  -f deploy/docker-compose.pats.yml \
  -p pats-prod \
  --env-file deploy/contract/prod.env \
  up -d --build
```

---

## Health Endpoints

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `GET /health` | Basic health + SLA status | No |
| `GET /health/dashboard` | Visual HTML dashboard with domain status | No |
| `GET /` | JSON list of all 121+ endpoints | No |
| `GET /health/redis` | Redis connectivity check | Yes (JWT) |
| `GET /api/v1/health` | Canonical PATS health (minimal) | No |

### Example Responses

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-18T09:08:14.243Z",
  "uptime": 57.57,
  "message": "SLA monitoring is active"
}
```

**GET /** (endpoint catalog)
```json
{
  "status": "healthy",
  "timestamp": "2026-09-18T09:08:52.123Z",
  "uptime": 95.3,
  "totalEndpoints": 121,
  "endpoints": [
    { "method": "GET", "path": "/api/v1/health", "summary": "Health check", "tags": ["System"] },
    { "method": "POST", "path": "/api/v1/auth/login", "summary": "User login", "tags": ["Auth"] },
    ...
  ]
}
```

---

## Maintenance Page (Auto-shown when API down)

When the API container is stopped/crashed, nginx automatically serves a custom maintenance page at **all routes except `/health`**:

- **Animated status badge** with pulsing indicator
- **Domain info card** showing detected time & estimated recovery
- **Progress bar** with 30-second countdown
- **"Check Status Now" button** with loading spinner
- **Auto-retry** every 30 seconds + on browser tab focus
- **Instant reload** when API recovers (detects `/health` 200 OK)

Files:
- `nginx/html/maintenance.html` — maintenance page
- `nginx/conf.d/default.conf` — nginx config with `proxy_intercept_errors` + `error_page 503 /maintenance.html`

---

## Environment Variables Reference

### From `deploy/contract/<env>.env`

```bash
# Required
PATS_ENV=dev|uat|prod
APP_PORT=<web port>
API_PORT=<api port>
DB_HOST_PORT=<postgres host port>
SEED_MODE=demo|uat|none
CORS_ORIGINS=<frontend origin>
PATS_VERSION=dev|uat|latest-stable
POSTGRES_DB=pats
POSTGRES_USER=pats
POSTGRES_PASSWORD=<secret>

# Injected at runtime (not in .env)
JWT_SECRET=<from host secret bootstrap>
MINIO_ROOT_USER=<from host>
MINIO_ROOT_PASSWORD=<from host>
```

---

## Docker Compose Profiles

The main `docker-compose.yml` uses profiles:

```yaml
services:
  app:
    profiles: ["pats"]      # Only starts with --profile pats
  nginx:
    profiles: ["pats"]      # Only starts with --profile pats
  mongo:
    profiles: ["legacy"]    # Legacy MongoDB
  redis:
    profiles: ["redis"]     # Optional Redis
```

**Always use `--profile pats`** for PATS API deployment.

---

## Verification Checklist

After deployment, verify:

- [ ] `curl https://<env>.bnpipats.tech/health` returns `{"status":"healthy"}`
- [ ] `curl https://<env>.bnpipats.tech/health/dashboard` returns HTML dashboard
- [ ] `curl https://<env>.bnpipats.tech/` returns JSON endpoint list
- [ ] Stop API container → maintenance page shows at `https://<env>.bnpipats.tech/`
- [ ] Start API container → dashboard reloads automatically
- [ ] WebSocket `/socket.io/` works (if using real-time features)

---

## Troubleshooting

### Nginx fails to start
```bash
# Check upstream resolution
docker exec bnpi-pats-nginx nginx -t

# Verify app container name matches upstream
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Health check fails
```bash
# Check app logs
docker compose -f deploy/docker-compose.pats.yml -p pats-<env> logs app --tail 50

# Test internal connectivity
docker exec bnpi-pats-nginx wget -q --spider http://app:3001/health && echo "OK"
```

### Port conflicts
```bash
# Check port usage
netstat -tulpn | grep -E '3000|3001|3100|3101|3200|3201'
```

---

## Related Files

| File | Description |
|------|-------------|
| `docker-compose.yml` | Main compose with nginx + app |
| `deploy/docker-compose.pats.yml` | Per-environment stack |
| `deploy/contract/dev.env` | DEV environment variables |
| `deploy/contract/uat.env` | UAT environment variables |
| `deploy/contract/prod.env` | PROD environment variables |
| `nginx/conf.d/default.conf` | Nginx reverse proxy config |
| `nginx/html/maintenance.html` | Custom maintenance page |
| `app/create-app.ts` | Health endpoints implementation |
| `app/docs/endpointGenerator.ts` | Dynamic endpoint discovery |