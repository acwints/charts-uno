"""SQL connection service — validation, execution, and result transformation.

Handles connecting to user PostgreSQL databases, validating queries,
executing them with safety constraints, and transforming results into
the chart data contract ({labels, series}).
"""
import asyncio
import logging
from datetime import datetime, date
from typing import Optional

import sqlglot
from sqlglot.errors import ParseError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

from models.database import SqlConnection
from utils.crypto import decrypt_credential

logger = logging.getLogger(__name__)

# Safety limits
CONNECT_TIMEOUT_SECONDS = 5
STATEMENT_TIMEOUT_MS = 15000  # 15 seconds
MAX_ROWS = 5000
MAX_CHART_POINTS = 500


def validate_sql_query(sql: str) -> None:
    """Validate that a SQL string contains only SELECT statements.

    Raises ValueError for non-SELECT statements (INSERT, UPDATE, DELETE, DROP, etc.)
    or unparseable SQL.
    """
    sql_stripped = sql.strip().rstrip(";")
    if not sql_stripped:
        raise ValueError("Query cannot be empty")

    try:
        parsed = sqlglot.parse(sql_stripped)
    except ParseError as e:
        raise ValueError(f"Invalid SQL syntax: {e}")

    if not parsed:
        raise ValueError("Could not parse SQL query")

    for statement in parsed:
        if statement is None:
            continue
        # Allow only SELECT statements (including WITH/CTE that resolve to SELECT)
        if not isinstance(statement, sqlglot.exp.Select):
            # Check for CTE (WITH ... SELECT)
            if isinstance(statement, sqlglot.exp.Union):
                continue  # UNION of SELECTs is fine
            stmt_type = type(statement).__name__
            raise ValueError(f"Only SELECT queries are allowed (got {stmt_type})")


def _decrypt_connection(connection: SqlConnection) -> dict:
    """Decrypt all encrypted fields of a connection."""
    return {
        "host": decrypt_credential(connection.host),
        "database_name": decrypt_credential(connection.database_name),
        "username": decrypt_credential(connection.username),
        "password": decrypt_credential(connection.encrypted_password),
        "port": connection.port,
        "ssl_required": connection.ssl_required,
    }


def _build_engine(decrypted: dict):
    """Create a disposable SQLAlchemy engine for a user database."""
    connect_args = {
        "options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
        "connect_timeout": CONNECT_TIMEOUT_SECONDS,
    }
    if decrypted["ssl_required"]:
        connect_args["sslmode"] = "require"

    url = URL.create(
        drivername="postgresql+psycopg2",
        username=decrypted["username"],
        password=decrypted["password"],
        host=decrypted["host"],
        port=decrypted["port"],
        database=decrypted["database_name"],
    )

    return create_engine(
        url,
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=False,
    )


def _execute_query_sync(connection: SqlConnection, sql: str) -> tuple[list[str], list[dict]]:
    """Execute a query synchronously (runs in thread pool)."""
    decrypted = _decrypt_connection(connection)
    engine = _build_engine(decrypted)
    try:
        with engine.connect() as conn:
            conn.execute(text("SET TRANSACTION READ ONLY"))
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [dict(r._mapping) for r in result.fetchmany(MAX_ROWS)]
            return columns, rows
    finally:
        engine.dispose()


async def execute_user_sql(connection: SqlConnection, sql: str) -> tuple[list[str], list[dict]]:
    """Execute a validated SQL query against a user's database.

    Returns (columns, rows) where rows is a list of dicts.
    """
    validate_sql_query(sql)
    return await asyncio.to_thread(_execute_query_sync, connection, sql)


async def test_connection(connection: SqlConnection) -> tuple[bool, str]:
    """Test that a connection is reachable. Returns (success, message)."""
    try:
        await asyncio.to_thread(_test_connection_sync, connection)
        return True, "Connection successful"
    except Exception as e:
        msg = str(e)
        # Simplify common error messages
        if "could not connect" in msg.lower() or "connection refused" in msg.lower():
            msg = "Connection refused — check host and port"
        elif "password authentication failed" in msg.lower():
            msg = "Authentication failed — check username and password"
        elif "does not exist" in msg.lower():
            msg = "Database not found — check database name"
        elif "timeout" in msg.lower():
            msg = "Connection timed out — check host and firewall rules"
        return False, msg


def _test_connection_sync(connection: SqlConnection) -> None:
    """Test connection synchronously."""
    decrypted = _decrypt_connection(connection)
    engine = _build_engine(decrypted)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    finally:
        engine.dispose()


def sql_rows_to_chart_data(
    columns: list[str],
    rows: list[dict],
    label_column: Optional[str] = None,
    series_columns: Optional[list[str]] = None,
) -> dict:
    """Transform SQL result rows into chart data contract.

    Returns {"labels": [...], "series": [{"name": ..., "data": [...]}, ...]}

    If label_column/series_columns not specified, auto-detects:
    - First string/date column → labels
    - All numeric columns → series
    """
    if not rows or not columns:
        return {"labels": [], "series": []}

    # Auto-detect columns if not specified
    if not label_column or not series_columns:
        sample = rows[0]
        detected_label = None
        detected_series = []

        for col in columns:
            val = sample.get(col)
            if val is None:
                continue
            if isinstance(val, (int, float)):
                detected_series.append(col)
            elif isinstance(val, (str, datetime, date)) and detected_label is None:
                detected_label = col

        if not label_column:
            label_column = detected_label or columns[0]
        if not series_columns:
            series_columns = detected_series or [c for c in columns if c != label_column]

    # Truncate to max chart points
    truncated_rows = rows[:MAX_CHART_POINTS]

    labels = [str(row.get(label_column, "")) for row in truncated_rows]
    series = []
    for col in series_columns:
        data = []
        for row in truncated_rows:
            val = row.get(col)
            if val is None:
                data.append(None)
            elif isinstance(val, (int, float)):
                data.append(float(val))
            else:
                try:
                    data.append(float(val))
                except (ValueError, TypeError):
                    data.append(None)
        series.append({"name": col, "data": data})

    return {"labels": labels, "series": series}
