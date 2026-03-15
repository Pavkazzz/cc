# DivKit Screenshot Worker

## Project overview
Cloudflare Worker that renders DivKit layout JSON to PNG via Browser Rendering API (headless Chromium).
Two-tier cache: Cache API (L1 edge) + R2 (L2 persistent). Deployed on a subpath of an existing domain.

## Architecture
- `src/index.ts` — Worker entry point, routing (`POST /preview/screenshot`, `GET /preview/health`), request validation
- `src/screenshot.ts` — Puppeteer-based screenshot capture via `@cloudflare/puppeteer`
- `src/cache.ts` — Two-tier caching: Cache API (L1) + R2 (L2), background writes via `ctx.waitUntil()`
- `src/template.ts` — Injects DivKit JSON + width into `static/divkit.html` template
- `src/hash.ts` — SHA-256 deterministic cache key from `{ json, width, scale }`
- `static/divkit.html` — HTML shell that loads DivKit from CDN, renders client-side, signals completion via `data-rendered`

## Key technical decisions
- DivKit renders client-side inside Chromium — the Worker never executes DivKit code
- `browser.close()` per request (no session reuse) for clean isolation and billing
- `networkidle0` wait ensures external images load before screenshot
- `data-rendered` attribute as safety signal that DivKit finished rendering
- Cache API synthetic URLs use `https://cache.internal/` prefix
- `ctx.waitUntil()` for non-blocking cache writes
- `fullPage: true` captures entire rendered height regardless of viewport

## Commands
- Install deps: `cd divkit-screenshot-worker && npm install`
- Run tests: `cd divkit-screenshot-worker && npm test`
- Type-check: `cd divkit-screenshot-worker && npm run typecheck`
- Lint: `cd divkit-screenshot-worker && npm run lint`
- Lint fix: `cd divkit-screenshot-worker && npm run lint:fix`
- Local dev: `cd divkit-screenshot-worker && npm run dev`
- Deploy: `cd divkit-screenshot-worker && npm run deploy`

## Code style
- TypeScript strict mode, all types explicit
- No external deps beyond `@cloudflare/puppeteer`
- Web APIs only (fetch, crypto.subtle, Response, Request) — no Node.js imports
- `const` and arrow functions preferred
- ESLint with typescript-eslint for linting
- No console.log in production paths — only for error reporting
- One concern per module, keep files focused
