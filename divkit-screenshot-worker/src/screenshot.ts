import puppeteer from "@cloudflare/puppeteer";

const GLOBAL_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function is429(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("429");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function takeScreenshot(
  browserBinding: Fetcher,
  html: string,
  width: number,
  height: number,
  scale: number
): Promise<ArrayBuffer> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }

    let browser;
    try {
      browser = await puppeteer.launch(browserBinding);
    } catch (err) {
      lastError = err;
      if (is429(err) && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }

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

  throw lastError;
}
