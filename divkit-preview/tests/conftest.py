"""Shared fixtures for DivKit preview tests."""

import sys
from pathlib import Path

import pytest
import pytest_asyncio

# Add project root to path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from screenshot_service import ScreenshotService

SAMPLE_DIVKIT_JSON: dict = {
    "card": {
        "log_id": "test",
        "states": [
            {
                "state_id": 0,
                "div": {
                    "type": "text",
                    "text": "Hello, DivKit!",
                    "font_size": 20,
                    "text_color": "#000000",
                    "background": [{"type": "solid", "color": "#FFFFFF"}],
                    "width": {"type": "match_parent"},
                    "height": {"type": "wrap_content"},
                    "paddings": {
                        "top": 16,
                        "bottom": 16,
                        "left": 16,
                        "right": 16,
                    },
                },
            }
        ],
    }
}


SAMPLE_IMAGE_DIVKIT_JSON: dict = {
    "card": {
        "log_id": "test_image",
        "states": [
            {
                "state_id": 0,
                "div": {
                    "type": "image",
                    "image_url": "https://placehold.co/200x200/orange/white/png",
                    "width": {"type": "fixed", "value": 200},
                    "height": {"type": "fixed", "value": 200},
                    "background": [{"type": "solid", "color": "#EEEEEE"}],
                },
            }
        ],
    }
}


@pytest.fixture
def sample_divkit_json() -> dict:
    """A minimal valid DivKit JSON."""
    return SAMPLE_DIVKIT_JSON.copy()


@pytest.fixture
def image_divkit_json() -> dict:
    """A DivKit JSON with an image div."""
    return SAMPLE_IMAGE_DIVKIT_JSON.copy()


def _playwright_available() -> bool:
    try:
        from playwright.async_api import async_playwright  # noqa: F401

        return True
    except ImportError:
        return False


@pytest_asyncio.fixture
async def screenshot_service():
    """Real ScreenshotService instance — skips if Playwright not available."""
    if not _playwright_available():
        pytest.skip("Playwright/Chromium not installed")
    service = ScreenshotService(concurrency=5)
    await service.start()
    yield service
    await service.stop()


@pytest.fixture
def app(screenshot_service):
    """Full aiohttp test app with real ScreenshotService."""
    from aiohttp import web

    from handlers import preview_handler

    application = web.Application()
    application["screenshot_service"] = screenshot_service
    application.router.add_post("/preview.png", preview_handler)
    return application
