# AI Models and Evals

Chartsuno keeps current Gemini defaults in production, but model names can be overridden per task without editing AI call sites.

## Model Environment Variables

- `CHARTSUNO_MODEL_FAST`: base fast model defaulting to `gemini-3.5-flash`.
- `CHARTSUNO_MODEL_PRO`: base pro model defaulting to `gemini-3.1-pro-preview`.
- `CHARTSUNO_MODEL_CHART`: prompt-to-chart generation model. Defaults to `CHARTSUNO_MODEL_FAST`.
- `CHARTSUNO_MODEL_RESEARCH`: research intent and query drafting model. Defaults to `CHARTSUNO_MODEL_FAST`.
- `CHARTSUNO_MODEL_SQL`: public dataset SQL drafting model. Defaults to `CHARTSUNO_MODEL_FAST`.
- `CHARTSUNO_MODEL_STOCK_INSIGHT`: stock insight summary model. Defaults to `CHARTSUNO_MODEL_FAST`.
- `CHARTSUNO_MODEL_VISION`: image/chart extraction model. Defaults to `CHARTSUNO_MODEL_PRO`.

## Research Providers

Prompt generation checks structured providers first (FRED and enabled BigQuery public datasets), then uses Gemini Google Search grounding for fact-seeking public-web prompts. Grounded results must include at least one source URL before they are marked `verifiedData: true`; the API returns both the legacy primary `sourceLink` and a deduplicated `sources` list for attribution.

Temporal fields are dimensions rather than metrics. A returned Year series is deterministically promoted to `labels`, the chart is marked `xAxisType: "year"`, and aligned text such as winner names is retained in `categoricalColumns`.

## Eval Commands

```bash
pnpm eval:charts
```

Validates the fixture set shape without making model calls.

```bash
GOOGLE_API_KEY=... pnpm eval:charts:live
```

Runs the same fixtures through live prompt-based chart generation and validates the returned chart shape.
