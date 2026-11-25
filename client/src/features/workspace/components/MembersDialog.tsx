import { useEffect, useState } from 'react';
import type { Access, Project, User } from '@shared/workspace';
import { projects, team } from '../../../api/workspace';
import { Dialog } from '../../../components/ui/Dialog';
import { errorText } from './common';

/** Who works on a project: everyone can view; the owner, admins and people given "Can edit" change it. */
export function MembersDialog({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const [people, setPeople] = useState<User[]>([]);
  const [access, setAccess] = useState<Record<string, Access | ''>>(Object.fromEntries(project.members.map((m) => [m.userId, m.access])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    team
      .directory()
      .then(setPeople)
      .catch((err: unknown) => setError(errorText(err)));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const members = Object.entries(access)
        .filter((e): e is [string, Access] => Boolean(e[1]))
        .map(([userId, a]) => ({ userId, access: a }));
      onSaved(await projects.setMembers(project.id, { members }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title="Project team" onClose={onClose}>
      <p className="dialog-note">Everyone at EUC can see this project. Choose who else may change it. Admins can always change every project.</p>
      <ul className="members">
        {people.map((u) => {
          const owner = u.id === project.ownerId;
          return (
            <li key={u.id}>
              <span>
                <strong>{u.name}</strong>
                <small>
                  {u.email} · {u.role}
                </small>
              </span>
              {owner ? (
                <span className="role-chip">Owner</span>
              ) : u.role === 'admin' ? (
                <span className="role-chip role-admin">Admin</span>
              ) : (
                <select value={access[u.id] ?? ''} onChange={(e) => setAccess({ ...access, [u.id]: e.target.value as Access | '' })} aria-label={`Access for ${u.name}`}>
                  <option value="">Can view</option>
                  {u.role !== 'viewer' && <option value="edit">Can edit</option>}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-accent" onClick={save} disabled={busy}>
          Save team
        </button>
      </div>
    </Dialog>
  );
}
