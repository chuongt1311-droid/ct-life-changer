/** Spec §11: a backup that works even when Claude is capped or unavailable.
 * Deliberately narrow — false negatives (missing a real crisis mention) are
 * far better tolerated here than false positives (the model's own judgment
 * in the system prompt is the primary signal; this is the net underneath). */
const CRISIS_PATTERNS = [
  /\bsuicid\w*/i,
  /\bself[\s-]?harm\w*/i,
  /\bkill(ing)?\s+myself\b/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bhurt(ing)?\s+myself\b/i,
];

/** Pure. Checks every string in `texts` against a fixed keyword/phrase list. */
export function checkCrisisKeywords(texts: string[]): boolean {
  return texts.some((text) => CRISIS_PATTERNS.some((pattern) => pattern.test(text)));
}
