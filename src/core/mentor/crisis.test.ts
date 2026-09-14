import { describe, expect, it } from 'vitest';
import { checkCrisisKeywords } from './crisis';

describe('checkCrisisKeywords', () => {
  it('flags a direct mention of suicide', () => {
    expect(checkCrisisKeywords(['I keep thinking about suicide'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkCrisisKeywords(['SELF HARM again tonight'])).toBe(true);
  });

  it('checks every string in the array, not just the first', () => {
    expect(checkCrisisKeywords(['fine', 'training went ok', 'want to end it all'])).toBe(true);
  });

  it('returns false for ordinary hard-day text', () => {
    expect(checkCrisisKeywords(['rough day, stressed about school', 'tired'])).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(checkCrisisKeywords([])).toBe(false);
  });

  it('does not false-positive on an unrelated substring', () => {
    // "kill" appears in "overkill" — must not trigger on substrings inside
    // an unrelated word.
    expect(checkCrisisKeywords(['that training was overkill honestly'])).toBe(false);
  });
});
