FROM python:3.12-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install system deps needed by Playwright/Chromium and npm (for fetching static assets)
RUN apt-get update && \
    apt-get install -y --no-install-recommends npm && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium with system dependencies
RUN playwright install --with-deps chromium

# Bundle DivKit static assets from npm (CSS + JS only, no Node runtime needed)
RUN mkdir -p static/divkit /tmp/divkit-pkg && \
    npm pack @divkitframework/divkit && \
    tar xzf divkitframework-divkit-*.tgz --strip-components=1 -C /tmp/divkit-pkg && \
    cp /tmp/divkit-pkg/dist/client.css static/divkit/client.css && \
    cp /tmp/divkit-pkg/dist/browser.js static/divkit/browser.js && \
    rm -rf /tmp/divkit-pkg *.tgz

# Remove npm — not needed at runtime
RUN apt-get purge -y npm && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY app.py handlers.py screenshot_service.py db.py ./

EXPOSE 8080

CMD ["python", "-m", "app"]
