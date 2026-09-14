import { describe, expect, it } from 'vitest';
import { loadSystemPrompt } from './systemPrompt';

describe('loadSystemPrompt', () => {
  it('returns the full mentor persona, including the crisis instructions', () => {
    const prompt = loadSystemPrompt();
    expect(prompt).toContain('Voice by state');
    expect(prompt).toContain('leave coaching mode immediately');
    expect(prompt).toContain('No shame language');
  });
});
