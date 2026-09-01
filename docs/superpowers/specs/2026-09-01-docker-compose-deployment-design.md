# Docker Compose Deployment Design

## Goal

Provide a beginner-friendly production deployment for the existing React/Vite application. A user with Docker and Docker Compose installed should be able to build and start the application with one command, then open it at `http://SERVER_IP:8080`.

This first deployment targets one server without a domain name or HTTPS.

## Architecture

The application will use a multi-stage container build:

1. A Node.js 22 Alpine build stage installs the locked dependencies from `web/package-lock.json`, copies the root domain modules imported by the Web application, and runs the existing Vite production build.
2. An Nginx Alpine runtime stage receives only the generated `web/dist` files and the project Nginx configuration.
3. Docker Compose builds the image, maps host port `8080` to container port `80`, restarts the service after failures or server reboots, and reports its health.

No Node.js process, API service, or database will run in production. The application continues to store tasks and focus history in each visitor's browser `localStorage`.

## Files

- `Dockerfile`: reproducible multi-stage frontend build and minimal Nginx runtime image.
- `compose.yaml`: one `web` service, port mapping, restart policy, and HTTP health check.
- `nginx.conf`: static file serving, SPA fallback, cache rules for hashed assets, and basic response headers.
- `.dockerignore`: excludes dependencies, generated output, test artifacts, Git metadata, and local agent files from the build context.
- `README.md`: beginner instructions for prerequisites, starting, checking status, reading logs, rebuilding after updates, stopping, and troubleshooting.

## Runtime Flow

The operator runs:

```bash
docker compose up -d --build
```

Compose builds the frontend image and starts Nginx in the background. The operator verifies it with:

```bash
docker compose ps
docker compose logs -f web
```

The site is then available at `http://SERVER_IP:8080`. After source updates, running `docker compose up -d --build` again rebuilds and replaces the service. Running `docker compose down` stops and removes the service container and Compose network.

## Data And Persistence

There is no server-side application data and therefore no Docker data volume. Rebuilding or deleting the container does not remove data already stored in a visitor's browser. Data does not automatically follow a user to another browser, device, hostname, or port, and clearing browser storage removes it.

## Networking And Security

The initial Compose deployment publishes TCP port 8080 on the server. The server firewall or cloud security group must allow inbound TCP 8080 before another device can connect.

This design does not add TLS. A later deployment can place a TLS reverse proxy in front of the existing container without changing application code.

Nginx will serve `index.html` without long-term caching, while fingerprinted files under `/assets/` may use long-term immutable caching. Unknown application paths fall back to `index.html`; missing asset paths return a normal 404 instead of the HTML entry point.

## Failure Handling

- Docker build failures remain visible in the foreground output of `docker compose up -d --build`.
- The image build uses `npm ci`, so dependency installation must match the committed lockfile.
- The container health check requests the local Nginx root page. Compose reports the service as unhealthy if Nginx cannot serve it.
- `restart: unless-stopped` restarts the web service after a process failure or host reboot unless an operator intentionally stopped it.

## Verification

Implementation verification will include:

1. Validate the Compose model with `docker compose config`.
2. Build the production image through Docker Compose.
3. Start the service and wait for a healthy status.
4. Request `http://127.0.0.1:8080/` and confirm that the generated page is served.
5. Request an application-style path to confirm SPA fallback.
6. Request a missing asset path to confirm it returns 404.
7. Keep the verified deployment running so it is immediately available to the operator.
