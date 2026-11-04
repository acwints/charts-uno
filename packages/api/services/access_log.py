"""Keep the homepage-chart route out of access logs.

Uvicorn's access line starts with the client address. Dropping that line is
how this route avoids logging an IP. The handler also does not read one.
"""
import logging


def homepage_chart_path(record: logging.LogRecord) -> str:
    args = record.args if isinstance(record.args, tuple) else ()
    if len(args) >= 3:
        return str(args[2])
    return record.getMessage()


class SkipHomepageChartAccess(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/events/homepage-chart" not in homepage_chart_path(record)
