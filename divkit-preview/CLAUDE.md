# DivKit Preview Service

## Project overview
Standalone HTTP service that renders DivKit (Server-Driven UI) layouts to PNG screenshots.
Uses headless Chromium via Playwright to render DivKit's client-side JS, then screenshots the result.

## Architecture
- `app.py` — aiohttp application wiring, startup/shutdown lifecycle
- `handlers.py` — POST /preview.png handler, validates params, returns PNG
- `screenshot_service.py` — singleton Chromium browser manager, concurrency-limited via asyncio.Semaphore
- `static/divkit/` — bundled DivKit CSS/JS (fetched from npm at Docker build time, inlined into HTML at runtime)

## Key technical decisions
- DivKit assets are inlined directly into the HTML string (no file:// protocol, no CORS issues)
- One persistent Chromium browser, fresh context+page per screenshot for isolation
- `wait_until="networkidle"` for correctness (layouts may reference external images)
- `full_page=True` screenshot to capture entire rendered height
- 10-second timeout on screenshot operations
- No Node.js runtime needed — only the static browser.js and client.css files

## Commands
- Install deps: `cd divkit-preview && uv sync --extra test`
- Run tests: `cd divkit-preview && uv run pytest tests/`
- Run single test: `cd divkit-preview && uv run pytest tests/test_handlers.py::test_preview_success`
- Build Docker: `docker build -t divkit-preview divkit-preview/`
- Run locally: `cd divkit-preview && uv run python -m app` (needs Playwright + Chromium installed)

## Code style
- Python 3.12, type hints everywhere
- async/await throughout, no sync blocking
- f-strings for formatting
- `logging.getLogger(__name__)` per module
- No over-engineering: no ABCs, no DI frameworks
