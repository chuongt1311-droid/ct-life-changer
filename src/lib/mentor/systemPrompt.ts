import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads the versioned mentor persona fresh on every call — cheap (one small
 * file) and means an edit to prompts/mentor.md takes effect without a
 * redeploy in dev, and is trivially correct after one in production. */
export function loadSystemPrompt(): string {
  return readFileSync(join(process.cwd(), 'prompts', 'mentor.md'), 'utf-8');
}
