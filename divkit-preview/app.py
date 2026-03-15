"""Application wiring for the DivKit preview service."""

import logging
import os

from aiohttp import web

from handlers import preview_handler
from screenshot_service import ScreenshotService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def on_startup(app: web.Application) -> None:
    """Start screenshot service."""
    concurrency = int(os.environ.get("SCREENSHOT_CONCURRENCY", "5"))
    service = ScreenshotService(concurrency=concurrency)
    await service.start()
    app["screenshot_service"] = service


async def on_shutdown(app: web.Application) -> None:
    """Stop screenshot service."""
    service: ScreenshotService | None = app.get("screenshot_service")
    if service:
        await service.stop()


def create_app() -> web.Application:
    """Build and return the aiohttp application."""
    app = web.Application()
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)
    app.router.add_post("/preview.png", preview_handler)
    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    web.run_app(create_app(), port=port)
