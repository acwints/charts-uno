import os
from dataclasses import dataclass


DEFAULT_GEMINI_FAST_MODEL = "gemini-3.5-flash"
DEFAULT_GEMINI_PRO_MODEL = "gemini-3.1-pro-preview"


def _env_model(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


@dataclass(frozen=True)
class ModelConfig:
    fast: str
    pro: str
    chart: str
    research: str
    sql: str
    stock_insight: str
    vision: str


def get_model_config() -> ModelConfig:
    """Resolve model names once from env with stable production defaults."""
    fast = _env_model("CHARTSUNO_MODEL_FAST", DEFAULT_GEMINI_FAST_MODEL)
    pro = _env_model("CHARTSUNO_MODEL_PRO", DEFAULT_GEMINI_PRO_MODEL)

    return ModelConfig(
        fast=fast,
        pro=pro,
        chart=_env_model("CHARTSUNO_MODEL_CHART", fast),
        research=_env_model("CHARTSUNO_MODEL_RESEARCH", fast),
        sql=_env_model("CHARTSUNO_MODEL_SQL", fast),
        stock_insight=_env_model("CHARTSUNO_MODEL_STOCK_INSIGHT", fast),
        vision=_env_model("CHARTSUNO_MODEL_VISION", pro),
    )


MODEL_CONFIG = get_model_config()
MODEL_FAST = MODEL_CONFIG.fast
MODEL_PRO = MODEL_CONFIG.pro
MODEL_CHART = MODEL_CONFIG.chart
MODEL_RESEARCH = MODEL_CONFIG.research
MODEL_SQL = MODEL_CONFIG.sql
MODEL_STOCK_INSIGHT = MODEL_CONFIG.stock_insight
MODEL_VISION = MODEL_CONFIG.vision
