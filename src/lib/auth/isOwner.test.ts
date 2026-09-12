import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOwner } from './isOwner';

describe('isOwner', () => {
  beforeEach(() => {
    vi.stubEnv('OWNER_EMAIL', 'ct@example.com');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the exact OWNER_EMAIL', () => {
    expect(isOwner('ct@example.com')).toBe(true);
  });

  it('is case-insensitive (email providers normalize case)', () => {
    expect(isOwner('CT@Example.com')).toBe(true);
  });

  it('rejects any other email', () => {
    expect(isOwner('someone-else@example.com')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});
