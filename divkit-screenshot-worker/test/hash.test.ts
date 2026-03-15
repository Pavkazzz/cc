import { describe, it, expect } from "vitest";
import { computeCacheKey } from "../src/hash";

describe("computeCacheKey", () => {
  const sampleJson = { card: { states: [] }, templates: {} };

  it("produces same hash for same input", async () => {
    const a = await computeCacheKey(sampleJson, 375, 2);
    const b = await computeCacheKey(sampleJson, 375, 2);
    expect(a).toBe(b);
  });

  it("produces different hash for different JSON", async () => {
    const a = await computeCacheKey(sampleJson, 375, 2);
    const b = await computeCacheKey({ card: { states: [1] } }, 375, 2);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different width", async () => {
    const a = await computeCacheKey(sampleJson, 375, 2);
    const b = await computeCacheKey(sampleJson, 414, 2);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different scale", async () => {
    const a = await computeCacheKey(sampleJson, 375, 2);
    const b = await computeCacheKey(sampleJson, 375, 3);
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string", async () => {
    const key = await computeCacheKey(sampleJson, 375, 2);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
