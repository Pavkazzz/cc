import puppeteer from "@cloudflare/puppeteer";

const GLOBAL_TIMEOUT_MS = 15_000;

export async function takeScreenshot(
  browserBinding: Fetcher,
  html: string,
  width: number,
  height: number,
  scale: number
): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch(browserBinding);

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale,
    });

    await page.setContent(html, { waitUntil: "networkidle0", timeout: GLOBAL_TIMEOUT_MS });

    await page.waitForSelector('[data-rendered="true"]', {
      timeout: 10_000,
    });

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: true,
    });

    return (screenshot as Uint8Array).buffer as ArrayBuffer;
  } finally {
    await browser.close();
  }
}
