export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
}

export const PRICING_MAP: Record<string, ModelPricing> = {
  // OpenAI Models
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
  "gpt-4o": {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
  },
  // DeepSeek Models (V4 Flash and Pro)
  "deepseek-v4-flash": {
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
    cachedInputPerMillion: 0.0028,
  },
  "deepseek-v4-pro": {
    inputPerMillion: 0.435,
    outputPerMillion: 0.87,
    cachedInputPerMillion: 0.003625,
  },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0
): number {
  // Normalize model name or fallback to a cheap default
  const key = Object.keys(PRICING_MAP).find((k) => model.toLowerCase().includes(k)) || "gpt-4o-mini";
  const pricing = PRICING_MAP[key];

  const cachedInputCost = pricing.cachedInputPerMillion
    ? (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion
    : 0;

  const normalInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const normalInputCost = (normalInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return normalInputCost + cachedInputCost + outputCost;
}
