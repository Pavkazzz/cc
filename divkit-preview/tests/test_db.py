"""Tests for the database access layer."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from db import get_layout


@pytest.mark.asyncio
async def test_get_layout_found() -> None:
    """fetchrow returns a row — get_layout returns the dict."""
    expected = {"card": {"log_id": "test", "states": []}}
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value={"divkit_json": expected})

    result = await get_layout(pool, "layout-1")

    assert result == expected
    pool.fetchrow.assert_awaited_once_with(
        "SELECT divkit_json FROM layouts WHERE id = $1",
        "layout-1",
    )


@pytest.mark.asyncio
async def test_get_layout_not_found() -> None:
    """fetchrow returns None — get_layout returns None."""
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=None)

    result = await get_layout(pool, "nonexistent")

    assert result is None
