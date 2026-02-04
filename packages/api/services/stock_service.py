import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List

import httpx

FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
FINNHUB_BASE = "https://finnhub.io/api/v1"

RANGE_CONFIG: Dict[str, Dict[str, Any]] = {
    "1W": {"days": 7, "resolution": "D"},
    "1M": {"days": 30, "resolution": "D"},
    "3M": {"days": 90, "resolution": "D"},
    "6M": {"days": 180, "resolution": "D"},
    "1Y": {"days": 365, "resolution": "W"},
    "YTD": {"days": None, "resolution": "D"},
}


async def search_tickers(query: str) -> List[Dict[str, str]]:
    """Search for ticker symbols matching the query."""
    if not FINNHUB_API_KEY:
        raise ValueError("FINNHUB_API_KEY is not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FINNHUB_BASE}/search",
            params={"q": query, "token": FINNHUB_API_KEY},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("result", [])
    # Filter to common stocks only and limit results
    filtered = [
        {
            "symbol": r["symbol"],
            "description": r["description"],
            "type": r.get("type", ""),
        }
        for r in results
        if r.get("type") == "Common Stock"
    ]
    return filtered[:10]


async def fetch_stock_prices(ticker: str, range_key: str) -> Dict[str, Any]:
    """Fetch stock candle data from Finnhub and transform into chart shape."""
    if not FINNHUB_API_KEY:
        raise ValueError("FINNHUB_API_KEY is not configured")

    config = RANGE_CONFIG.get(range_key)
    if not config:
        raise ValueError(f"Invalid range: {range_key}. Use one of: {', '.join(RANGE_CONFIG.keys())}")

    now = datetime.utcnow()
    to_ts = int(time.mktime(now.timetuple()))

    if range_key == "YTD":
        start = datetime(now.year, 1, 1)
    else:
        start = now - timedelta(days=config["days"])

    from_ts = int(time.mktime(start.timetuple()))
    resolution = config["resolution"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FINNHUB_BASE}/stock/candle",
            params={
                "symbol": ticker.upper(),
                "resolution": resolution,
                "from": from_ts,
                "to": to_ts,
                "token": FINNHUB_API_KEY,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("s") != "ok":
        raise ValueError(f"No data available for {ticker.upper()} in the selected range")

    timestamps = data.get("t", [])
    closes = data.get("c", [])

    # Format labels
    labels: List[str] = []
    for ts in timestamps:
        dt = datetime.utcfromtimestamp(ts)
        if resolution == "W":
            labels.append(dt.strftime("%Y-%m-%d"))
        else:
            labels.append(dt.strftime("%b %d"))

    return {
        "labels": labels,
        "series": [{"name": "Close", "data": [round(v, 2) for v in closes]}],
        "suggestedTitle": f"{ticker.upper()} Stock Price",
        "suggestedType": "line",
        "xAxisLabel": "Date",
        "yAxisLabel": "Price (USD)",
    }
