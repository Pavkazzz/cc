"""Tests for aiohttp handlers."""

import json

import pytest
from aiohttp.test_utils import TestClient

from tests.conftest import SAMPLE_DIVKIT_JSON


@pytest.mark.asyncio
async def test_preview_success(aiohttp_client, app) -> None:
    """POST with valid DivKit JSON returns 200 with PNG."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png",
        json=SAMPLE_DIVKIT_JSON,
    )
    assert resp.status == 200
    assert resp.content_type == "image/png"
    body = await resp.read()
    assert body[:4] == b"\x89PNG"


@pytest.mark.asyncio
async def test_preview_invalid_body(aiohttp_client, app) -> None:
    """POST with non-JSON body returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png",
        data=b"not json",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status == 400
    data = await resp.json()
    assert "json" in data["error"].lower()


@pytest.mark.asyncio
async def test_preview_invalid_width(aiohttp_client, app) -> None:
    """POST with width=9999 returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png?width=9999",
        json=SAMPLE_DIVKIT_JSON,
    )
    assert resp.status == 400
    data = await resp.json()
    assert "width" in data["error"].lower()


@pytest.mark.asyncio
async def test_preview_invalid_scale(aiohttp_client, app) -> None:
    """POST with scale=10 returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png?scale=10",
        json=SAMPLE_DIVKIT_JSON,
    )
    assert resp.status == 400
    data = await resp.json()
    assert "scale" in data["error"].lower()


@pytest.mark.asyncio
async def test_preview_has_cache_header(aiohttp_client, app) -> None:
    """Response includes Cache-Control: public, max-age=300."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png",
        json=SAMPLE_DIVKIT_JSON,
    )
    assert resp.status == 200
    assert resp.headers.get("Cache-Control") == "public, max-age=300"


@pytest.mark.asyncio
async def test_preview_body_must_be_object(aiohttp_client, app) -> None:
    """POST with a JSON array body returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.post(
        "/preview.png",
        json=[1, 2, 3],
    )
    assert resp.status == 400
    data = await resp.json()
    assert "object" in data["error"].lower()
