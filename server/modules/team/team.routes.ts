import { Router, type Request } from 'express';
import { z } from 'zod';
import type { StaffMember, User } from '@shared/workspace';
import type { Db } from '../../db/database';
import { requireRole, requireUser, userOf } from '../../http/auth';
import { AppError } from '../../lib/errors';
import { hashPassword } from '../../lib/password';
import { parseBody } from '../../lib/validation';
import { checkNewPassword, type AuthService, type UserRow } from '../auth/auth.service';
import type { UsageService } from '../usage/usage.service';

/** The :id in the path. */
const idOf = (req: Request) => String(req.params.id);

// Team access: admins add staff, set their role and daily image limit, reset
// passwords and turn accounts off. Everyone signed in can read the directory
// (names and roles), to add colleagues to a project.

const role = z.enum(['admin', 'designer', 'viewer'], { error: 'Choose a role.' });
const limit = z.number().int().min(0).max(10_000).nullable();
const name = z.string().trim().min(1, 'Enter a name.').max(80);

const newStaffSchema = z.object({
  name,
  email: z.string().trim().email('Enter a valid email address.').max(200),
  role,
  password: z.string().max(200),
  dailyLimit: limit.optional(),
});

const updateStaffSchema = z.object({
  name: name.optional(),
  role: role.optional(),
  active: z.boolean().optional(),
  dailyLimit: limit.optional(),
  password: z.string().max(200).optional(),
});

interface Deps {
  db: Db;
  auth: AuthService;
  usage: UsageService;
}

export function teamRoutes({ db, auth, usage }: Deps): Router {
  const router = Router();

  const toStaff = (r: UserRow): StaffMember => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    active: Boolean(r.active),
    dailyLimit: r.daily_limit,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
    usedToday: usage.usedToday(r.id),
  });

  const activeAdmins = () => db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")!.n;

  router.get('/team/directory', requireUser, (_req, res) => {
    res.json(db.all<User>('SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY name'));
  });

  router.get('/team', requireRole('admin'), (_req, res) => {
    res.json(db.all<UserRow>('SELECT * FROM users ORDER BY active DESC, name').map(toStaff));
  });

  router.post('/team', requireRole('admin'), async (req, res) => {
    const b = parseBody(newStaffSchema, req.body);
    const user = await auth.createUser({ ...b, dailyLimit: b.dailyLimit ?? null });
    res.status(201).json(toStaff(db.get<UserRow>('SELECT * FROM users WHERE id = ?', user.id)!));
  });

  router.patch('/team/:id', requireRole('admin'), async (req, res) => {
    const b = parseBody(updateStaffSchema, req.body);
    const row = db.get<UserRow>('SELECT * FROM users WHERE id = ?', idOf(req));
    if (!row) throw new AppError(404, 'That staff member was not found.');

    // The studio must always keep one admin who can sign in.
    const losesAdmin = row.role === 'admin' && row.active && ((b.role && b.role !== 'admin') || b.active === false);
    if (losesAdmin && activeAdmins() <= 1) throw new AppError(400, 'This is the only admin. Make someone else an admin first.');
    if (row.id === userOf(req).id && b.active === false) throw new AppError(400, 'You cannot turn off your own account.');

    if (b.password !== undefined) checkNewPassword(b.password);
    db.tx(() => {
      if (b.name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', b.name, row.id);
      if (b.role !== undefined) db.run('UPDATE users SET role = ? WHERE id = ?', b.role, row.id);
      if (b.active !== undefined) db.run('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, row.id);
      if (b.dailyLimit !== undefined) db.run('UPDATE users SET daily_limit = ? WHERE id = ?', b.dailyLimit, row.id);
    });
    if (b.password !== undefined) db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(b.password), row.id);
    // A new password or a turned-off account signs the person out everywhere.
    if (b.password !== undefined || b.active === false) auth.endSessions(row.id);

    res.json(toStaff(db.get<UserRow>('SELECT * FROM users WHERE id = ?', row.id)!));
  });

  router.get('/usage', requireRole('admin'), (_req, res) => {
    res.json(usage.summary());
  });

  return router;
}
