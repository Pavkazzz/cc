# DivKit Screenshot Worker

Cloudflare Worker that renders [DivKit](https://divkit.tech/) layout JSON to PNG screenshots using the [Browser Rendering API](https://developers.cloudflare.com/browser-rendering/).

## Architecture

```
Client                         Cloudflare Edge
┌──────────┐   POST JSON    ┌─────────────────────────────────┐
│  aiohttp │ ──────────────▸│  Worker: /preview/screenshot     │
│  backend │                │                                   │
└──────────┘                │  1. Hash JSON → cache key         │
                            │  2. Check Cache API (L1, edge)    │
                            │  3. Check R2 (L2, persistent)     │
     ◂──── PNG response ────│  4. Miss → Browser Rendering      │
                            │  5. Store in R2 + Cache API       │
                            │  6. Return PNG                    │
                            └─────────────────────────────────┘
```

Two-tier caching ensures fast responses and minimal browser usage:
- **L1 — Cache API**: Per-PoP edge cache, sub-millisecond lookups
- **L2 — R2**: Global persistent storage, survives cache evictions

## API

### `POST /preview/screenshot`

Render a DivKit layout to PNG.

**Request body** (JSON):

```json
{
  "json": {
    "card": { "log_id": "example", "states": [{ "state_id": 0, "div": { "type": "text", "text": "Hello" } }] },
    "templates": {}
  },
  "width": 375,
  "height": 812,
  "scale": 2
}
```

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `json` | object | yes | — | Must contain a `card` property |
| `width` | int | no | 375 | 200–1440 |
| `height` | int | no | 812 | 200–2048 |
| `scale` | int | no | 2 | 1–3 |

**Response**: `image/png` with headers:
- `X-Cache`: `HIT` or `MISS`
- `X-Cache-Source`: `cache-api`, `r2`, or `browser`
- `Cache-Control`: `public, max-age=3600`

**Errors**: JSON `{ "error": "message" }` with status 400 / 405 / 500 / 503.

### `GET /preview/health`

Returns `{ "status": "ok" }`.

## Example (Python)

```python
import aiohttp

async def get_preview_png(layout_json: dict, width: int = 375) -> bytes:
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://myapp.com/preview/screenshot",
            json={"json": layout_json, "width": width, "scale": 2},
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            if resp.status == 200:
                return await resp.read()
            error = await resp.json()
            raise RuntimeError(f"Screenshot failed: {error}")
```

## Example (curl)

```bash
curl -X POST https://myapp.com/preview/screenshot \
  -H "Content-Type: application/json" \
  -d '{"json":{"card":{"log_id":"test","states":[{"state_id":0,"div":{"type":"text","text":"Hello DivKit"}}]}}}' \
  -o screenshot.png
```

## Development

### Prerequisites

- Node.js >= 18
- npm

### Setup

```bash
cd divkit-screenshot-worker
npm install
```

### Commands

```bash
npm run dev          # Start local dev server (wrangler dev)
npm run test         # Run tests (vitest)
npm run typecheck    # Type-check (tsc --noEmit)
npm run lint         # Lint (eslint)
npm run lint:fix     # Lint and auto-fix
```

### Local development

`wrangler dev` starts a local server with simulated Workers runtime. Note that Browser Rendering is **not available locally** — screenshot requests will fail. Use `wrangler dev --remote` to test against real Cloudflare infrastructure (requires authentication).

For local-only testing, the test suite mocks the browser binding.

## Deployment

### 1. Create R2 bucket

```bash
npx wrangler r2 bucket create divkit-screenshots
```

### 2. Deploy the Worker

```bash
npx wrangler deploy
```

### 3. Add route (Cloudflare Dashboard)

Go to **Workers & Pages → divkit-screenshot → Triggers → Routes** and add:

```
myapp.com/preview/*
```

This routes requests on your existing domain to the Worker. The Cache API requires a custom domain (it won't work on `*.workers.dev`).

### 4. Verify

```bash
curl https://myapp.com/preview/health
# {"status":"ok"}
```

### Environment variables

Configured in `wrangler.toml` (defaults shown):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_WIDTH` | `375` | Default viewport width |
| `DEFAULT_SCALE` | `2` | Default device scale factor |
| `CACHE_TTL_SECONDS` | `3600` | Cache TTL in seconds |

Override per environment with `wrangler.toml` `[env.production.vars]` or via the Cloudflare dashboard.

## Limits

- **Browser Rendering**: 30 concurrent browsers, 30 new instances/minute (paid plan)
- **R2**: 10M class A ops/month free, then $4.50/million
- **Cache API**: No additional cost, tied to your Cloudflare plan
- **Worker**: 30s CPU time limit (paid plan), 128MB memory

The two-tier cache is critical to stay within browser rendering limits under load.

## Project structure

```
divkit-screenshot-worker/
├── src/
│   ├── index.ts          # Worker entry point, routing
│   ├── screenshot.ts     # Browser Rendering logic
│   ├── cache.ts          # R2 + Cache API two-tier caching
│   ├── template.ts       # DivKit HTML template builder
│   ├── hash.ts           # JSON → deterministic cache key
│   └── types.d.ts        # Module declarations
├── static/
│   └── divkit.html       # DivKit renderer HTML shell
├── test/
│   ├── hash.test.ts
│   ├── template.test.ts
│   ├── cache.test.ts
│   └── handler.test.ts
├── wrangler.toml
├── package.json
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```
