"""Playwright-based screenshot renderer for DivKit layouts."""

import asyncio
import json
import logging
from pathlib import Path

from playwright.async_api import Browser, Playwright, async_playwright

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static" / "divkit"


def _build_html_template(css_content: str, js_content: str) -> str:
    """Build the HTML template with inlined DivKit assets.

    The template expects a global `DIVKIT_JSON` variable to be set
    via a <script> tag before this template's own script runs.
    """
    return (
        """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { margin: 0; }
#root { width: 100%; }
"""
        + css_content
        + """
</style>
</head>
<body>
<div id="root"></div>
<script>
"""
        + js_content
        + """
</script>
<script>
window.DivKit.render({
    id: "root",
    target: document.getElementById("root"),
    json: DIVKIT_JSON,
});
</script>
</body>
</html>"""
    )


class ScreenshotService:
    """Manages a persistent Chromium browser for taking screenshots."""

    def __init__(self, concurrency: int = 5) -> None:
        self._concurrency = concurrency
        self._semaphore = asyncio.Semaphore(concurrency)
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._html_template: str = ""

    async def start(self) -> None:
        """Launch the browser and load static assets."""
        css_path = STATIC_DIR / "client.css"
        js_path = STATIC_DIR / "browser.js"

        css_content = css_path.read_text() if css_path.exists() else ""
        js_content = js_path.read_text() if js_path.exists() else ""

        self._html_template = _build_html_template(css_content, js_content)

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch()
        logger.info("ScreenshotService started with concurrency=%d", self._concurrency)

    async def stop(self) -> None:
        """Shut down the browser."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("ScreenshotService stopped")

    async def capture(
        self,
        divkit_json: dict[str, object],
        width: int = 375,
        scale: float = 2.0,
    ) -> bytes:
        """Render a DivKit layout and return a PNG screenshot."""
        if self._browser is None:
            raise RuntimeError("ScreenshotService is not started")

        async with self._semaphore:
            return await asyncio.wait_for(
                self._do_capture(divkit_json, width, scale),
                timeout=10.0,
            )

    async def _do_capture(
        self,
        divkit_json: dict[str, object],
        width: int,
        scale: float,
    ) -> bytes:
        json_script = (
            "<script>var DIVKIT_JSON = "
            + json.dumps(divkit_json, ensure_ascii=False)
            + ";</script>"
        )
        html = self._html_template.replace(
            '<div id="root"></div>',
            '<div id="root"></div>' + json_script,
        )

        context = await self._browser.new_context(  # type: ignore[union-attr]
            viewport={"width": width, "height": 800},
            device_scale_factor=scale,
        )
        page = await context.new_page()
        try:
            await page.set_content(html, wait_until="networkidle")
            png_bytes = await page.screenshot(full_page=True)
        finally:
            await page.close()
            await context.close()

        return bytes(png_bytes)
