# Stage 1: Fetch DivKit static assets from npm
FROM node:20-slim AS assets

RUN npm pack @divkitframework/divkit && \
    mkdir -p /divkit-assets && \
    tar xzf divkitframework-divkit-*.tgz --strip-components=1 -C /divkit-assets

# Stage 2: Runtime
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies via uv
COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

# Install Playwright Chromium with system dependencies
RUN uv run playwright install --with-deps chromium

# Copy DivKit static assets from builder stage
COPY --from=assets /divkit-assets/dist/client.css static/divkit/client.css
COPY --from=assets /divkit-assets/dist/browser.js static/divkit/browser.js

# Copy application code
COPY app.py handlers.py screenshot_service.py ./

EXPOSE 8080

CMD ["uv", "run", "python", "-m", "app"]
