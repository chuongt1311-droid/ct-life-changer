import type { NextFunction, Request, Response } from 'express';

/** Bearer-token auth for every route except /health. A missing or wrong
 * token gets a plain 401 with no detail — never leak whether the header
 * was malformed vs. the token was simply wrong. */
export function requireBearerToken(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header === `Bearer ${token}`) {
      next();
      return;
    }
    res.status(401).json({ error: 'unauthorized' });
  };
}
