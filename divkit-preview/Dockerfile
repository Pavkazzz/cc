# Stage 1: Fetch DivKit static assets from npm
FROM node:20-slim AS assets

RUN npm pack @divkitframework/divkit && \
    mkdir -p /divkit-assets && \
    tar xzf divkitframework-divkit-*.tgz --strip-components=1 -C /divkit-assets

# Stage 2: Runtime
FROM python:3.12-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium with system dependencies
RUN playwright install --with-deps chromium

# Copy DivKit static assets from builder stage
COPY --from=assets /divkit-assets/dist/client.css static/divkit/client.css
COPY --from=assets /divkit-assets/dist/browser.js static/divkit/browser.js

# Copy application code
COPY app.py handlers.py screenshot_service.py ./

EXPOSE 8080

CMD ["python", "-m", "app"]
