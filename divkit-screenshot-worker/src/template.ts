import htmlTemplate from "../static/divkit.html";
import divkitCss from "../static/client.css.txt";
import divkitJs from "../static/browser.js.txt";

function safeReplace(str: string, placeholder: string, value: string): string {
  const idx = str.indexOf(placeholder);
  if (idx === -1) return str;
  return str.slice(0, idx) + value + str.slice(idx + placeholder.length);
}

export function buildHtml(divkitJson: object, width: number): string {
  let html = htmlTemplate;
  html = safeReplace(html, "{{DIVKIT_CSS}}", divkitCss);
  html = safeReplace(html, "{{DIVKIT_JS}}", divkitJs);
  html = safeReplace(html, "{{WIDTH}}", String(width));
  html = safeReplace(html, "{{DIVKIT_JSON}}", JSON.stringify(divkitJson));
  return html;
}
