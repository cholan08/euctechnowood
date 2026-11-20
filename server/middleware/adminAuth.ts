import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

const COOKIE = 'euc_admin';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const sign = (value: string) => createHmac('sha256', config.sessionSecret).update(value).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const passwordMatches = (password: string) => safeEqual(password, config.adminPassword);

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function isAdmin(req: Request): boolean {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(expires));
}

export function startAdminSession(req: Request, res: Response): void {
  const expires = String(Date.now() + MAX_AGE_MS);
  res.cookie(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: MAX_AGE_MS,
    path: '/api/admin',
  });
}

export function endAdminSession(res: Response): void {
  res.clearCookie(COOKIE, { path: '/api/admin' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  next();
}
