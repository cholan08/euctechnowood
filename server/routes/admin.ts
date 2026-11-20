import { Router } from 'express';
import { LEAD_STATUSES, type LeadStatus } from '../../shared/types';
import { leads } from '../db/leads';
import { endAdminSession, isAdmin, passwordMatches, requireAdmin, startAdminSession } from '../middleware/adminAuth';
import { RateLimiter } from '../services/rateLimiter';

const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);

export const adminRouter = Router();

adminRouter.get('/admin/session', (req, res) => {
  res.json({ signedIn: isAdmin(req) });
});

adminRouter.post('/admin/login', (req, res) => {
  if (!loginLimiter.take(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!passwordMatches(password)) {
    res.status(401).json({ error: 'Wrong password.' });
    return;
  }
  startAdminSession(req, res);
  res.json({ signedIn: true });
});

adminRouter.post('/admin/logout', (_req, res) => {
  endAdminSession(res);
  res.json({ signedIn: false });
});

adminRouter.get('/admin/leads', requireAdmin, (_req, res) => {
  res.json({ leads: leads.list() });
});

adminRouter.patch('/admin/leads/:id', requireAdmin, (req, res) => {
  const status = req.body?.status as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Unknown status.' });
    return;
  }
  if (!leads.updateStatus(Number(req.params.id), status)) {
    res.status(404).json({ error: 'Lead not found.' });
    return;
  }
  res.json({ ok: true });
});

// Quoted so a name containing commas or newlines cannot break the columns.
const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

adminRouter.get('/admin/leads.csv', requireAdmin, (_req, res) => {
  const rows = leads.list().map((l) =>
    [l.id, l.createdAt, l.status, l.name, l.phone, l.email, l.city, l.message, l.design?.roomType ?? '', l.design?.summary ?? '']
      .map(cell)
      .join(','),
  );
  const header = 'id,created,status,name,phone,email,city,message,room,design';
  res.type('text/csv').attachment('euc-leads.csv').send([header, ...rows].join('\n'));
});

