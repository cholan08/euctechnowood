import { db } from './database';

export interface DesignRow {
  id: string;
  roomType: string;
  label: string;
  summary: string;
  prompt: string;
  provider: string;
  beforeFile: string;
  afterFile: string;
}

const insert = db.prepare(
  `INSERT INTO designs (id, room_type, label, summary, prompt, provider, before_file, after_file)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const exists = db.prepare('SELECT 1 AS ok FROM designs WHERE id = ?');

export const designs = {
  create(d: DesignRow): void {
    insert.run(d.id, d.roomType, d.label, d.summary, d.prompt, d.provider, d.beforeFile, d.afterFile);
  },
  exists(id: string): boolean {
    return Boolean(exists.get(id));
  },
};
