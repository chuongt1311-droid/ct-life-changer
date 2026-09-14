import { config } from 'dotenv';
config({ path: '.env.local' });

import { buildMentorContext } from '../src/core/mentor/context';
import { MENTOR_FIXTURE_DAYS } from '../src/core/testing/mentorFixtures';
import { loadSystemPrompt } from '../src/lib/mentor/systemPrompt';
import { createAnthropicClient } from '../src/lib/anthropic/client';

/** Spec §13's manual tone check. Run this yourself once ANTHROPIC_API_KEY is
 * in .env.local — it makes one real, billed API call per GuardState (4
 * calls total, ~$0.01-0.05 depending on the model). Reads each response and
 * confirms the voice actually shifts: ready should push, depleted should
 * protect, grinding should insist on rest. */
async function main() {
  const anthropic = createAnthropicClient();
  const systemPrompt = loadSystemPrompt();

  for (const [state, fixture] of Object.entries(MENTOR_FIXTURE_DAYS)) {
    const ctx = buildMentorContext({ ...fixture, systemPrompt });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    console.log(`\n=== ${state} ===`);
    console.log(textBlock && 'text' in textBlock ? textBlock.text : '(no text block returned)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
