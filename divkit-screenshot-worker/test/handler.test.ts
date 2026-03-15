import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/index";

function createMockR2(): R2Bucket {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false, delimitedPrefixes: [] }),
    head: vi.fn().mockResolvedValue(null),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

function createMockEnv(): Env {
  return {
    BROWSER: {} as Fetcher,
    SCREENSHOT_CACHE: createMockR2(),
    REQUEST_LOG: createMockR2(),
    DEFAULT_WIDTH: "375",
    DEFAULT_SCALE: "2",
    CACHE_TTL_SECONDS: "3600",
    ADMIN_TOKEN: "test-secret-token",
  };
}

function createMockCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

const validBody = {
  json: { card: { states: [] }, templates: {} },
  width: 375,
  height: 812,
  scale: 2,
};

describe("Worker handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(caches.default, "match").mockResolvedValue(undefined);
    vi.spyOn(caches.default, "put").mockResolvedValue(undefined);
  });

  it("GET /preview/health returns 200", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/health", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);

    const body = await res.json<{ status: string }>();
    expect(body.status).toBe("ok");
  });

  it("GET /preview/screenshot returns 405", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/screenshot", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(405);
  });

  it("POST without json field returns 400", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 375 }),
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(400);
  });

  it("POST with invalid width returns 400", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, width: 9999 }),
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(400);
  });

  it("non-existent route returns 404", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/unknown", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(404);
  });

  it("POST with valid JSON and cache hit returns 200 with image/png", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const fakePng = new Uint8Array([137, 80, 78, 71]).buffer;
    (env.SCREENSHOT_CACHE.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(fakePng),
    });

    const req = new Request("https://example.com/preview/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("X-Cache")).toBe("HIT");
  });

  it("POST with cache hit returns X-Request-Hash header", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const fakePng = new Uint8Array([137, 80, 78, 71]).buffer;
    (env.SCREENSHOT_CACHE.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(fakePng),
    });

    const req = new Request("https://example.com/preview/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.headers.get("X-Request-Hash")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("POST with cache hit saves request log", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const fakePng = new Uint8Array([137, 80, 78, 71]).buffer;
    (env.SCREENSHOT_CACHE.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(fakePng),
    });

    const req = new Request("https://example.com/preview/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    await worker.fetch(req, env, ctx);
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(env.REQUEST_LOG.put).toHaveBeenCalled();
  });
});

describe("Request listing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(caches.default, "match").mockResolvedValue(undefined);
    vi.spyOn(caches.default, "put").mockResolvedValue(undefined);
  });

  it("GET /preview/requests/api without token returns 401", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/requests/api", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(401);
  });

  it("GET /preview/requests/api with wrong token returns 401", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/requests/api?token=wrong", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(401);
  });

  it("GET /preview/requests/api with valid token returns 200", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request(
      "https://example.com/preview/requests/api?token=test-secret-token",
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ requests: unknown[]; cursor: null }>();
    expect(body.requests).toEqual([]);
    expect(body.cursor).toBeNull();
  });

  it("GET /preview/requests/api with valid X-Admin-Token header returns 200", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/requests/api", {
      method: "GET",
      headers: { "X-Admin-Token": "test-secret-token" },
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
  });

  it("POST /preview/requests/api returns 405", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request(
      "https://example.com/preview/requests/api?token=test-secret-token",
      { method: "POST" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(405);
  });

  it("GET /preview/requests with valid token returns HTML page", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request(
      "https://example.com/preview/requests?token=test-secret-token",
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html;charset=utf-8");
    const html = await res.text();
    expect(html).toContain("Request Log");
  });

  it("GET /preview/requests without token returns 401", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();
    const req = new Request("https://example.com/preview/requests", {
      method: "GET",
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(401);
  });
});

describe("Share endpoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(caches.default, "match").mockResolvedValue(undefined);
    vi.spyOn(caches.default, "put").mockResolvedValue(undefined);
  });

  const fakeHash = "a".repeat(64);

  it("GET /preview/share/:hash returns JSON metadata", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const meta = {
      hash: fakeHash,
      json: { card: { states: [] } },
      width: 375,
      height: 812,
      scale: 2,
      background: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    (env.REQUEST_LOG.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(meta),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    const req = new Request(
      `https://example.com/preview/share/${fakeHash}`,
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json<{ hash: string; json: unknown }>();
    expect(body.hash).toBe(fakeHash);
    expect(body.json).toEqual({ card: { states: [] } });
  });

  it("GET /preview/share/:hash returns 404 for missing entry", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const req = new Request(
      `https://example.com/preview/share/${fakeHash}`,
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(404);
  });

  it("GET /preview/share/:hash/screenshot returns PNG", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const fakePng = new Uint8Array([137, 80, 78, 71]).buffer;
    (env.REQUEST_LOG.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(fakePng),
    });

    const req = new Request(
      `https://example.com/preview/share/${fakeHash}/screenshot`,
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("GET /preview/share/invalid-hash returns 400", async () => {
    const env = createMockEnv();
    const ctx = createMockCtx();

    const req = new Request(
      "https://example.com/preview/share/not-a-valid-hash",
      { method: "GET" }
    );

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(400);
  });
});
