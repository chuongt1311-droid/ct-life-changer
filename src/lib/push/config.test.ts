import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVapidConfig } from './config';

describe('getVapidConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('throws a helpful error when a var is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    vi.stubEnv('VAPID_SUBJECT', '');
    expect(() => getVapidConfig()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('returns the three values when all are set', () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:ct@example.com');
    expect(getVapidConfig()).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ct@example.com' });
  });
});
