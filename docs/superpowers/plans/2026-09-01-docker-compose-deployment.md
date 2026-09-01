# Docker Compose Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run the existing React/Vite application as a production Nginx container with `docker compose up -d --build`, accessible on host port 8080.

**Architecture:** A multi-stage Dockerfile uses Node.js 22 Alpine and the committed Web lockfile to generate `web/dist`, then copies only the static output into Nginx Alpine. Compose owns the build, port mapping, restart policy, and health check; Nginx owns static delivery, SPA fallback, and cache behavior.

**Tech Stack:** Docker Engine, Docker Compose, Node.js 22 Alpine, npm, Vite, Nginx Alpine

**Spec:** `docs/superpowers/specs/2026-09-01-docker-compose-deployment-design.md`

## Global Constraints

- The first deployment is a single server without a domain name or HTTPS.
- The application must be available at `http://SERVER_IP:8080`.
- Production must not run a Node.js process, HTTP API, or database.
- Tasks and focus history must remain in each visitor's browser `localStorage`; no Docker volume is required.
- Dependency installation must use `npm ci` with `web/package-lock.json`.
- Unknown application paths must fall back to `index.html`, while missing paths under `/assets/` must return HTTP 404.
- Fingerprinted `/assets/` files may be cached immutably; `index.html` must not use long-term caching.

---

### Task 1: Production Container And Compose Service

**Files:**
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `nginx.conf`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `web/package.json`, `web/package-lock.json`, `web/src/**`, `web/index.html`, `web/vite.config.js`, and root `src/**` domain modules as the Vite build input.
- Produces: Compose service `web`, image `rixu-web:local`, host endpoint `http://127.0.0.1:8080`, container health status, and static Nginx responses.

- [x] **Step 1: Record the missing deployment baseline**

Run:

```bash
test -f Dockerfile && test -f compose.yaml && test -f nginx.conf && test -f .dockerignore
```

Expected: exit code 1 because the four deployment files do not exist yet.

- [x] **Step 2: Create the multi-stage Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine AS build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
COPY src/ /app/src/
RUN npm run build

FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80
```

- [x] **Step 3: Create the Nginx production configuration**

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        expires -1;
        add_header Cache-Control "no-store";
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

- [x] **Step 4: Create the Compose service and build-context exclusions**

Create `compose.yaml`:

```yaml
name: rixu

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: rixu-web:local
    restart: unless-stopped
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1/ || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Create `.dockerignore`:

```gitignore
.git/
.agents/
.codex/
.superpowers/
.teamos/
node_modules/
web/node_modules/
dist/
web/dist/
coverage/
test-results/
web/test-results/
playwright-report/
web/playwright-report/
*.log
.env
.env.*
```

- [x] **Step 5: Validate the Compose model**

Run:

```bash
docker compose config --quiet
docker compose config --images
```

Expected: both commands exit 0, and the second prints `rixu-web:local`.

- [x] **Step 6: Build and start the production service**

Run:

```bash
docker compose up -d --build --wait
docker compose ps
```

Expected: image build succeeds; service `web` is `Up` and `healthy`; published port is `0.0.0.0:8080->80/tcp` or the IPv6 equivalent.

- [x] **Step 7: Verify HTTP, SPA fallback, assets, and cache headers**

Run:

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/ | grep -F '<div id="root"></div>'
curl --fail --silent --show-error http://127.0.0.1:8080/focus-stats | grep -F '<div id="root"></div>'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8080/assets/missing.js)" = "404"
curl --silent --head http://127.0.0.1:8080/index.html | grep -i 'Cache-Control: no-store'
```

Expected: all four commands exit 0; both application requests contain the React root; the missing asset returns 404; `index.html` returns `Cache-Control: no-store`.

- [x] **Step 8: Review the deployment diff**

Run:

```bash
git diff --check
git diff -- Dockerfile compose.yaml nginx.conf .dockerignore
```

Expected: `git diff --check` exits 0 and the diff contains only the intended container configuration.

### Task 2: Beginner Deployment Documentation

**Files:**
- Modify: `README.md` after the existing local startup instructions

**Interfaces:**
- Consumes: Compose service `web` and host port `8080` from Task 1.
- Produces: Copy-and-run commands for installation checks, build/start, health/status, logs, updates, shutdown, browser storage behavior, firewall access, and troubleshooting.

- [x] **Step 1: Record the missing documentation baseline**

Run:

```bash
grep -F 'docker compose up -d --build' README.md
```

Expected: exit code 1 because Docker Compose instructions are not documented yet.

- [x] **Step 2: Add the Docker Compose deployment section**

Add a `## 使用 Docker Compose 部署` section after the local development section. It must include these exact command groups and explanations:

```bash
# Check prerequisites
docker --version
docker compose version

# Run from the project root
docker compose up -d --build --wait
docker compose ps

# Follow logs; Ctrl+C exits log viewing without stopping the service
docker compose logs -f web

# Rebuild after source updates
docker compose up -d --build --wait

# Stop and remove the service container and Compose network
docker compose down
```

Document `http://SERVER_IP:8080`, inbound TCP port 8080, `localStorage` persistence boundaries, the meaning of `permission denied ... docker.sock`, and how to inspect failures with `docker compose ps` and `docker compose logs web`.

- [x] **Step 3: Verify all operator workflows are documented**

Run:

```bash
grep -F 'docker compose up -d --build --wait' README.md
grep -F 'docker compose ps' README.md
grep -F 'docker compose logs -f web' README.md
grep -F 'docker compose down' README.md
grep -F 'http://服务器IP:8080' README.md
grep -F 'localStorage' README.md
grep -F 'docker.sock' README.md
```

Expected: every command exits 0 and prints the matching documentation line.

- [x] **Step 4: Review the documentation diff**

Run:

```bash
git diff --check
git diff -- README.md
```

Expected: no whitespace errors, and the README diff contains only the new deployment guidance.

### Task 3: Full Regression And Deployment Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-01-docker-compose-deployment.md` (mark completed checkboxes)

**Interfaces:**
- Consumes: all deployment files and documentation from Tasks 1 and 2.
- Produces: fresh evidence that application tests, production build, Compose configuration, container health, and HTTP behavior all pass together.

- [x] **Step 1: Run the domain regression suite**

Run:

```bash
npm test
```

Expected: exit code 0 with all domain tests passing.

- [x] **Step 2: Run the Web regression suite and local production build**

Run:

```bash
cd web
npm test
npm run build
cd ..
```

Expected: both Web commands exit 0; Vitest reports no failed tests and Vite writes a production build to `web/dist`.

- [x] **Step 3: Rebuild the exact Compose deployment and wait for health**

Run:

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

Expected: all commands exit 0 and the `web` service reports `healthy`.

- [x] **Step 4: Run the final HTTP smoke checks**

Run:

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/ | grep -F '<title>日序 · 日期驱动任务</title>'
curl --fail --silent --show-error http://127.0.0.1:8080/today | grep -F '<div id="root"></div>'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8080/assets/not-found.css)" = "404"
```

Expected: all commands exit 0.

- [x] **Step 5: Inspect final status and keep the verified service running**

Run:

```bash
git diff --check
git status --short
docker compose ps
```

Expected: no whitespace errors; Git lists only the intended deployment plan/configuration/documentation changes; Compose reports the `web` service healthy on port 8080.

- [x] **Step 6: Create the deployment commit after user approval**

Run only when the user explicitly asks to commit:

```bash
git add .dockerignore Dockerfile compose.yaml nginx.conf README.md docs/superpowers/plans/2026-09-01-docker-compose-deployment.md docs/superpowers/specs/2026-09-01-docker-compose-deployment-design.md
git commit -m "feat: add Docker Compose deployment"
```

Expected: one commit containing only the deployment configuration, instructions, spec, and implementation plan.
