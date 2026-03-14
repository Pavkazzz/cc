# DivKit Preview Service

HTTP service that renders DivKit layouts as PNG screenshots.

## How it works

1. Receives a GET request at `/{id}/preview.png`
2. Fetches the DivKit layout JSON from PostgreSQL
3. Builds an HTML page with DivKit's client-side renderer
4. Opens it in headless Chromium via Playwright
5. Takes a PNG screenshot and returns it

## API

### `GET /{id}/preview.png`

Query parameters:
- `width` — viewport width in pixels (320–1440, default 375)
- `scale` — device scale factor (1.0–3.0, default 2.0)

Response: PNG image with `Cache-Control: public, max-age=300`

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SCREENSHOT_CONCURRENCY` | No | `5` | Max concurrent screenshots |
| `PORT` | No | `8080` | HTTP listen port |

## Development

```bash
pip install -r requirements.txt
playwright install --with-deps chromium
pytest tests/
```

## Docker

```bash
docker build -t divkit-preview .
docker run -p 8080:8080 -e DATABASE_URL=postgresql://... divkit-preview
```
