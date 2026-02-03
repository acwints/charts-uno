import os
import json
import logging
from typing import Optional, Dict, Any, List

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure Gemini
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)


def get_model():
    """Get the Gemini model instance."""
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not configured")
    return genai.GenerativeModel("gemini-2.5-pro")


async def analyze_image(image_base64: str, mime_type: str) -> Dict[str, Any]:
    """Analyze an image and extract chart data."""
    model = get_model()

    prompt = """Analyze this image and extract any data that could be turned into a chart.

Look for:
- Tables, leaderboards, rankings
- Charts or graphs (extract the underlying data)
- Statistics, scores, numbers with labels
- Any structured numerical data

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "labels": ["label1", "label2", ...],
  "series": [
    {"name": "Series Name", "data": [num1, num2, ...]}
  ],
  "suggestedTitle": "A title for the chart",
  "suggestedType": "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "table",
  "stacked": true | false,
  "xAxisLabel": "Label for the x-axis (if visible)",
  "yAxisLabel": "Label for the y-axis (if visible)"
}

Rules:
- labels array must match the length of each data array
- All data values must be numbers (convert scores like "-27" to -27)
- If there are multiple numeric columns, create multiple series
- Choose suggestedType based on the data (rankings = table, trends = line, comparisons = bar, etc.)
- If you can't find chartable data, return: {"error": "No chartable data found"}
- Extract the PRIMARY PLOTTED DATA — bar heights, line points, area values. Ignore supplementary annotations (CAGR labels, growth percentages, footnotes) unless they ARE the primary data being plotted.
- Preserve the original axis orientation — if the x-axis shows time periods (years, dates, quarters, months), those MUST become the labels[] array. Categories or groups become separate series. Never pivot time values into series names.
- If the chart has a time-based x-axis (years, months, dates), labels MUST be the time values and each category/group must be a separate series.
- Recognize chart structure — for stacked or grouped bar charts, each color/segment = a series, each x-axis position = a label. Estimate segment values from visual proportions if exact numbers aren't labeled.
- Set "stacked" to true if the bars are stacked on top of each other, false if they are grouped side-by-side or not applicable."""

    response = model.generate_content([
        prompt,
        {
            "mime_type": mime_type,
            "data": image_base64,
        },
    ])

    content = response.text
    if not content:
        raise ValueError("No response from vision API")

    # Parse JSON response
    clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
    parsed = json.loads(clean_content)

    if "error" in parsed:
        raise ValueError(parsed["error"])

    if not parsed.get("labels") or not parsed.get("series"):
        raise ValueError("Invalid data structure returned")

    # Coerce labels to strings — Gemini sometimes returns numeric labels as ints
    parsed["labels"] = [str(label) for label in parsed["labels"]]

    return parsed


async def chat_with_chart(
    message: str,
    current_data: Dict[str, Any],
    current_config: Dict[str, Any],
    chat_history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """Process a chat message about chart data."""
    model = get_model()

    # Calculate stats
    stats = []
    for series in current_data.get("series", []):
        data = series.get("data", [])
        if data:
            sum_val = sum(data)
            avg = sum_val / len(data)
            min_val = min(data)
            max_val = max(data)
            min_idx = data.index(min_val)
            max_idx = data.index(max_val)
            labels = current_data.get("labels", [])
            stats.append({
                "name": series.get("name"),
                "sum": round(sum_val, 2),
                "average": round(avg, 2),
                "min": min_val,
                "max": max_val,
                "minLabel": labels[min_idx] if min_idx < len(labels) else None,
                "maxLabel": labels[max_idx] if max_idx < len(labels) else None,
                "count": len(data),
            })

    recent_history = chat_history[-6:] if chat_history else []
    history_text = ""
    if recent_history:
        history_text = "\nRECENT CONVERSATION:\n" + "\n".join(
            f"{m['role']}: {m['content']}" for m in recent_history
        ) + "\n"

    prompt = f"""You are an AI data analyst and visualization assistant. You can:

1. **Answer questions about the data** - Analyze trends, find insights, compare values, identify patterns
2. **Modify the underlying data** - Add columns, compute values, rename series, filter data, add summary rows
3. **Modify chart settings** - Change chart type, colors, style, toggles, title

CURRENT DATA:
- Labels: {json.dumps(current_data.get('labels', []))}
- Series: {json.dumps([{{'name': s.get('name'), 'data': s.get('data')}} for s in current_data.get('series', [])])}

PRE-COMPUTED STATS:
{json.dumps(stats, indent=2)}

CURRENT CONFIG:
- Type: {current_config.get('type')}
- Color Scheme: {current_config.get('colorScheme')}
- Style: {current_config.get('styleVariant')}
- Title: {current_config.get('title') or '(none)'}
- Show Grid: {current_config.get('showGrid')}, Legend: {current_config.get('showLegend')}, Values: {current_config.get('showValues')}, Stacked: {current_config.get('stacked', False)}

Available chart types: bar, line, area, pie, radar, scatter, table
Available color schemes: default, cool, warm, editorial, monochrome, muted
Available styles: professional, playful, editorial, minimalist, bold
{history_text}
USER MESSAGE: {message}

Respond with JSON only (no markdown):
{{
  "message": "Your response - answer questions conversationally, explain changes you made, or provide insights",
  "intent": "question" | "modification" | "both",
  "dataChanges": {{
    "labels": ["new", "labels"] | null,
    "series": [{{"name": "Series Name", "data": [1,2,3]}}] | null,
    "newColumns": [{{"name": "Total", "formula": "sum"}}] | null
  }},
  "configChanges": {{
    "type": "bar" | null,
    "colorScheme": "warm" | null,
    "styleVariant": "bold" | null,
    "title": "New Title" | null,
    "showGrid": true | null,
    "showLegend": true | null,
    "showValues": true | null,
    "stacked": true | null
  }},
  "reasoning": "Brief explanation (only for modifications)"
}}

Guidelines:
- Set intent to "question" if the user is asking about their data (no changes needed)
- Set intent to "modification" if the user wants to change something
- Set intent to "both" if answering a question AND making changes
- For questions: provide insightful, specific answers using the actual data values
- For modifications: only include fields you're changing (use null or omit unchanged fields)
- For newColumns with formula "sum", calculate the sum across all numeric series for each row
- For newColumns with formula "average", calculate the average across all numeric series
- Be conversational, specific, and reference actual values from the data
- If the request is unclear, ask for clarification"""

    response = model.generate_content(prompt)
    content = response.text

    if not content:
        raise ValueError("No response from AI")

    # Parse response
    clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean_content)
    except json.JSONDecodeError:
        return {
            "message": content,
            "updatedData": None,
            "updatedConfig": None,
            "changes": {
                "dataModified": False,
                "configModified": False,
                "summary": "Response received",
            },
        }

    # Process data changes
    updated_data = None
    data_modified = False

    if parsed.get("dataChanges"):
        data_changes = parsed["dataChanges"]
        updated_data = dict(current_data)

        if data_changes.get("labels"):
            updated_data["labels"] = data_changes["labels"]
            data_modified = True

        if data_changes.get("series"):
            updated_data["series"] = data_changes["series"]
            data_modified = True

        if data_changes.get("newColumns"):
            for col in data_changes["newColumns"]:
                new_data = []
                labels = current_data.get("labels", [])
                series = current_data.get("series", [])

                for i in range(len(labels)):
                    values = [s["data"][i] if i < len(s["data"]) else 0 for s in series]
                    formula = col.get("formula", "sum")

                    if formula == "sum":
                        new_data.append(sum(values))
                    elif formula in ("average", "avg"):
                        new_data.append(sum(values) / len(values) if values else 0)
                    elif formula == "min":
                        new_data.append(min(values) if values else 0)
                    elif formula == "max":
                        new_data.append(max(values) if values else 0)
                    else:
                        new_data.append(sum(values))

                if "series" not in updated_data:
                    updated_data["series"] = list(series)
                updated_data["series"].append({"name": col["name"], "data": new_data})
                data_modified = True

    # Process config changes
    updated_config = None
    config_modified = False

    if parsed.get("configChanges"):
        config_changes = parsed["configChanges"]
        updated_config = {}

        for key in ["type", "colorScheme", "styleVariant", "title", "showGrid", "showLegend", "showValues", "animate", "stacked"]:
            if config_changes.get(key) is not None:
                updated_config[key] = config_changes[key]
                config_modified = True

    change_summary = []
    if data_modified:
        change_summary.append("data updated")
    if config_modified:
        change_summary.append("chart settings changed")

    return {
        "message": parsed.get("message", ""),
        "updatedData": updated_data if data_modified else None,
        "updatedConfig": updated_config if config_modified else None,
        "changes": {
            "dataModified": data_modified,
            "configModified": config_modified,
            "summary": ", ".join(change_summary) if change_summary else "no changes made",
        },
    }


async def recommend_chart_type(
    data: Dict[str, Any],
    preferred_type: Optional[str] = None,
    user_prompt: Optional[str] = None,
) -> Dict[str, str]:
    """Recommend the best chart type for the given data."""
    model = get_model()

    labels = data.get("labels", [])
    series = data.get("series", [])

    data_description = {
        "labels": labels,
        "series": [
            {
                "name": s.get("name"),
                "sampleData": s.get("data", [])[:10],
                "min": min(s.get("data", [0])) if s.get("data") else 0,
                "max": max(s.get("data", [0])) if s.get("data") else 0,
                "count": len(s.get("data", [])),
            }
            for s in series
        ],
        "labelCount": len(labels),
        "seriesCount": len(series),
    }

    preferred_type_line = (
        f"Preferred chart type: {preferred_type} (use this type and justify it)"
        if preferred_type
        else "No preferred chart type provided"
    )

    user_prompt_line = (
        f"\nUser instructions: {user_prompt}\nConsider these instructions when analyzing the data and making your recommendation."
        if user_prompt
        else ""
    )

    prompt = f"""You are a data visualization expert and analyst. Analyze the provided data and recommend the best chart type. Consider:
- Data relationships and patterns
- Number of data points and series
- Whether labels are categorical, temporal, or ordinal
- What story the data is trying to tell
- Readability and clarity for the end user

Available chart types: bar, line, area, pie, radar, scatter, table
{preferred_type_line}{user_prompt_line}

Respond with JSON only (no markdown):
{{
  "type": "chartType",
  "reasoning": "A clear 1-2 sentence explanation of why this chart type is best for this data",
  "summary": "3-5 sentences that: (1) highlight the most interesting pattern, (2) explain why it matters, (3) note any bias or potential chart crime, and (4) state what the data does not answer"
}}

Analyze this data and recommend the best chart type:

{json.dumps(data_description, indent=2)}"""

    response = model.generate_content(prompt)
    content = response.text

    if not content:
        raise ValueError("No response from AI")

    try:
        clean_content = content.replace("```json\n", "").replace("\n```", "").replace("```", "").strip()
        parsed = json.loads(clean_content)

        resolved_type = preferred_type or parsed.get("type", "table")

        valid_types = ["bar", "line", "area", "pie", "radar", "scatter", "table"]
        if resolved_type not in valid_types:
            resolved_type = "table"

        return {
            "type": resolved_type,
            "reasoning": parsed.get("reasoning", "AI recommendation based on data analysis."),
            "summary": parsed.get("summary", "Summary unavailable for this dataset."),
        }
    except json.JSONDecodeError:
        return {
            "type": "table",
            "reasoning": "Default recommendation for flexible data viewing.",
            "summary": "Summary unavailable for this dataset.",
        }


# Color palettes matching the frontend
COLOR_PALETTES = {
    "default": ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
    "warm": ["#f97316", "#ef4444", "#ec4899", "#f59e0b", "#eab308", "#84cc16"],
    "cool": ["#3b82f6", "#06b6d4", "#8b5cf6", "#6366f1", "#0ea5e9", "#14b8a6"],
    "editorial": ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483", "#4a0e4e"],
    "monochrome": ["#18181b", "#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8"],
    "muted": ["#78716c", "#a8a29e", "#64748b", "#94a3b8", "#6b7280", "#9ca3af"],
}


async def generate_infographic(
    data: Dict[str, Any],
    title: str,
    color_scheme: str,
    theme: str = "dark",
    source_image_base64: Optional[str] = None,
    source_image_mime_type: Optional[str] = None,
) -> str:
    """Generate an SVG infographic for the given data."""
    model = get_model()

    colors = COLOR_PALETTES.get(color_scheme, COLOR_PALETTES["default"])

    labels = data.get("labels", [])
    series = data.get("series", [])

    data_description = f"""
Title: {title or 'Data Visualization'}
Labels: {', '.join(labels)}
Series:
{chr(10).join(f"  - {s.get('name')}: {', '.join(str(v) for v in s.get('data', []))}" for s in series)}
    """.strip()

    data_json = json.dumps(
        {
            "labels": labels,
            "series": [
                {"name": s.get("name"), "data": s.get("data", [])}
                for s in series
            ],
        },
        indent=2,
    )

    theme_colors = {
        "light": {
            "background": "#ffffff",
            "primaryText": "#0f172a",
            "secondaryText": "#64748b",
        },
        "dark": {
            "background": "#0a0a0f",
            "primaryText": "#f0f0f5",
            "secondaryText": "#8888a0",
        },
    }.get(theme, {
        "background": "#0a0a0f",
        "primaryText": "#f0f0f5",
        "secondaryText": "#8888a0",
    })

    image_guidance = ""
    if source_image_base64 and source_image_mime_type:
        image_guidance = """
REFERENCE IMAGE: A source image is attached. Use it ONLY as a loose visual reference for layout inspiration. Do NOT copy text, labels, or values from the image. The JSON data below is the ONLY source of truth for all numbers and labels."""

    prompt = f"""You are an expert data visualization designer. Create a clean, polished SVG infographic.

STRICT RULES:
1. Use FLAT 2D design only. No 3D effects, no isometric perspective, no skewing, no perspective transforms.
2. The title "{title or 'Data Visualization'}" must appear EXACTLY ONCE at the top of the SVG. Do not repeat it.
3. Every data value from the JSON must be represented accurately. Do not invent or omit data.
4. All text must be horizontal and legible (minimum 14px for labels, 20px for title).
5. Use clean geometric shapes: rectangles, circles, arcs, lines. No organic/blob shapes.
6. Fixed viewBox="0 0 1600 1200". The SVG must be self-contained with no external dependencies.
7. Use font-family 'Manrope', sans-serif for ALL text elements.

LAYOUT GUIDELINES:
- Title at top (28-36px, bold, color: {theme_colors["primaryText"]})
- Clear visual hierarchy: title > data values > labels > secondary info
- Use one of these layouts: horizontal bars, vertical bars, donut/ring chart, proportional circles, icon array, or grid cards
- Include a subtle legend if there are multiple series
- Add adequate spacing between elements (no cramped layouts)

COLOR PALETTE (use these exact colors in order):
{chr(10).join(f"  {i + 1}. {c}" for i, c in enumerate(colors))}

THEME: {theme.upper()} MODE
- Background: {theme_colors["background"]}
- Primary text: {theme_colors["primaryText"]}
- Secondary text: {theme_colors["secondaryText"]}
- Use the palette colors above for data elements (bars, segments, circles, etc.)
- Subtle gradients within palette colors are OK, but keep them flat (no 3D shading)
{image_guidance}

DATA (use this as the ONLY source of truth):
{data_json}

Return ONLY valid SVG code. No markdown, no explanation, no code blocks. Start with <svg and end with </svg>."""

    if source_image_base64 and source_image_mime_type:
        response = model.generate_content([
            prompt,
            {
                "mime_type": source_image_mime_type,
                "data": source_image_base64,
            },
        ])
    else:
        response = model.generate_content(prompt)
    content = response.text

    if not content:
        raise ValueError("No response from AI")

    # Clean up the response - remove any markdown code blocks
    svg = content.replace("```svg\n", "").replace("```xml\n", "").replace("```html\n", "").replace("\n```", "").replace("```", "").strip()

    # Ensure it starts with <svg
    if not svg.startswith("<svg"):
        svg_start = svg.find("<svg")
        if svg_start != -1:
            svg = svg[svg_start:]
        else:
            raise ValueError("Invalid SVG response")

    # Ensure it ends with </svg>
    svg_end = svg.rfind("</svg>")
    if svg_end != -1:
        svg = svg[: svg_end + 6]

    return svg
