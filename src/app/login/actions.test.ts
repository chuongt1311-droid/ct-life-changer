import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('verifyOtpCode', () => {
  it('exchanges the code for a session by matching it against OWNER_EMAIL, not a cookie', async () => {
    process.env.OWNER_EMAIL = 'ct@example.com';
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/lib/supabase/server', () => ({
      createServerSupabase: async () => ({ auth: { verifyOtp } }),
    }));
    const { verifyOtpCode } = await import('./actions');

    const result = await verifyOtpCode('123456');

    expect(result).toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'ct@example.com', token: '123456', type: 'email' });
  });

  it('reports the error a wrong or expired code produces, instead of throwing', async () => {
    process.env.OWNER_EMAIL = 'ct@example.com';
    vi.doMock('@/lib/supabase/server', () => ({
      createServerSupabase: async () => ({
        auth: { verifyOtp: vi.fn().mockResolvedValue({ error: { message: 'Token has expired or is invalid' } }) },
      }),
    }));
    const { verifyOtpCode } = await import('./actions');

    const result = await verifyOtpCode('000000');

    expect(result).toEqual({ ok: false, error: 'Token has expired or is invalid' });
  });

  it('refuses to run when OWNER_EMAIL is not configured, rather than verifying against no one', async () => {
    delete process.env.OWNER_EMAIL;
    const { verifyOtpCode } = await import('./actions');

    const result = await verifyOtpCode('123456');

    expect(result).toEqual({ ok: false, error: 'OWNER_EMAIL is not configured' });
  });
});
