'use client';

import { useMemo } from 'react';
import { checkCrisisKeywords } from '@/core/mentor/crisis';

/** Re-checks whenever `texts` changes. Every free-text field this plan adds
 * (check-in textareas, the mentor chat composer) feeds its current value in
 * here — independent of whether a completed Claude call also set `crisis: true`. */
export function useCrisisCheck(texts: string[]): boolean {
  return useMemo(() => checkCrisisKeywords(texts.filter((t) => t.trim().length > 0)), [texts]);
}
