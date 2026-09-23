"""
Run synchronous, network-bound SDK calls without stalling the event loop.

The API is a single uvicorn process on one asyncio loop. The Gemini client's
``models.generate_content`` and the BigQuery client are synchronous, so calling
them directly from an ``async def`` handler freezes every other request — and
Railway's healthcheck — for as long as the call takes. Observed in production:
during one 16-second /api/ai/generate call, /health timed out at 8 seconds and
the proxy answered 502 for everyone.

Every such call goes through here: onto a worker thread, under a timeout.
The timeout frees the request and the loop; a thread that has already begun
a network call finishes in the background, which is acceptable.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, List, Optional, TypeVar

T = TypeVar("T")

# Ceilings for calls that leave the process. A hung upstream should fail with
# a clear error, not hold a request open until the proxy gives up.
MODEL_CALL_TIMEOUT_SECONDS = 60.0
BIGQUERY_TIMEOUT_SECONDS = 45.0


async def run_blocking(func: Callable[..., T], *args: Any, timeout: float, **kwargs: Any) -> T:
    """Run ``func(*args, **kwargs)`` on a worker thread, bounded by ``timeout`` seconds."""
    return await asyncio.wait_for(asyncio.to_thread(func, *args, **kwargs), timeout=timeout)


async def generate_content(client: Any, *, timeout: float = MODEL_CALL_TIMEOUT_SECONDS, **kwargs: Any) -> Any:
    """``client.models.generate_content(**kwargs)`` off the loop. Returns the same response object."""
    return await run_blocking(client.models.generate_content, timeout=timeout, **kwargs)


def _query_rows_sync(client: Any, sql: str, job_config: Any, max_results: int, timeout: float) -> List[Any]:
    job = client.query(sql, job_config=job_config)
    # ``timeout`` here bounds the server-side wait, so the thread does not
    # linger after the awaiting request has already given up.
    return list(job.result(max_results=max_results, timeout=timeout))


async def query_rows(
    client: Any,
    sql: str,
    *,
    job_config: Optional[Any],
    max_results: int,
    timeout: float = BIGQUERY_TIMEOUT_SECONDS,
) -> List[Any]:
    """Run a BigQuery query off the loop and return its rows as a list."""
    return await run_blocking(
        _query_rows_sync, client, sql, job_config, max_results, timeout, timeout=timeout + 5.0
    )
