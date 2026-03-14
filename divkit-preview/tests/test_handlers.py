"""Tests for aiohttp handlers."""

import json

import pytest
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, TestClient

from tests.conftest import SAMPLE_DIVKIT_JSON


@pytest.mark.asyncio
async def test_preview_success(aiohttp_client, app, mock_pool) -> None:
    """Mock DB returns sample JSON — GET returns 200 with PNG."""
    mock_pool.fetchrow.return_value = {
        "divkit_json": SAMPLE_DIVKIT_JSON,
    }
    client: TestClient = await aiohttp_client(app)
    resp = await client.get("/test-layout/preview.png")
    assert resp.status == 200
    assert resp.content_type == "image/png"
    body = await resp.read()
    assert body[:4] == b"\x89PNG"


@pytest.mark.asyncio
async def test_preview_not_found(aiohttp_client, app, mock_pool) -> None:
    """Mock DB returns None — GET returns 404 JSON."""
    mock_pool.fetchrow.return_value = None
    client: TestClient = await aiohttp_client(app)
    resp = await client.get("/missing/preview.png")
    assert resp.status == 404
    data = await resp.json()
    assert data["error"] == "Layout not found"


@pytest.mark.asyncio
async def test_preview_invalid_width(aiohttp_client, app, mock_pool) -> None:
    """GET with width=9999 returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.get("/test/preview.png?width=9999")
    assert resp.status == 400
    data = await resp.json()
    assert "width" in data["error"].lower()


@pytest.mark.asyncio
async def test_preview_invalid_scale(aiohttp_client, app, mock_pool) -> None:
    """GET with scale=10 returns 400."""
    client: TestClient = await aiohttp_client(app)
    resp = await client.get("/test/preview.png?scale=10")
    assert resp.status == 400
    data = await resp.json()
    assert "scale" in data["error"].lower()


@pytest.mark.asyncio
async def test_preview_has_cache_header(
    aiohttp_client, app, mock_pool
) -> None:
    """Response includes Cache-Control: public, max-age=300."""
    mock_pool.fetchrow.return_value = {
        "divkit_json": SAMPLE_DIVKIT_JSON,
    }
    client: TestClient = await aiohttp_client(app)
    resp = await client.get("/test/preview.png")
    assert resp.status == 200
    assert resp.headers.get("Cache-Control") == "public, max-age=300"
