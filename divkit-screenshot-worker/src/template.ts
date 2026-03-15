import htmlTemplate from "../static/divkit.html";
import divkitCss from "../static/client.css.txt";
import divkitJs from "../static/browser.js.txt";

export function buildHtml(divkitJson: object, width: number): string {
  return htmlTemplate
    .replace("{{DIVKIT_CSS}}", divkitCss)
    .replace("{{DIVKIT_JS}}", divkitJs)
    .replace("{{WIDTH}}", String(width))
    .replace("{{DIVKIT_JSON}}", JSON.stringify(divkitJson));
}
