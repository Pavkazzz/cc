"""MCP server for rendering DivKit layouts to PNG screenshots."""

import asyncio
import json
import logging
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from playwright.async_api import Browser, Playwright, async_playwright

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static" / "divkit"


def _build_html_template(css_content: str, js_content: str) -> str:
    """Build the HTML template with inlined DivKit assets."""
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

    def __init__(self, concurrency: int = 1) -> None:
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

        if not css_content or not js_content:
            logger.warning("DivKit assets missing in %s — screenshots may be blank", STATIC_DIR)

        self._html_template = _build_html_template(css_content, js_content)

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch()
        logger.info("ScreenshotService started")

    async def stop(self) -> None:
        """Shut down the browser."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def capture(
        self,
        divkit_json: dict[str, object],
        width: int = 375,
        scale: float = 2.0,
        bgcolor: str = "#FFFFFF",
    ) -> bytes:
        """Render a DivKit layout and return a PNG screenshot."""
        if self._browser is None:
            raise RuntimeError("ScreenshotService is not started")

        async with self._semaphore:
            return await asyncio.wait_for(
                self._do_capture(divkit_json, width, scale, bgcolor),
                timeout=10.0,
            )

    async def _do_capture(
        self,
        divkit_json: dict[str, object],
        width: int,
        scale: float,
        bgcolor: str,
    ) -> bytes:
        json_script = (
            "<script>var DIVKIT_JSON = "
            + json.dumps(divkit_json, ensure_ascii=False)
            + ";</script>"
        )
        bg_style = f"<style>body {{ background-color: {bgcolor}; }}</style>"
        html = self._html_template.replace(
            '<div id="root"></div>',
            bg_style + '<div id="root"></div>' + json_script,
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


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------

mcp = FastMCP("divkit-screenshot")
_service: ScreenshotService | None = None


async def _ensure_service() -> ScreenshotService:
    global _service
    if _service is None:
        _service = ScreenshotService(concurrency=1)
        await _service.start()
    return _service


@mcp.tool()
async def render_divkit_screenshot(
    file: str,
    output: str,
    width: int = 375,
    scale: float = 2.0,
    bgcolor: str = "#FFFFFF",
) -> str:
    """Render a DivKit JSON layout to a PNG screenshot.

    Args:
        file: Path to a DivKit JSON file to render.
        output: Path where the PNG screenshot will be saved.
        width: Viewport width in pixels (320-1440, default 375).
        scale: Device scale factor (1.0-3.0, default 2.0).
        bgcolor: CSS background color (default "#FFFFFF").
    """
    if not (320 <= width <= 1440):
        return "Error: width must be between 320 and 1440"
    if not (1.0 <= scale <= 3.0):
        return "Error: scale must be between 1.0 and 3.0"

    file_path = Path(file).expanduser().resolve()
    if not file_path.is_file():
        return f"Error: file not found: {file_path}"

    try:
        divkit_json = json.loads(file_path.read_text())
    except json.JSONDecodeError as exc:
        return f"Error: invalid JSON: {exc}"

    if not isinstance(divkit_json, dict):
        return "Error: JSON file must contain an object"

    service = await _ensure_service()
    png_bytes = await service.capture(divkit_json, width=width, scale=scale, bgcolor=bgcolor)

    output_path = Path(output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(png_bytes)

    return f"Screenshot saved to {output_path} ({len(png_bytes)} bytes)"


def main():
    mcp.run()


if __name__ == "__main__":
    main()
