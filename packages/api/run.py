#!/usr/bin/env python3
"""Entry point for running the Charts Agent API server."""

import copy
import os
import sys

# Add the api package to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from dotenv import load_dotenv
from uvicorn.config import LOGGING_CONFIG

load_dotenv()


def _log_config() -> dict:
    """Uvicorn access lines start with the client address. Omit this route."""
    config = copy.deepcopy(LOGGING_CONFIG)
    config.setdefault("filters", {})
    config["filters"]["skip_homepage_chart_ip"] = {"()": "services.access_log.SkipHomepageChartAccess"}
    config["handlers"]["access"].setdefault("filters", [])
    config["handlers"]["access"]["filters"].append("skip_homepage_chart_ip")
    return config


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "0.0.0.0")

    print(f"Starting Charts Agent API on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.environ.get("ENVIRONMENT") != "production",
        log_config=_log_config(),
    )
