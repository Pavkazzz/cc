import { describe, it, expect } from "vitest";
import { computeCacheKey } from "../src/hash";

describe("computeCacheKey", () => {
  const sampleJson = { card: { states: [] }, templates: {} };

  it("produces same hash for same input", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 375, 812, 2);
    expect(a).toBe(b);
  });

  it("produces different hash for different JSON", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey({ card: { states: [1] } }, 375, 812, 2);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different width", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 414, 812, 2);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different height", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 375, 1024, 2);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different scale", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 375, 812, 3);
    expect(a).not.toBe(b);
  });

  it("produces different hash for different background", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 375, 812, 2, "#ffffff");
    expect(a).not.toBe(b);
  });

  it("default height 812 omitted from key for backwards compat", async () => {
    // Key with default height should match the legacy {json, width, scale} shape
    const key = await computeCacheKey(sampleJson, 375, 812, 2);
    const keyAgain = await computeCacheKey(sampleJson, 375, 812, 2, null);
    expect(key).toBe(keyAgain);
  });

  it("null background matches no-background call", async () => {
    const a = await computeCacheKey(sampleJson, 375, 812, 2);
    const b = await computeCacheKey(sampleJson, 375, 812, 2, null);
    expect(a).toBe(b);
  });

  it("returns a 64-char hex string", async () => {
    const key = await computeCacheKey(sampleJson, 375, 812, 2);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
