import htmlTemplate from "../static/divkit.html";

export function buildHtml(divkitJson: object, width: number): string {
  return htmlTemplate
    .replace("{{WIDTH}}", String(width))
    .replace("{{DIVKIT_JSON}}", JSON.stringify(divkitJson));
}
