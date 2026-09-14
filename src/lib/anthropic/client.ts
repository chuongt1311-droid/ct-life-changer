import Anthropic from '@anthropic-ai/sdk';

/** Reads ANTHROPIC_API_KEY from the environment — Claude never sees this
 * value; CT pastes it into .env.local and Vercel themselves. */
export function createAnthropicClient(): Anthropic {
  return new Anthropic();
}
