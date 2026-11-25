import { Router } from 'express';
import { z } from 'zod';
import type { MeResponse } from '@shared/workspace';
import { clearSessionCookie, readCookie, requireUser, SESSION_COOKIE, setSessionCookie, userOf, type SessionUser } from '../../http/auth';
import { AppError } from '../../lib/errors';
import { RateLimiter } from '../../lib/rateLimiter';
import { parseBody } from '../../lib/validation';
import type { UsageService } from '../usage/usage.service';
import type { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string({ error: 'Enter your email.' }).trim().min(3, 'Enter your email.').max(200),
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(200),
});

const passwordSchema = z.object({
  current: z.string().min(1, 'Enter your current password.').max(200),
  next: z.string().max(200),
});

interface Deps {
  auth: AuthService;
  usage: UsageService;
  secureCookies: boolean;
}

export function authRoutes({ auth, usage, secureCookies }: Deps): Router {
  const router = Router();
  // Guessing passwords: 10 failed tries per 15 minutes for each address and each email.
  const attempts = new RateLimiter(10, 15 * 60 * 1000);

  const me = (user: SessionUser): MeResponse => {
    const dailyLimit = usage.limitFor(user);
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, dailyLimit, imagesLeft: Math.max(0, dailyLimit - usage.usedToday(user.id)) };
  };

  router.post('/auth/login', async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const keys = [`ip:${req.ip}`, `email:${email.toLowerCase()}`];
    if (keys.some((k) => attempts.isFull(k))) throw new AppError(429, 'Too many failed sign-in attempts. Wait 15 minutes and try again.');
    let result;
    try {
      result = await auth.login(email, password);
    } catch (err) {
      // Only failed attempts count, so a busy office signing in is never locked out.
      if (err instanceof AppError && err.status === 401) keys.forEach((k) => attempts.take(k));
      throw err;
    }
    const { user, token } = result;
    setSessionCookie(res, token, secureCookies, auth.idleMs);
    res.json(me({ ...user, dailyLimit: auth.lookup(token)?.dailyLimit ?? null }));
  });

  router.post('/auth/logout', (req, res) => {
    auth.logout(readCookie(req, SESSION_COOKIE));
    clearSessionCookie(res, secureCookies);
    res.json({ ok: true });
  });

  router.get('/auth/me', requireUser, (req, res) => {
    res.json(me(userOf(req)));
  });

  router.post('/auth/password', requireUser, async (req, res) => {
    const { current, next } = parseBody(passwordSchema, req.body);
    await auth.changePassword(userOf(req).id, current, next);
    res.json({ ok: true });
  });

  return router;
}
