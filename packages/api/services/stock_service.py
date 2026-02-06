import os
import json
from typing import Any, Dict, List, Optional

import httpx
import yfinance as yf

from services.ai_service import get_client, MODEL_NAME

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


async def fetch_stock_prices(ticker: str, range_key: str, ticker2: str | None = None) -> Dict[str, Any]:
    """Fetch stock price data from Yahoo Finance and transform into chart shape."""
    config = RANGE_CONFIG.get(range_key)
    if not config:
        raise ValueError(f"Invalid range: {range_key}. Use one of: {', '.join(RANGE_CONFIG.keys())}")

    tickers = [ticker.upper()]
    if ticker2:
        tickers.append(ticker2.upper())

    # Fetch all tickers
    all_series: List[Dict[str, Any]] = []
    labels: List[str] = []

    for i, sym in enumerate(tickers):
        stock = yf.Ticker(sym)
        df = stock.history(period=config["period"], interval=config["interval"])

        if df.empty:
            raise ValueError(f"No data available for {sym} in the selected range")

        # Use labels from first ticker (they should align)
        if i == 0:
            for dt in df.index:
                if config["interval"] == "1wk":
                    labels.append(dt.strftime("%Y-%m-%d"))
                else:
                    labels.append(dt.strftime("%b %d"))

        closes = [round(v, 2) for v in df["Close"].tolist()]
        all_series.append({"name": sym, "data": closes})

    title = " vs ".join(tickers) if len(tickers) > 1 else f"{tickers[0]} Stock Price"

    return {
        "labels": labels,
        "series": all_series,
        "suggestedTitle": title,
        "suggestedType": "line",
        "xAxisLabel": "Date",
        "yAxisLabel": "Price (USD)",
    }


async def generate_stock_insights(
    labels: List[str],
    series: List[Dict[str, Any]],
    title: str,
) -> str:
    """Generate AI insights about stock price data."""
    client = get_client()

    # Calculate basic stats for context
    stats = []
    for s in series:
        data = s.get("data", [])
        if len(data) >= 2:
            start_price = data[0]
            end_price = data[-1]
            change = end_price - start_price
            change_pct = (change / start_price) * 100 if start_price else 0
            high = max(data)
            low = min(data)
            stats.append({
                "symbol": s.get("name"),
                "start": start_price,
                "end": end_price,
                "change": round(change, 2),
                "changePct": round(change_pct, 2),
                "high": high,
                "low": low,
            })

    prompt = f"""You are a financial analyst providing brief insights about stock performance.

Stock Data:
- Title: {title}
- Period: {labels[0]} to {labels[-1]} ({len(labels)} data points)
- Stats: {json.dumps(stats, indent=2)}

Provide a concise 2-3 sentence insight about this stock data. Include:
1. Overall performance (up/down, by how much)
2. One notable pattern or observation (volatility, trend direction, comparison if multiple stocks)

Keep it factual and informative. No financial advice. No markdown formatting.
Example: "AAPL gained 8.3% over this period, rising from $178.50 to $193.30. The stock showed steady upward momentum with a brief pullback in mid-month before resuming its climb."

Return ONLY the insight text, nothing else."""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    content = response.text
    if not content:
        return "Stock data loaded successfully."

    return content.strip()
