import math
from html import escape
from typing import Any, Dict, List, Sequence


def extract_svg(content: str) -> str:
    """Extract one complete SVG document from a model response."""
    start = content.find("<svg")
    end = content.rfind("</svg>")
    if start < 0 or end < start:
        raise ValueError("Invalid SVG response")
    return content[start:end + len("</svg>")].strip()


def _format_value(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, int):
        return f"{value:,}"
    if isinstance(value, float):
        if not math.isfinite(value):
            return "—"
        if value.is_integer():
            return f"{int(value):,}"
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    return str(value)


def build_fallback_infographic(
    data: Dict[str, Any],
    title: str,
    colors: Sequence[str],
    theme: str,
) -> str:
    """Build a deterministic, self-contained SVG when AI generation is unavailable."""
    raw_labels = data.get("labels")
    labels = [str(label) for label in raw_labels] if isinstance(raw_labels, list) else []
    raw_series = data.get("series")
    series: List[Dict[str, Any]] = [
        entry for entry in raw_series
        if isinstance(entry, dict) and isinstance(entry.get("data"), list)
    ] if isinstance(raw_series, list) else []

    palette = list(colors) or ["#6366f1"]
    is_light = theme == "light"
    background = "#ffffff" if is_light else "#0a0a0f"
    card = "#f8fafc" if is_light else "#15151d"
    border = "#e2e8f0" if is_light else "#2a2a38"
    primary_text = "#0f172a" if is_light else "#f0f0f5"
    secondary_text = "#64748b" if is_light else "#9898aa"

    safe_title = escape(title or "Data Visualization", quote=True)
    svg_parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" '
        'role="img" aria-labelledby="infographic-title" data-infographic-source="fallback">',
        f'<title id="infographic-title">{safe_title}</title>',
        f'<rect width="1600" height="1200" fill="{background}"/>',
        f'<rect x="40" y="42" width="12" height="72" rx="6" fill="{palette[0]}"/>',
        f'<text x="80" y="92" fill="{primary_text}" font-family="Manrope, sans-serif" '
        f'font-size="38" font-weight="700">{safe_title}</text>',
        f'<text x="80" y="126" fill="{secondary_text}" font-family="Manrope, sans-serif" '
        f'font-size="16">{len(labels)} data points · {len(series)} series</text>',
    ]

    if not labels or not series:
        svg_parts.extend([
            f'<rect x="40" y="180" width="1520" height="880" rx="24" fill="{card}" stroke="{border}"/>',
            f'<text x="800" y="620" text-anchor="middle" fill="{secondary_text}" '
            'font-family="Manrope, sans-serif" font-size="28">No chart data available</text>',
            "</svg>",
        ])
        return "".join(svg_parts)

    point_count = len(labels)
    columns = min(6, max(1, math.ceil(math.sqrt(point_count * 1.35))))
    rows = math.ceil(point_count / columns)
    gap = 22.0
    content_x = 40.0
    content_y = 166.0
    content_width = 1520.0
    content_height = 994.0
    card_width = (content_width - gap * (columns - 1)) / columns
    card_height = (content_height - gap * (rows - 1)) / rows
    label_size = max(11.0, min(22.0, card_height * 0.14))

    for index, label in enumerate(labels):
        column = index % columns
        row = index // columns
        x = content_x + column * (card_width + gap)
        y = content_y + row * (card_height + gap)
        accent = palette[index % len(palette)]
        safe_label = escape(label, quote=True)
        svg_parts.extend([
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_width:.1f}" height="{card_height:.1f}" '
            f'rx="18" fill="{card}" stroke="{border}"/>',
            f'<rect x="{x:.1f}" y="{y:.1f}" width="7" height="{card_height:.1f}" '
            f'rx="3.5" fill="{accent}"/>',
            f'<text x="{x + 24:.1f}" y="{y + 34:.1f}" fill="{secondary_text}" '
            f'font-family="Manrope, sans-serif" font-size="{label_size:.1f}" font-weight="600">{safe_label}</text>',
        ])

        if len(series) == 1:
            entry = series[0]
            values = entry.get("data", [])
            value = values[index] if index < len(values) else None
            safe_value = escape(_format_value(value), quote=True)
            safe_name = escape(str(entry.get("name") or "Value"), quote=True)
            value_size = max(18.0, min(36.0, card_height * 0.24))
            svg_parts.extend([
                f'<text x="{x + 24:.1f}" y="{y + card_height * 0.66:.1f}" fill="{primary_text}" '
                f'font-family="Manrope, sans-serif" font-size="{value_size:.1f}" font-weight="700">{safe_value}</text>',
                f'<text x="{x + 24:.1f}" y="{y + card_height * 0.82:.1f}" fill="{secondary_text}" '
                f'font-family="Manrope, sans-serif" font-size="13">{safe_name}</text>',
            ])
            continue

        available_height = max(24.0, card_height - 58.0)
        line_height = max(11.0, min(24.0, available_height / len(series)))
        series_size = max(9.0, min(16.0, line_height * 0.62))
        for series_index, entry in enumerate(series):
            values = entry.get("data", [])
            value = values[index] if index < len(values) else None
            safe_name = escape(str(entry.get("name") or "Series"), quote=True)
            safe_value = escape(_format_value(value), quote=True)
            text_y = y + 58.0 + series_index * line_height
            series_color = palette[series_index % len(palette)]
            svg_parts.extend([
                f'<circle cx="{x + 26:.1f}" cy="{text_y - 5:.1f}" r="4" fill="{series_color}"/>',
                f'<text x="{x + 38:.1f}" y="{text_y:.1f}" fill="{primary_text}" '
                f'font-family="Manrope, sans-serif" font-size="{series_size:.1f}">'
                f'<tspan fill="{secondary_text}">{safe_name}:</tspan> {safe_value}</text>',
            ])

    svg_parts.append("</svg>")
    return "".join(svg_parts)
