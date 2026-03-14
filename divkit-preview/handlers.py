"""aiohttp request handlers for DivKit preview."""

import asyncio
import logging

from aiohttp import web

from db import get_layout
from screenshot_service import ScreenshotService

logger = logging.getLogger(__name__)


async def preview_handler(request: web.Request) -> web.Response:
    """GET /{id}/preview.png — render a DivKit layout as PNG."""
    layout_id: str = request.match_info["id"]

    # Parse and validate query params
    width = _parse_int_param(request, "width", default=375, min_val=320, max_val=1440)
    if isinstance(width, web.Response):
        return width

    scale = _parse_float_param(request, "scale", default=2.0, min_val=1.0, max_val=3.0)
    if isinstance(scale, web.Response):
        return scale

    # Fetch layout from DB
    pool = request.app["db_pool"]
    layout = await get_layout(pool, layout_id)
    if layout is None:
        return web.json_response({"error": "Layout not found"}, status=404)

    # Take screenshot
    screenshot_service: ScreenshotService = request.app["screenshot_service"]
    try:
        png_bytes = await screenshot_service.capture(layout, width=width, scale=scale)
    except asyncio.TimeoutError:
        logger.error("Screenshot timed out for layout %s", layout_id)
        return web.json_response({"error": "Screenshot timed out"}, status=500)
    except Exception:
        logger.exception("Screenshot failed for layout %s", layout_id)
        return web.json_response({"error": "Screenshot failed"}, status=500)

    return web.Response(
        body=png_bytes,
        content_type="image/png",
        headers={"Cache-Control": "public, max-age=300"},
    )


def _parse_int_param(
    request: web.Request,
    name: str,
    *,
    default: int,
    min_val: int,
    max_val: int,
) -> int | web.Response:
    raw = request.query.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return web.json_response(
            {"error": f"Invalid {name}: must be an integer"},
            status=400,
        )
    if value < min_val or value > max_val:
        return web.json_response(
            {"error": f"Invalid {name}: must be between {min_val} and {max_val}"},
            status=400,
        )
    return value


def _parse_float_param(
    request: web.Request,
    name: str,
    *,
    default: float,
    min_val: float,
    max_val: float,
) -> float | web.Response:
    raw = request.query.get(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        return web.json_response(
            {"error": f"Invalid {name}: must be a number"},
            status=400,
        )
    if value < min_val or value > max_val:
        return web.json_response(
            {"error": f"Invalid {name}: must be between {min_val} and {max_val}"},
            status=400,
        )
    return value
