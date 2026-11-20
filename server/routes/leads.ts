import { Router } from 'express';
import type { QuoteRequest } from '../../shared/types';
import { config } from '../config';
import { designs } from '../db/designs';
import { leads } from '../db/leads';
import { RateLimiter } from '../services/rateLimiter';

const limiter = new RateLimiter(config.leadsPerHour, 60 * 60 * 1000);

export const leadsRouter = Router();

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

leadsRouter.post('/leads', (req, res) => {
  if (!limiter.take(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  const body = (req.body ?? {}) as Partial<QuoteRequest>;
  const name = clean(body.name, 80);
  const phone = clean(body.phone, 20).replace(/[\s-]/g, '');
  const email = clean(body.email, 120);
  const city = clean(body.city, 60);
  const message = clean(body.message, 500);
  const designId = clean(body.designId, 64);

  if (name.length < 2) return void res.status(400).json({ error: 'Please enter your name.' });
  // Indian mobile: 10 digits starting 6-9, optional +91 / 0 prefix.
  if (!/^(?:\+?91|0)?[6-9]\d{9}$/.test(phone)) {
    return void res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return void res.status(400).json({ error: 'That email address does not look right.' });
  }
  if (designId && !designs.exists(designId)) {
    return void res.status(400).json({ error: 'That design could not be found. Please generate it again.' });
  }

  const id = leads.create({ designId: designId || null, name, phone, email, city, message });
  res.status(201).json({ ok: true, id });
});
