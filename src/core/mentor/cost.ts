export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** USD per million tokens. Verify against current Anthropic pricing in Plan 4 (spec §15). */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function computeCostUsd(model: string, usage: UsageTokens): number {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`No price configured for model "${model}"`);
  const cost =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface CapStatus {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  over: boolean;
}

/** Spec §8.5: at or past the cap, the mentor pauses. */
export function capStatus(spentUsd: number, capUsd: number): CapStatus {
  return {
    spentUsd,
    capUsd,
    remainingUsd: Math.max(0, capUsd - spentUsd),
    over: spentUsd >= capUsd,
  };
}
