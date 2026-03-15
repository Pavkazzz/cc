import { describe, it, expect } from "vitest";
import { buildHtml } from "../src/template";

describe("buildHtml", () => {
  const sampleJson = { card: { states: [] }, templates: {} };

  it("replaces width placeholder", () => {
    const html = buildHtml(sampleJson, 414);
    expect(html).toContain("width: 414px");
    expect(html).not.toContain("{{WIDTH}}");
  });

  it("injects parseable JSON", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).toContain(JSON.stringify(sampleJson));
    expect(html).not.toContain("{{DIVKIT_JSON}}");
  });

  it("contains inlined DivKit CSS", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).not.toContain("{{DIVKIT_CSS}}");
    expect(html).toContain("<style>");
  });

  it("contains inlined DivKit JS", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).not.toContain("{{DIVKIT_JS}}");
    expect(html).toContain("DivKit");
  });

  it("contains data-rendered signal", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).toContain("dataset.rendered");
  });
});
