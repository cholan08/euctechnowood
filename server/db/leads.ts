import type { AdminLead, LeadStatus } from '../../shared/types';
import { db } from './database';

export interface NewLead {
  designId: string | null;
  name: string;
  phone: string;
  email: string;
  city: string;
  message: string;
}

const insert = db.prepare(
  'INSERT INTO leads (design_id, name, phone, email, city, message) VALUES (?, ?, ?, ?, ?, ?)',
);

const listQuery = db.prepare(`
  SELECT l.id, l.name, l.phone, l.email, l.city, l.message, l.status, l.created_at AS createdAt,
         d.label AS designLabel, d.room_type AS roomType, d.summary AS summary,
         d.before_file AS beforeFile, d.after_file AS afterFile
  FROM leads l LEFT JOIN designs d ON d.id = l.design_id
  ORDER BY l.id DESC
`);

const setStatus = db.prepare('UPDATE leads SET status = ? WHERE id = ?');

interface Row {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  message: string;
  status: LeadStatus;
  createdAt: string;
  designLabel: string | null;
  roomType: string | null;
  summary: string | null;
  beforeFile: string | null;
  afterFile: string | null;
}

export const leads = {
  create(l: NewLead): number {
    const result = insert.run(l.designId, l.name, l.phone, l.email, l.city, l.message);
    return Number(result.lastInsertRowid);
  },

  list(): AdminLead[] {
    return (listQuery.all() as unknown as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      city: r.city,
      message: r.message,
      status: r.status,
      // SQLite stores UTC without a zone marker; add it so browsers parse it correctly.
      createdAt: `${r.createdAt.replace(' ', 'T')}Z`,
      design: r.afterFile
        ? {
            label: r.designLabel ?? '',
            roomType: r.roomType ?? '',
            summary: r.summary ?? '',
            beforeUrl: `/uploads/${r.beforeFile}`,
            afterUrl: `/uploads/${r.afterFile}`,
          }
        : null,
    }));
  },

  updateStatus(id: number, status: LeadStatus): boolean {
    return setStatus.run(status, id).changes > 0;
  },
};
