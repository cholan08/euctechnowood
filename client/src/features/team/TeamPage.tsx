import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ROLES, type Role, type StaffMember } from '@shared/workspace';
import { team } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { ErrorNote, Page, ago, errorText, useLoad } from '../workspace/components/common';

/** Admins: staff accounts and AI usage. */
export default function TeamPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'usage' ? 'usage' : 'staff';
  return (
    <Page eyebrow="Admin" title="Team">
      <div className="tabs page-tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'staff'} onClick={() => setParams({})}>
          Staff
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'usage'} onClick={() => setParams({ tab: 'usage' })}>
          Usage · last 30 days
        </button>
      </div>
      {tab === 'staff' ? <Staff /> : <Usage />}
    </Page>
  );
}

function Staff() {
  const { me } = useAuth();
  const { data, error, reload } = useLoad(() => team.list(), []);
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);

  return (
    <>
      <div className="filters">
        <p className="muted">Admins manage everything. Designers use the studio and edit their own projects and ones shared with them. Viewers only look.</p>
        <button type="button" className="btn btn-accent" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Add staff
        </button>
      </div>
      <ErrorNote error={error} />
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Images today</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'row-off'}>
                  <td>
                    <strong>{s.name}</strong>
                    {s.id === me?.user.id && <span className="you"> (you)</span>}
                    <small className="cell-sub">{s.email}</small>
                  </td>
                  <td>
                    <span className={`role-chip role-${s.role}`}>{s.role}</span>
                    {!s.active && <span className="role-chip">turned off</span>}
                  </td>
                  <td>{s.role === 'viewer' ? '—' : `${s.usedToday} / ${s.dailyLimit ?? 'default'}`}</td>
                  <td>{s.lastLoginAt ? ago(s.lastLoginAt) : 'never'}</td>
                  <td className="cell-actions">
                    <button type="button" className="link" onClick={() => setEditing(s)}>
                      <Icon name="pencil" size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <StaffDialog
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function StaffDialog({ member, onClose, onSaved }: { member: StaffMember | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [role, setRole] = useState<Role>(member?.role ?? 'designer');
  const [limit, setLimit] = useState(member?.dailyLimit?.toString() ?? '');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(member?.active ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const dailyLimit = limit.trim() === '' ? null : Number(limit);
    try {
      if (member) await team.update(member.id, { name, role, dailyLimit, active, ...(password ? { password } : {}) });
      else await team.add({ name, email, role, password, dailyLimit });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title={member ? `Edit ${member.name}` : 'Add staff'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label className="form-field">
          <span>Email (used to sign in)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={Boolean(member)} />
        </label>
        <div className="form-field">
          <span>Role</span>
          <div className="role-pick">
            {ROLES.map((r) => (
              <label key={r.id} className={role === r.id ? 'on' : ''}>
                <input type="radio" className="sr-only" name="role" checked={role === r.id} onChange={() => setRole(r.id)} />
                <strong>{r.label}</strong>
                <small>{r.description}</small>
              </label>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label className="form-field">
            <span>Images per day</span>
            <input type="number" min={0} max={10000} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Studio default" disabled={role === 'viewer'} />
          </label>
          <label className="form-field">
            <span>{member ? 'New password (to reset)' : 'Password'}</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required={!member} autoComplete="new-password" placeholder={member ? 'Leave empty to keep' : 'At least 10 characters'} />
          </label>
        </div>
        {member && (
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Account is on (turning it off signs them out everywhere)
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {member ? 'Save' : 'Add staff'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Usage() {
  const { data, error } = useLoad(() => team.usage(), []);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <div className="page-loading"><span className="spinner" /> Loading…</div>;
  const { totals, people, days } = data;
  const max = Math.max(1, ...days.map((d) => d.images));
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Images made</span>
          <strong>{totals.images}</strong>
        </div>
        <div className="stat">
          <span>AI calls</span>
          <strong>{totals.calls}</strong>
        </div>
        <div className="stat">
          <span>Failed</span>
          <strong>{totals.calls ? `${Math.round((totals.failed / totals.calls) * 100)}%` : '—'}</strong>
        </div>
        <div className="stat">
          <span>Average time</span>
          <strong>{totals.avgMs ? `${(totals.avgMs / 1000).toFixed(1)} s` : '—'}</strong>
        </div>
      </div>
      <div className="usage-grid">
        <section>
          <h2 className="section-title">By day</h2>
          {days.length ? (
            <ul className="bars">
              {days.map((d) => (
                <li key={d.day}>
                  <span>{new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="bar" style={{ width: `${(d.images / max) * 100}%` }} />
                  <b>{d.images}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No AI use yet.</p>
          )}
        </section>
        <section>
          <h2 className="section-title">By person</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Images</th>
                <th>Calls</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.userId ?? 'gone'}>
                  <td>{p.name}</td>
                  <td>{p.images}</td>
                  <td>{p.calls}</td>
                  <td>{p.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
