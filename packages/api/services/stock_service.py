import os
from typing import Any, Dict, List

import httpx
import yfinance as yf

FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
FINNHUB_BASE = "https://finnhub.io/api/v1"

RANGE_CONFIG: Dict[str, Dict[str, str]] = {
    "1W": {"period": "5d", "interval": "1d"},
    "1M": {"period": "1mo", "interval": "1d"},
    "3M": {"period": "3mo", "interval": "1d"},
    "6M": {"period": "6mo", "interval": "1d"},
    "1Y": {"period": "1y", "interval": "1wk"},
    "YTD": {"period": "ytd", "interval": "1d"},
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
    """Fetch stock price data from Yahoo Finance and transform into chart shape."""
    config = RANGE_CONFIG.get(range_key)
    if not config:
        raise ValueError(f"Invalid range: {range_key}. Use one of: {', '.join(RANGE_CONFIG.keys())}")

    stock = yf.Ticker(ticker.upper())
    df = stock.history(period=config["period"], interval=config["interval"])

    if df.empty:
        raise ValueError(f"No data available for {ticker.upper()} in the selected range")

    labels: List[str] = []
    for dt in df.index:
        if config["interval"] == "1wk":
            labels.append(dt.strftime("%Y-%m-%d"))
        else:
            labels.append(dt.strftime("%b %d"))

    closes = [round(v, 2) for v in df["Close"].tolist()]

    return {
        "labels": labels,
        "series": [{"name": "Close", "data": closes}],
        "suggestedTitle": f"{ticker.upper()} Stock Price",
        "suggestedType": "line",
        "xAxisLabel": "Date",
        "yAxisLabel": "Price (USD)",
    }
