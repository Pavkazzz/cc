"""PostgreSQL access layer for DivKit layouts."""

import json
import logging

import asyncpg

logger = logging.getLogger(__name__)


async def get_layout(pool: asyncpg.Pool, layout_id: str) -> dict | None:
    """Fetch a DivKit layout JSON by id.

    Returns the parsed dict if found, None otherwise.
    """
    row = await pool.fetchrow(
        "SELECT divkit_json FROM layouts WHERE id = $1",
        layout_id,
    )
    if row is None:
        return None
    value = row["divkit_json"]
    if isinstance(value, str):
        return json.loads(value)
    return value
