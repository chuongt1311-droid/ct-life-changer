import type Anthropic from '@anthropic-ai/sdk';
import { capStatus, type CapStatus, computeCostUsd, type UsageTokens } from '@/core/mentor/cost';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { UsageRow } from '@/lib/db/schemas';
import type { Route } from '@/core/mentor/fallback';

/** Maps the Anthropic SDK's snake_case usage fields to our UsageTokens. */
export function extractUsage(message: Anthropic.Message): UsageTokens {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export interface RecordUsageParams {
  ownerId: string;
  route: Route;
  model: string;
  usage: UsageTokens;
}

/** Spec §8.5: every call writes a usage row with the computed cost. */
export async function recordUsage(client: RepositoryClient, params: RecordUsageParams): Promise<UsageRow> {
  const costUsd = computeCostUsd(params.model, params.usage);
  return repositories(client).usage.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    created_at: new Date().toISOString(),
    route: params.route,
    model: params.model,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    cache_read_tokens: params.usage.cacheReadTokens,
    cache_write_tokens: params.usage.cacheWriteTokens,
    cost_usd: costUsd,
  });
}

/** Spec §8.5: before each call, check month-to-date spend against the cap.
 * "Month" is the calendar month of `now` in UTC — good enough for a single
 * user's own cap check; the exact timezone boundary doesn't matter here the
 * way it does for the plan-day clock. */
export async function checkCap(client: RepositoryClient, ownerId: string, monthlyCapUsd: number, now: Date): Promise<CapStatus> {
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const rows = await repositories(client).usage.list({ owner_id: ownerId });
  const spentUsd = rows.filter((r) => r.created_at.startsWith(monthStart)).reduce((sum, r) => sum + r.cost_usd, 0);
  return capStatus(spentUsd, monthlyCapUsd);
}
