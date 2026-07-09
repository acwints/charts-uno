export const DEFAULT_GEMINI_FAST_MODEL = 'gemini-3.5-flash';
export const DEFAULT_GEMINI_PRO_MODEL = 'gemini-3.1-pro-preview';

type ModelEnv = Partial<Record<string, string | undefined>>;

function readModel(env: ModelEnv, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value || fallback;
}

function defaultModelEnv(): ModelEnv {
  return typeof process === 'undefined' ? {} : process.env;
}

export interface ModelConfig {
  fast: string;
  pro: string;
  vision: string;
}

export function resolveModelConfig(env: ModelEnv = defaultModelEnv()): ModelConfig {
  const fast = readModel(env, 'CHARTSUNO_MODEL_FAST', DEFAULT_GEMINI_FAST_MODEL);
  const pro = readModel(env, 'CHARTSUNO_MODEL_PRO', DEFAULT_GEMINI_PRO_MODEL);

  return {
    fast,
    pro,
    vision: readModel(env, 'CHARTSUNO_MODEL_VISION', pro),
  };
}

export function resolveVisionModel(env: ModelEnv = defaultModelEnv()): string {
  return resolveModelConfig(env).vision;
}
