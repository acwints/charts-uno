"""Unlisted chart share pages.

A share token lets anyone with the link view one saved chart. It does not
publish the chart to the community feed. The HTML page carries the title and
preview image in the document head so a chat app can unfurl the link without
running the React app.
"""
from __future__ import annotations

import html
import math
import os
import re
import struct
import zlib
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.database import REVIEW_LOGIN_GOOGLE_ID, Chart, User

TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,64}$")
CANONICAL_ORIGIN = "https://www.chartsuno.com"
CTA_TEXT = "Made with Chartsuno: make your own free"
_MAX_LABELS = 12
_MAX_SERIES = 4
_SERIES_COLORS = ("#7aa2ff", "#c4b5fd", "#5eead4", "#fcd34d")

# 5x7 glyphs. '#' is ink. Unknown characters are skipped so a title cannot
# break the preview image, and the page itself uses real fonts.
_GLYPHS = {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": ["###..", ".#...", ".#...", ".#...", ".#...", ".#...", "###.."],
    "J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".###.", "#...#", "#....", ".###.", "....#", "#...#", ".###."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
    "1": [".#...", "##...", ".#...", ".#...", ".#...", ".#...", "###.."],
    "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    ".": [".....", ".....", ".....", ".....", ".....", "..#..", "..#.."],
    ",": [".....", ".....", ".....", ".....", "..#..", "..#..", ".#..."],
    "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    "-": [".....", ".....", ".....", "###..", ".....", ".....", "....."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
    "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", ".#..#", "#...#"],
    "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    "?": [".###.", "#...#", "...#.", "..#..", "..#..", ".....", "..#.."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
}


def public_web_origin() -> str:
    """Canonical site origin. chartsuno.com redirects to www."""
    raw = os.environ.get("PUBLIC_APP_URL", CANONICAL_ORIGIN).strip().rstrip("/")
    if raw in {"https://chartsuno.com", "http://chartsuno.com", "http://www.chartsuno.com"}:
        return CANONICAL_ORIGIN
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return CANONICAL_ORIGIN


def share_url(token: str) -> str:
    return f"{public_web_origin()}/s/{token}"


def excluded_account_clause():
    """Accounts that are not real signups.

    Excluded:
    - @example.com, @example.org, @example.net (reserved examples)
    - the .test, .invalid, and .localhost TLDs
    - @chartsuno.local (the bot service user)
    - the App Review demo account
    """
    return or_(
        User.email.ilike("%@example.com"),
        User.email.ilike("%@example.org"),
        User.email.ilike("%@example.net"),
        User.email.ilike("%.test"),
        User.email.ilike("%.invalid"),
        User.email.ilike("%.localhost"),
        User.email.ilike("%@chartsuno.local"),
        User.google_id == REVIEW_LOGIN_GOOGLE_ID,
    )


def real_signup_count(db: Session) -> int:
    """Accounts a person created. Reserved test domains and the review demo are out."""
    count = db.query(func.count(User.id)).filter(~excluded_account_clause()).scalar()
    return int(count or 0)


SHARE_LINK_WINDOW_UNSUPPORTED = (
    "charts.share_token has no timestamp. A link can be on or off, but not dated, "
    "so users who enabled a share link in the last 7 days cannot be counted."
)


def activity_stats(db: Session, now=None) -> dict:
    """Aggregate counts only. No emails, names, or chart contents.

    share_link_enablers_7d is null because the schema cannot support it.
    """
    moment = now or datetime.utcnow()
    window_start = moment - timedelta(days=7)
    real_users = db.query(User.id).filter(~excluded_account_clause())
    recent_charts = db.query(Chart).filter(
        Chart.created_at >= window_start,
        Chart.user_id.in_(real_users),
    )
    charts_created = recent_charts.count()
    creators = (
        db.query(func.count(func.distinct(Chart.user_id)))
        .filter(Chart.created_at >= window_start, Chart.user_id.in_(real_users))
        .scalar()
    )
    return {
        "signups": real_signup_count(db),
        "chart_creators_7d": int(creators or 0),
        "charts_created_7d": int(charts_created or 0),
        "share_link_enablers_7d": None,
        "unsupported": {"share_link_enablers_7d": SHARE_LINK_WINDOW_UNSUPPORTED},
    }


def display_title(chart: Chart) -> str:
    config = chart.config if isinstance(chart.config, dict) else {}
    raw = config.get("title") or chart.title or "Untitled chart"
    title = str(raw).strip()
    return title[:180] or "Untitled chart"


def _chart_data(chart: Chart) -> dict:
    return chart.data if isinstance(chart.data, dict) else {}


def _chart_config(chart: Chart) -> dict:
    return chart.config if isinstance(chart.config, dict) else {}


def _author_name(chart: Chart) -> Optional[str]:
    user = getattr(chart, "user", None)
    name = getattr(user, "name", None) if user is not None else None
    if not name:
        return None
    cleaned = str(name).strip()
    return cleaned[:80] or None


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def _series(data: dict) -> list[dict]:
    prepared = []
    for item in (data.get("series") or [])[:_MAX_SERIES]:
        if not isinstance(item, dict):
            continue
        values = [_number(value) for value in (item.get("data") or [])[:_MAX_LABELS]]
        if not any(value is not None for value in values):
            continue
        prepared.append({"name": str(item.get("name") or "Series")[:40], "data": values})
    return prepared


def _labels(data: dict, count: int) -> list[str]:
    raw = data.get("labels") or []
    labels = [str(item)[:28] for item in raw[:count]]
    while len(labels) < count:
        labels.append(str(len(labels) + 1))
    return labels


def _kind(config: dict) -> str:
    kind = str(config.get("type") or "bar")
    if kind in {"bar", "line", "area", "pie", "histogram", "scatter", "table"}:
        return "bar" if kind == "histogram" else kind
    return "bar"


def _horizontal(config: dict) -> bool:
    return config.get("barLayout") == "horizontal"


class _Canvas:
    def __init__(self, width: int, height: int, color: tuple[int, int, int]):
        self.width = width
        self.height = height
        self.buf = bytearray(color * width * height)

    def rect(self, x: int, y: int, w: int, h: int, color: tuple[int, int, int]) -> None:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.width, x + max(0, w)), min(self.height, y + max(0, h))
        if x0 >= x1 or y0 >= y1:
            return
        row = bytes(color) * (x1 - x0)
        stride = self.width * 3
        for yy in range(y0, y1):
            start = yy * stride + x0 * 3
            self.buf[start:start + len(row)] = row

    def glyph(self, char: str, x: int, y: int, scale: int, color: tuple[int, int, int]) -> None:
        rows = _GLYPHS.get(char)
        if not rows:
            return
        for row_index, row in enumerate(rows):
            for col_index, pixel in enumerate(row):
                if pixel == "#":
                    self.rect(x + col_index * scale, y + row_index * scale, scale, scale, color)

    def text(self, value: str, x: int, y: int, scale: int, color: tuple[int, int, int], max_width: int) -> list[str]:
        """Draw wrapped uppercase text. Returns the lines that were drawn."""
        words = re.sub(r"[^A-Za-z0-9 .,:'+/!$%&?()-]", " ", value).upper().split()
        if not words:
            return []
        advance = 6 * scale
        max_chars = max(8, max_width // advance)
        lines: list[str] = []
        current = ""
        for word in words:
            word = word[:max_chars]
            trial = word if not current else f"{current} {word}"
            if len(trial) <= max_chars:
                current = trial
            else:
                lines.append(current)
                current = word
            if len(lines) == 3:
                break
        if current and len(lines) < 3:
            lines.append(current)
        for index, line in enumerate(lines):
            cursor = x
            for char in line:
                self.glyph(char, cursor, y + index * (8 * scale), scale, color)
                cursor += advance
        return lines


def _png(canvas: _Canvas) -> bytes:
    raw = bytearray()
    stride = canvas.width * 3
    for y in range(canvas.height):
        raw.append(0)
        start = y * stride
        raw.extend(canvas.buf[start:start + stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", canvas.width, canvas.height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def _hex(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)


def render_share_png(chart: Chart) -> bytes:
    canvas = _Canvas(1200, 630, (16, 16, 20))
    canvas.rect(0, 0, 1200, 8, (122, 162, 255))
    canvas.text("CHARTSUNO", 72, 48, 3, (154, 168, 198), 1000)
    lines = canvas.text(display_title(chart), 72, 96, 4, (246, 246, 248), 1050)
    top = 96 + max(1, len(lines)) * 32 + 28
    footer_y = 590
    _draw_png_chart(canvas, chart, 72, top, 1056, max(120, footer_y - top - 24))
    canvas.text("MAKE YOUR OWN FREE", 72, footer_y, 2, (154, 168, 198), 700)
    return _png(canvas)


def _draw_png_chart(canvas: _Canvas, chart: Chart, x: int, y: int, w: int, h: int) -> None:
    canvas.rect(x, y, w, h, (26, 26, 32))
    data = _chart_data(chart)
    series = _series(data)
    if not series or h < 40:
        canvas.text("OPEN TO VIEW", x + 36, y + h // 2 - 10, 3, (200, 204, 214), w - 72)
        return
    kind = _kind(_chart_config(chart))
    labels = _labels(data, max(len(item["data"]) for item in series))
    values = [value for item in series for value in item["data"] if value is not None]
    lo = min(0.0, min(values))
    hi = max(0.0, max(values))
    if math.isclose(lo, hi):
        hi = lo + 1
    span = hi - lo
    plot_x, plot_y = x + 28, y + 24
    plot_w, plot_h = w - 56, h - 56
    if kind == "pie":
        _png_pie(canvas, series[0], plot_x, plot_y, plot_w, plot_h)
        return
    zero = plot_y + plot_h - int(((0 - lo) / span) * plot_h)
    canvas.rect(plot_x, zero, plot_w, 1, (70, 74, 86))
    slot = plot_w / max(1, len(labels))
    group = max(4, int(slot * 0.72))
    bar_w = max(3, group // max(1, len(series)))
    for label_index in range(len(labels)):
        origin = plot_x + int(label_index * slot + (slot - group) / 2)
        for series_index, item in enumerate(series):
            value = item["data"][label_index] if label_index < len(item["data"]) else None
            if value is None:
                continue
            y_value = plot_y + plot_h - int(((value - lo) / span) * plot_h)
            y0, y1 = sorted((y_value, zero))
            color = _hex(_SERIES_COLORS[series_index % len(_SERIES_COLORS)])
            if kind in {"line", "area", "scatter"}:
                canvas.rect(origin + series_index * 8, y_value - 3, 7, 7, color)
            else:
                canvas.rect(origin + series_index * bar_w, y0, max(2, bar_w - 2), max(1, y1 - y0), color)
    if kind in {"line", "area"}:
        for series_index, item in enumerate(series):
            color = _hex(_SERIES_COLORS[series_index % len(_SERIES_COLORS)])
            points = []
            for label_index, value in enumerate(item["data"]):
                if value is None:
                    continue
                px = plot_x + int(label_index * slot + slot / 2)
                py = plot_y + plot_h - int(((value - lo) / span) * plot_h)
                points.append((px, py))
            for start, end in zip(points, points[1:]):
                _png_line(canvas, start, end, color)


def _png_line(canvas: _Canvas, start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int]) -> None:
    x0, y0 = start
    x1, y1 = end
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    for step in range(steps + 1):
        x = x0 + round((x1 - x0) * step / steps)
        y = y0 + round((y1 - y0) * step / steps)
        canvas.rect(x, y - 1, 3, 3, color)


def _png_pie(canvas: _Canvas, series: dict, x: int, y: int, w: int, h: int) -> None:
    slices = [value for value in series["data"] if value is not None and value > 0]
    total = sum(slices)
    if total <= 0:
        return
    cx, cy = x + w // 2, y + h // 2
    radius = max(8, min(w, h) // 2 - 8)
    angle = -math.pi / 2
    colored = []
    for index, value in enumerate(slices):
        sweep = (value / total) * math.tau
        colored.append((angle, angle + sweep, _hex(_SERIES_COLORS[index % len(_SERIES_COLORS)])))
        angle += sweep
    for py in range(cy - radius, cy + radius):
        for px in range(cx - radius, cx + radius):
            dx, dy = px - cx, py - cy
            if dx * dx + dy * dy > radius * radius:
                continue
            point = math.atan2(dy, dx)
            for start, end, color in colored:
                # Compare on the same -pi..pi range used by atan2, unwrapped per slice.
                probe = point
                while probe < start:
                    probe += math.tau
                if start <= probe < end:
                    canvas.rect(px, py, 1, 1, color)
                    break


def _fmt(value: float) -> str:
    if math.isclose(value, round(value)):
        return str(int(round(value)))
    return f"{value:.1f}"


def _svg_chart(data: dict, config: dict) -> str:
    series = _series(data)
    if not series:
        return '<p class="share-empty">This chart has no numbers to draw.</p>'
    kind = _kind(config)
    labels = _labels(data, max(len(item["data"]) for item in series))
    if kind == "table":
        return _html_table(labels, series)
    if kind == "pie":
        return _svg_pie(labels, series[0])
    return _svg_cartesian(labels, series, kind, _horizontal(config) and kind == "bar")


def _html_table(labels: list[str], series: list[dict]) -> str:
    head = "".join(f"<th scope=\"col\">{html.escape(item['name'])}</th>" for item in series)
    rows = []
    for index, label in enumerate(labels):
        cells = []
        for item in series:
            value = item["data"][index] if index < len(item["data"]) else None
            cells.append(f"<td>{html.escape(_fmt(value) if value is not None else '—')}</td>")
        rows.append(f"<tr><th scope=\"row\">{html.escape(label)}</th>{''.join(cells)}</tr>")
    return (
        '<div class="share-table-wrap"><table class="share-table">'
        f"<thead><tr><th scope=\"col\"> </th>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table></div>"
    )


def _svg_pie(labels: list[str], series: dict) -> str:
    slices = []
    for index, value in enumerate(series["data"]):
        if value is not None and value > 0:
            slices.append((labels[index] if index < len(labels) else str(index + 1), value))
    total = sum(value for _, value in slices)
    if total <= 0:
        return '<p class="share-empty">This pie chart has no positive values.</p>'
    paths = []
    legend = []
    angle = -math.pi / 2
    cx, cy, radius = 180, 168, 112
    if len(slices) == 1:
        color = _SERIES_COLORS[0]
        paths.append(f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="{color}" />')
        legend.append(_legend_item(slices[0][0], color, slices[0][1]))
    else:
        for index, (label, value) in enumerate(slices):
            sweep = (value / total) * math.tau
            end = angle + sweep
            large = 1 if sweep > math.pi else 0
            x0, y0 = cx + radius * math.cos(angle), cy + radius * math.sin(angle)
            x1, y1 = cx + radius * math.cos(end), cy + radius * math.sin(end)
            color = _SERIES_COLORS[index % len(_SERIES_COLORS)]
            paths.append(
                f'<path d="M {cx} {cy} L {x0:.2f} {y0:.2f} A {radius} {radius} 0 {large} 1 {x1:.2f} {y1:.2f} Z" fill="{color}" />'
            )
            legend.append(_legend_item(label, color, value))
            angle = end
    return (
        f'<svg class="share-svg" viewBox="0 0 640 360" role="img">'
        f'<rect width="640" height="360" fill="#1a1a20" rx="16" />'
        f'{"".join(paths)}<g transform="translate(360,48)">{"".join(legend)}</g></svg>'
    )


def _legend_item(label: str, color: str, value: float) -> str:
    safe = html.escape(label)
    return (
        '<g class="share-legend-item">'
        f'<rect width="12" height="12" rx="2" fill="{color}" />'
        f'<text x="20" y="11">{safe} · {html.escape(_fmt(value))}</text></g>'
    )


def _svg_cartesian(labels: list[str], series: list[dict], kind: str, horizontal: bool) -> str:
    values = [value for item in series for value in item["data"] if value is not None]
    lo = min(0.0, min(values))
    hi = max(0.0, max(values))
    if math.isclose(lo, hi):
        hi = lo + 1
    span = hi - lo
    left, top, width, height = 56, 28, 560, 250
    bottom = top + height
    parts = [f'<svg class="share-svg" viewBox="0 0 640 360" role="img">',
             '<rect width="640" height="360" fill="#1a1a20" rx="16" />']
    zero = bottom - ((0 - lo) / span) * height
    parts.append(f'<line x1="{left}" y1="{zero:.1f}" x2="{left + width}" y2="{zero:.1f}" stroke="#3a3a46" />')
    if horizontal:
        band = height / max(1, len(labels))
        thickness = max(6, band * 0.7 / max(1, len(series)))
        for index, label in enumerate(labels):
            y = top + index * band + (band - thickness * len(series)) / 2
            parts.append(
                f'<text x="{left - 8}" y="{y + thickness / 2 + 4:.1f}" text-anchor="end" class="share-axis">{html.escape(label)}</text>'
            )
            for series_index, item in enumerate(series):
                value = item["data"][index] if index < len(item["data"]) else None
                if value is None:
                    continue
                length = (abs(value) / span) * width
                color = _SERIES_COLORS[series_index % len(_SERIES_COLORS)]
                bar_y = y + series_index * thickness
                if value >= 0:
                    parts.append(
                        f'<rect x="{left + (0 - lo) / span * width:.1f}" y="{bar_y:.1f}" width="{max(length, 1):.1f}" height="{max(thickness - 3, 2):.1f}" fill="{color}" rx="2" />'
                    )
                else:
                    parts.append(
                        f'<rect x="{left + (value - lo) / span * width:.1f}" y="{bar_y:.1f}" width="{max(length, 1):.1f}" height="{max(thickness - 3, 2):.1f}" fill="{color}" rx="2" />'
                    )
    else:
        slot = width / max(1, len(labels))
        group = slot * 0.72
        bar_w = group / max(1, len(series))
        points: list[list[tuple[float, float]]] = [[] for _ in series]
        for index, label in enumerate(labels):
            origin = left + index * slot + (slot - group) / 2
            anchor = left + index * slot + slot / 2
            parts.append(
                f'<text x="{anchor:.1f}" y="{bottom + 22}" text-anchor="middle" class="share-axis">{html.escape(label)}</text>'
            )
            for series_index, item in enumerate(series):
                value = item["data"][index] if index < len(item["data"]) else None
                if value is None:
                    continue
                y_value = bottom - ((value - lo) / span) * height
                color = _SERIES_COLORS[series_index % len(_SERIES_COLORS)]
                if kind in {"line", "area", "scatter"}:
                    points[series_index].append((anchor, y_value))
                    if kind == "scatter":
                        parts.append(f'<circle cx="{anchor:.1f}" cy="{y_value:.1f}" r="5" fill="{color}" />')
                else:
                    y0, y1 = sorted((y_value, zero))
                    parts.append(
                        f'<rect x="{origin + series_index * bar_w:.1f}" y="{y0:.1f}" width="{max(bar_w - 4, 2):.1f}" height="{max(y1 - y0, 1):.1f}" fill="{color}" rx="2" />'
                    )
        if kind in {"line", "area"}:
            for series_index, item_points in enumerate(points):
                if len(item_points) < 1:
                    continue
                color = _SERIES_COLORS[series_index % len(_SERIES_COLORS)]
                commands = " ".join(f"{px:.1f},{py:.1f}" for px, py in item_points)
                if kind == "area" and item_points:
                    area = f"M {item_points[0][0]:.1f},{zero:.1f} L " + " L ".join(
                        f"{px:.1f},{py:.1f}" for px, py in item_points
                    ) + f" L {item_points[-1][0]:.1f},{zero:.1f} Z"
                    parts.append(f'<path d="{area}" fill="{color}" opacity="0.28" />')
                if len(item_points) >= 2:
                    parts.append(f'<polyline points="{commands}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />')
                for px, py in item_points:
                    parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="3.5" fill="{color}" />')
    if len(series) > 1:
        legend = []
        for index, item in enumerate(series):
            color = _SERIES_COLORS[index % len(_SERIES_COLORS)]
            legend.append(
                f'<g transform="translate({index * 150},0)"><rect width="10" height="10" rx="2" fill="{color}" />'
                f'<text x="16" y="10">{html.escape(item["name"])}</text></g>'
            )
        parts.append(f'<g class="share-legend" transform="translate(56,332)">{"".join(legend)}</g>')
    parts.append("</svg>")
    return "".join(parts)


_PAGE_CSS = """
:root { color-scheme: dark; }
.share-body {
  margin: 0;
  background: #101014;
  color: #f4f4f5;
  font-family: Manrope, "Segoe UI", sans-serif;
  padding: 28px max(20px, env(safe-area-inset-right)) calc(36px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
}
.share-wrap { max-width: 880px; margin: 0 auto; }
.share-brand { color: #f4f4f5; font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: 1.35rem; text-decoration: none; }
.share-brand:focus-visible, .share-cta:focus-visible, .share-quiet:focus-visible { outline: 2px solid #9db7ff; outline-offset: 3px; }
.share-kicker { margin: 28px 0 0; color: #9aa0b4; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.75rem; }
.share-title { margin: 8px 0 0; font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.05; }
.share-by { color: #b7bccb; margin: 10px 0 0; }
.share-figure { margin: 28px 0 0; }
.share-svg { width: 100%; height: auto; display: block; }
.share-axis, .share-legend text, .share-svg text { fill: #c5c8d4; font-size: 12px; font-family: Manrope, sans-serif; }
.share-legend-item { transform: translateY(calc(var(--i) * 28px)); }
.share-table-wrap { overflow-x: auto; border-radius: 16px; background: #1a1a20; }
.share-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.share-table th, .share-table td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #2a2a33; }
.share-empty { color: #b7bccb; }
.share-cta {
  display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 28px;
  padding: 12px 18px; border-radius: 999px; background: #7aa2ff; color: #101014; font-weight: 700;
  text-decoration: none; text-align: center;
  transition: background-color 150ms, color 150ms;
}
.share-cta:hover { background: #9db7ff; }
.share-note { color: #9aa0b4; font-size: 0.92rem; line-height: 1.5; }
.share-quiet { color: #9db7ff; }
@media (prefers-reduced-motion: reduce) {
  .share-cta { transition: none; }
}
"""


def _legend_positions(svg: str) -> str:
    """Stack pie legend rows. The SVG text does not know about CSS variables."""
    parts = svg.split('<g class="share-legend-item">')
    if len(parts) == 1:
        return svg
    rebuilt = [parts[0]]
    for index, part in enumerate(parts[1:]):
        rebuilt.append(f'<g class="share-legend-item" transform="translate(0,{index * 28})">')
        rebuilt.append(part)
    return "".join(rebuilt)


def render_share_html(chart: Chart, token: str) -> str:
    title = display_title(chart)
    safe_title = html.escape(title)
    description = f"{title} — a chart made with Chartsuno."
    safe_description = html.escape(description[:180])
    url = share_url(token)
    image = f"{url}/og.png"
    author = _author_name(chart)
    byline = f'<p class="share-by">By {html.escape(author)}</p>' if author else ""
    chart_html = _legend_positions(_svg_chart(_chart_data(chart), _chart_config(chart)))
    cta = html.escape(CTA_TEXT)
    origin = public_web_origin()
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{safe_title} | Chartsuno</title>
  <meta name="description" content="{safe_description}">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="{html.escape(url)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Chartsuno">
  <meta property="og:title" content="{safe_title}">
  <meta property="og:description" content="{safe_description}">
  <meta property="og:url" content="{html.escape(url)}">
  <meta property="og:image" content="{html.escape(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{safe_title}">
  <meta name="twitter:description" content="{safe_description}">
  <meta name="twitter:image" content="{html.escape(image)}">
  <link rel="icon" href="/favicon.svg">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <style>{_PAGE_CSS}</style>
</head>
<body class="share-body">
  <main class="share-wrap">
    <a class="share-brand" href="{origin}/">Chartsuno</a>
    <p class="share-kicker">Shared chart</p>
    <h1 class="share-title">{safe_title}</h1>
    {byline}
    <figure class="share-figure">{chart_html}</figure>
    <a class="share-cta" href="{origin}/?auth=1">{cta}</a>
    <p class="share-note">Anyone with this link can view the saved chart. Previewing your own chart is free, and a free account saves up to 10 charts a month.</p>
  </main>
</body>
</html>
"""


def render_missing_share_html() -> str:
    origin = public_web_origin()
    cta = html.escape(CTA_TEXT)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Chart link unavailable | Chartsuno</title>
  <meta name="robots" content="noindex">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <style>{_PAGE_CSS}</style>
</head>
<body class="share-body">
  <main class="share-wrap">
    <a class="share-brand" href="{origin}/">Chartsuno</a>
    <h1 class="share-title">This chart link is off</h1>
    <p class="share-note">The link was turned off, or the chart was deleted.</p>
    <a class="share-cta" href="{origin}/?auth=1">{cta}</a>
  </main>
</body>
</html>
"""
