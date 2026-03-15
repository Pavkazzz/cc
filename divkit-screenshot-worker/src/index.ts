import { computeCacheKey } from "./hash";
import { buildHtml } from "./template";
import { getCached, setCached } from "./cache";
import { takeScreenshot } from "./screenshot";

export interface Env {
  BROWSER: Fetcher;
  SCREENSHOT_CACHE: R2Bucket;
  DEFAULT_WIDTH: string;
  DEFAULT_SCALE: string;
  CACHE_TTL_SECONDS: string;
}

interface ScreenshotRequest {
  json: { card: unknown; templates?: unknown };
  width?: number;
  height?: number;
  scale?: number;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validateRange(value: number, min: number, max: number, name: string): string | null {
  if (!Number.isInteger(value) || value < min || value > max) {
    return `${name} must be an integer between ${min} and ${max}`;
  }
  return null;
}

async function handleScreenshot(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError("Content-Type must be application/json", 400);
  }

  let body: ScreenshotRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.json || typeof body.json !== "object" || !("card" in body.json)) {
    return jsonError("Request must include json field with a card property", 400);
  }

  const width = body.width ?? parseInt(env.DEFAULT_WIDTH, 10);
  const height = body.height ?? 812;
  const scale = body.scale ?? parseInt(env.DEFAULT_SCALE, 10);

  const widthErr = validateRange(width, 200, 1440, "width");
  if (widthErr) return jsonError(widthErr, 400);

  const heightErr = validateRange(height, 200, 2048, "height");
  if (heightErr) return jsonError(heightErr, 400);

  const scaleErr = validateRange(scale, 1, 3, "scale");
  if (scaleErr) return jsonError(scaleErr, 400);

  const ttl = parseInt(env.CACHE_TTL_SECONDS, 10);
  const cacheKey = await computeCacheKey(body.json, width, scale);

  const cached = await getCached(cacheKey, env.SCREENSHOT_CACHE, ctx);
  if (cached) {
    return new Response(cached.png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${ttl}`,
        "X-Cache": "HIT",
        "X-Cache-Source": cached.source,
      },
    });
  }

  let png: ArrayBuffer;
  try {
    const html = buildHtml(body.json, width);
    png = await takeScreenshot(env.BROWSER, html, width, height, scale);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Screenshot failed";
    console.error("Screenshot error:", message, err instanceof Error ? err.stack : "");
    if (message.includes("browser") || message.includes("Browser")) {
      return jsonError("Browser unavailable", 503);
    }
    return jsonError(message, 500);
  }

  setCached(cacheKey, png, env.SCREENSHOT_CACHE, ctx, ttl);

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${ttl}`,
      "X-Cache": "MISS",
      "X-Cache-Source": "browser",
    },
  });
}

function handleHealth(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/preview/screenshot") {
      return handleScreenshot(request, env, ctx);
    }

    if (url.pathname === "/preview/health" && request.method === "GET") {
      return handleHealth();
    }

    return jsonError("Not found", 404);
  },
};
