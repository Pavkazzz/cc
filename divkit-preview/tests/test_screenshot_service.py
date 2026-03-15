"""Tests for the ScreenshotService."""

import asyncio

import pytest


@pytest.mark.asyncio
async def test_capture_returns_png_bytes(screenshot_service, sample_divkit_json) -> None:
    """Capture with sample JSON returns valid PNG bytes."""
    result = await screenshot_service.capture(sample_divkit_json)
    assert isinstance(result, bytes)
    assert result[:4] == b"\x89PNG"


@pytest.mark.asyncio
async def test_capture_custom_width(screenshot_service, sample_divkit_json) -> None:
    """Capture with width=768 returns valid PNG."""
    result = await screenshot_service.capture(sample_divkit_json, width=768)
    assert isinstance(result, bytes)
    assert result[:4] == b"\x89PNG"


@pytest.mark.asyncio
async def test_capture_invalid_json(screenshot_service) -> None:
    """Capture with incomplete JSON does not hang — returns PNG or raises."""
    try:
        result = await screenshot_service.capture({"card": {}})
        # If it returns something, it should be valid PNG bytes
        assert isinstance(result, bytes)
        assert result[:4] == b"\x89PNG"
    except Exception as exc:
        # A clear exception is also acceptable
        assert str(exc), "Exception should have a message"


@pytest.mark.asyncio
async def test_capture_image_div(screenshot_service, image_divkit_json) -> None:
    """Capture a layout with an image div — waits for network, returns valid PNG."""
    result = await screenshot_service.capture(image_divkit_json)
    assert isinstance(result, bytes)
    assert result[:4] == b"\x89PNG"
    # Image layout should produce a larger screenshot than an empty page
    assert len(result) > 100


@pytest.mark.asyncio
async def test_concurrent_captures(screenshot_service, sample_divkit_json) -> None:
    """Launch 5 captures simultaneously — all should succeed."""
    tasks = [screenshot_service.capture(sample_divkit_json) for _ in range(5)]
    results = await asyncio.gather(*tasks)
    assert len(results) == 5
    for result in results:
        assert isinstance(result, bytes)
        assert result[:4] == b"\x89PNG"
