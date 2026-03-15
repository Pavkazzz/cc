import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/index";

function createMockEnv(): Env {
  return {
    BROWSER: {} as Fetcher,
    SCREENSHOT_CACHE: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
      head: vi.fn().mockResolvedValue(null),
      createMultipartUpload: vi.fn(),
      resumeMultipartUpload: vi.fn(),
    } as unknown as R2Bucket,
    DEFAULT_WIDTH: "375",
    DEFAULT_SCALE: "2",
    CACHE_TTL_SECONDS: "3600",
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
});
