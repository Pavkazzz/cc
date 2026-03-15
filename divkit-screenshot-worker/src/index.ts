import { computeCacheKey } from "./hash";
import { buildHtml } from "./template";
import { getCached, setCached } from "./cache";
import { takeScreenshot } from "./screenshot";
import {
  saveRequestLog,
  listRequestLogs,
  getRequestMeta,
  getRequestScreenshot,
} from "./request-log";
import indexHtml from "../static/index.html";

export interface Env {
  BROWSER: Fetcher;
  SCREENSHOT_CACHE: R2Bucket;
  REQUEST_LOG: R2Bucket;
  DEFAULT_WIDTH: string;
  DEFAULT_SCALE: string;
  CACHE_TTL_SECONDS: string;
  ADMIN_TOKEN: string;
}

interface ScreenshotRequest {
  json: { card: unknown; templates?: unknown };
  width?: number;
  height?: number;
  scale?: number;
  background?: string;
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

function checkAdminToken(request: Request, env: Env): boolean {
  const url = new URL(request.url);
  const token =
    request.headers.get("X-Admin-Token") ?? url.searchParams.get("token");
  return token === env.ADMIN_TOKEN;
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

  const background = body.background ?? null;
  if (background !== null && !/^#([\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/.test(background)) {
    return jsonError("background must be a valid hex color (e.g. #fff, #ffffff, #ffffffff)", 400);
  }

  const ttl = parseInt(env.CACHE_TTL_SECONDS, 10);
  const cacheKey = await computeCacheKey(body.json, width, height, scale, background);

  const cached = await getCached(cacheKey, env.SCREENSHOT_CACHE, ctx);
  if (cached) {
    saveRequestLog(
      env.REQUEST_LOG, ctx, cacheKey,
      body.json, width, height, scale, background, cached.png
    );

    return new Response(cached.png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${ttl}`,
        "X-Cache": "HIT",
        "X-Cache-Source": cached.source,
        "X-Request-Hash": cacheKey,
      },
    });
  }

  let png: ArrayBuffer;
  try {
    const html = buildHtml(body.json, width, background);
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
  saveRequestLog(
    env.REQUEST_LOG, ctx, cacheKey,
    body.json, width, height, scale, background, png
  );

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${ttl}`,
      "X-Cache": "MISS",
      "X-Cache-Source": "browser",
      "X-Request-Hash": cacheKey,
    },
  });
}

async function handleRequests(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  if (!checkAdminToken(request, env)) {
    return jsonError("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    100
  );

  const result = await listRequestLogs(env.REQUEST_LOG, cursor, limit);

  return new Response(
    JSON.stringify({
      requests: result.entries.map((e) => ({
        hash: e.hash,
        width: e.width,
        height: e.height,
        scale: e.scale,
        background: e.background,
        createdAt: e.createdAt,
      })),
      cursor: result.cursor ?? null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

async function handleShareMeta(
  hash: string,
  env: Env
): Promise<Response> {
  const entry = await getRequestMeta(env.REQUEST_LOG, hash);
  if (!entry) {
    return jsonError("Not found", 404);
  }

  return new Response(
    JSON.stringify({
      hash: entry.hash,
      json: entry.json,
      width: entry.width,
      height: entry.height,
      scale: entry.scale,
      background: entry.background,
      createdAt: entry.createdAt,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

async function handleShareScreenshot(
  hash: string,
  env: Env
): Promise<Response> {
  const png = await getRequestScreenshot(env.REQUEST_LOG, hash);
  if (!png) {
    return jsonError("Not found", 404);
  }

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function handleHealth(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
}

const SHARE_PREFIX = "/preview/share/";

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

    if (url.pathname === "/preview/requests") {
      return handleRequests(request, env);
    }

    if (url.pathname.startsWith(SHARE_PREFIX)) {
      const rest = url.pathname.slice(SHARE_PREFIX.length);
      const match = rest.match(/^([a-f0-9]{64})(\/screenshot)?$/);
      if (!match) {
        return jsonError("Invalid hash", 400);
      }
      const hash = match[1];
      if (match[2] === "/screenshot") {
        return handleShareScreenshot(hash, env);
      }
      return handleShareMeta(hash, env);
    }

    if (url.pathname === "/preview/health" && request.method === "GET") {
      return handleHealth();
    }

    if (url.pathname === "/preview" || url.pathname === "/preview/") {
      return new Response(indexHtml, {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    return jsonError("Not found", 404);
  },
};
