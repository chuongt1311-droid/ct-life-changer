import { describe, expect, it, vi } from 'vitest';
import { requireBearerToken } from './auth.js';

function fakeReqRes(header?: string) {
  const req = { headers: { authorization: header } } as never;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as never;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireBearerToken', () => {
  it('calls next() when the token matches', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes('Bearer secret123');
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 with no detail when the token is missing', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes(undefined);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as never as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when the token is wrong', () => {
    const middleware = requireBearerToken('secret123');
    const { req, res, next } = fakeReqRes('Bearer wrong');
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as never as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(401);
  });
});
