import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional


def get_bigquery_credentials_file() -> str:
    return os.environ.get("BIGQUERY_CREDENTIALS_FILE") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")


def get_bigquery_credentials_json() -> str:
    # Support a few common env var names used across deploy platforms.
    return (
        os.environ.get("BIGQUERY_CREDENTIALS_JSON")
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        or os.environ.get("GOOGLE_CREDENTIALS_JSON")
        or os.environ.get("GCP_SERVICE_ACCOUNT_JSON")
        or ""
    )


def _parse_credentials_json(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None

    # First try as plain JSON string.
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Then try as base64-encoded JSON.
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        parsed = json.loads(decoded)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return None


def has_bigquery_credentials() -> bool:
    path = get_bigquery_credentials_file()
    if path and Path(path).exists():
        return True
    return _parse_credentials_json(get_bigquery_credentials_json()) is not None


def get_bigquery_credentials_status() -> Dict[str, Any]:
    path = get_bigquery_credentials_file()
    json_raw = get_bigquery_credentials_json()
    parsed_json = _parse_credentials_json(json_raw)
    return {
        "credentialsConfigured": bool(path or json_raw),
        "credentialsFileConfigured": bool(path),
        "credentialsFileExists": bool(path and Path(path).exists()),
        "credentialsJsonConfigured": bool(json_raw),
        "credentialsJsonValid": parsed_json is not None,
    }


def load_bigquery_service_account_credentials():
    from google.oauth2 import service_account  # type: ignore

    path = get_bigquery_credentials_file()
    if path and Path(path).exists():
        return service_account.Credentials.from_service_account_file(
            path,
            scopes=["https://www.googleapis.com/auth/bigquery"],
        )

    parsed_json = _parse_credentials_json(get_bigquery_credentials_json())
    if parsed_json is not None:
        return service_account.Credentials.from_service_account_info(
            parsed_json,
            scopes=["https://www.googleapis.com/auth/bigquery"],
        )

    raise ValueError("No valid BigQuery service account credentials found.")
