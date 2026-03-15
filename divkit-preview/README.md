# DivKit Preview Service

HTTP service that renders DivKit layouts as PNG screenshots using headless Chromium.

## How it works

1. Receives a `POST /preview.png` with DivKit layout JSON in the body
2. Builds an HTML page with DivKit's client-side renderer
3. Opens it in headless Chromium via Playwright
4. Takes a PNG screenshot and returns it

## API

### `POST /preview.png`

**Request body**: DivKit layout JSON object

**Query parameters** (optional):
- `width` — viewport width in pixels (320–1440, default 375)
- `scale` — device scale factor (1.0–3.0, default 2.0)

**Response**: PNG image with `Content-Type: image/png` and `Cache-Control: public, max-age=300`

**Example**:
```bash
curl -X POST http://localhost:8080/preview.png \
  -H "Content-Type: application/json" \
  -d '{"card":{"log_id":"test","states":[{"state_id":0,"div":{"type":"text","text":"Hello!","font_size":20}}]}}' \
  -o preview.png
```

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"error": "Invalid JSON body"}` | Non-JSON or non-object body |
| 400 | `{"error": "Invalid width: ..."}` | width outside 320–1440 |
| 400 | `{"error": "Invalid scale: ..."}` | scale outside 1.0–3.0 |
| 500 | `{"error": "Screenshot timed out"}` | Render exceeded 10s |
| 500 | `{"error": "Screenshot failed"}` | Chromium error |

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SCREENSHOT_CONCURRENCY` | No | `5` | Max concurrent screenshots |
| `PORT` | No | `8080` | HTTP listen port |

## Development

```bash
uv sync --extra test
uv run playwright install --with-deps chromium
uv run pytest tests/
```

## Docker

```bash
docker build -t divkit-preview .
docker run -p 8080:8080 divkit-preview
```
