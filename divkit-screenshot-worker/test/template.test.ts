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

  it("contains DivKit CSS link", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).toContain("@divkitframework/divkit/dist/client.css");
  });

  it("contains DivKit JS script", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).toContain("@divkitframework/divkit/dist/browser.js");
  });

  it("contains data-rendered signal", () => {
    const html = buildHtml(sampleJson, 375);
    expect(html).toContain("dataset.rendered");
  });
});
