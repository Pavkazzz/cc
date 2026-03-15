import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCached, setCached } from "../src/cache";

function createMockR2(): R2Bucket {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    head: vi.fn().mockResolvedValue(null),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

function createMockCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

const testPng = new Uint8Array([137, 80, 78, 71]).buffer;

describe("getCached", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null on double miss", async () => {
    const r2 = createMockR2();
    const ctx = createMockCtx();

    vi.spyOn(caches.default, "match").mockResolvedValue(undefined);

    const result = await getCached("test-key", r2, ctx);
    expect(result).toBeNull();
    expect(r2.get).toHaveBeenCalledWith("test-key");
  });

  it("returns cache-api source on L1 hit", async () => {
    const r2 = createMockR2();
    const ctx = createMockCtx();

    vi.spyOn(caches.default, "match").mockResolvedValue(
      new Response(testPng, { headers: { "Content-Type": "image/png" } })
    );

    const result = await getCached("test-key", r2, ctx);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("cache-api");
    expect(r2.get).not.toHaveBeenCalled();
  });

  it("returns r2 source on L1 miss / L2 hit and repopulates L1", async () => {
    const r2 = createMockR2();
    const ctx = createMockCtx();

    vi.spyOn(caches.default, "match").mockResolvedValue(undefined);
    vi.spyOn(caches.default, "put").mockResolvedValue(undefined);

    (r2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(testPng),
    });

    const result = await getCached("test-key", r2, ctx);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("r2");
    expect(ctx.waitUntil).toHaveBeenCalled();
  });
});

describe("setCached", () => {
  it("stores in both R2 and Cache API via waitUntil", async () => {
    const r2 = createMockR2();
    const ctx = createMockCtx();

    vi.spyOn(caches.default, "put").mockResolvedValue(undefined);

    await setCached("test-key", testPng, r2, ctx, 3600);

    expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
  });
});
