import type { Block } from '@/core/types';
import type { BlockRow } from './schemas';

/** DB row → core `Block`. Extracted from the Today page (Plan 5) so the
 * nudge-assembly layer (Plan 6) can reuse the exact same mapping. */
export function blockRowToCore(row: BlockRow): Block {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    anchor: row.anchor,
    priority: row.priority,
    start: row.start,
    end: row.end,
    minMinutes: row.min_minutes,
    window: row.window_start !== null && row.window_end !== null ? { earliestStart: row.window_start, latestEnd: row.window_end } : null,
    tags: row.tags,
    checklist: row.checklist,
    recoveryVariant: row.recovery_variant,
    status: row.status,
    source: row.source,
  };
}
