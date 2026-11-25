import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { Role, User } from '@shared/workspace';
import { AppError } from '../lib/errors';
import type { AuthService } from '../modules/auth/auth.service';

// Who is asking. `authenticate` reads the session cookie on every request and
// sets req.user; `requireUser` and `requireRole` refuse requests without the
// right person. Only the login and health routes are open.

export interface SessionUser extends User {
  dailyLimit: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const SESSION_COOKIE = 'rs_session';

export function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

export function cookieOptions(secure: boolean, maxAgeMs: number): CookieOptions {
  // Lax: sent on normal navigation to the studio, never on cross-site POSTs.
  return { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: maxAgeMs };
}

export function setSessionCookie(res: Response, token: string, secure: boolean, maxAgeMs: number) {
  res.cookie(SESSION_COOKIE, token, cookieOptions(secure, maxAgeMs));
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(secure, 0), maxAge: undefined });
}

export function authenticate(auth: AuthService): RequestHandler {
  return (req, _res, next) => {
    const user = auth.lookup(readCookie(req, SESSION_COOKIE));
    if (user) req.user = user;
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new AppError(401, 'Please sign in.');
  next();
};

/** Allows only the given roles (after requireUser). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'Please sign in.');
    if (!roles.includes(req.user.role)) throw new AppError(403, 'Your account cannot do this. Ask an admin.');
    next();
  };
}

/** The signed-in user; only call behind requireUser. */
export const userOf = (req: Request): SessionUser => {
  if (!req.user) throw new AppError(401, 'Please sign in.');
  return req.user;
};
