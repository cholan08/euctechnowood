import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LEAD_STATUSES, type AdminLead, type LeadStatus } from '../../shared/types';
import { ApiError } from '../api/client';
import { getLeads, getSession, login, logout, setLeadStatus } from '../api/admin';

type Filter = 'all' | LeadStatus;

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getSession()
      .then((s) => setSignedIn(s.signedIn))
      .catch(() => setSignedIn(false));
  }, []);

  if (signedIn === null) return null;
  return signedIn ? <Leads onSignOut={() => setSignedIn(false)} /> : <Login onSignedIn={() => setSignedIn(true)} />;
}

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login container" onSubmit={submit}>
      <h1 style={{ fontSize: 26 }}>Team login</h1>
      <p className="muted">Sign in to see quote requests from customers.</p>
      <label className="field">
        <span>Password</span>
        <input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
        Sign in
      </button>
    </form>
  );
}

function Leads({ onSignOut }: { onSignOut: () => void }) {
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLeads((await getLeads()).leads);
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSignOut();
      else setError(err instanceof Error ? err.message : 'Could not load leads.');
    }
  }, [onSignOut]);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 20_000); // pick up new requests while the page is open
    return () => clearInterval(timer);
  }, [load]);

  async function changeStatus(lead: AdminLead, status: LeadStatus) {
    setLeads((all) => all?.map((l) => (l.id === lead.id ? { ...l, status } : l)) ?? null);
    try {
      await setLeadStatus(lead.id, status);
    } catch {
      void load(); // roll back to the server's value
    }
  }

  const counts = (s: Filter) => (s === 'all' ? leads?.length : leads?.filter((l) => l.status === s).length) ?? 0;
  const shown = leads?.filter((l) => filter === 'all' || l.status === filter) ?? [];

  return (
    <div className="admin container">
      <div className="admin-head">
        <h1>Quote requests</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-sm" href="/api/admin/leads.csv">
            Export CSV
          </a>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await logout();
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="stats">
        {(['all', ...LEAD_STATUSES] as Filter[]).map((s) => (
          <button key={s} type="button" className="stat" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            <strong>{counts(s)}</strong>
            <span>{s === 'all' ? 'All requests' : s}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {leads && shown.length === 0 && (
        <div className="empty-state">
          <p>{leads.length === 0 ? 'No quote requests yet. They appear here as customers submit them.' : 'No requests with this status.'}</p>
        </div>
      )}

      <div className="lead-list">
        {shown.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onStatus={(s) => changeStatus(lead, s)} />
        ))}
      </div>
    </div>
  );
}

const whatsappLink = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`;

function LeadCard({ lead, onStatus }: { lead: AdminLead; onStatus: (s: LeadStatus) => void }) {
  const when = new Date(lead.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <article className="lead">
      {lead.design ? (
        <div className="lead-images">
          <a href={lead.design.beforeUrl} target="_blank" rel="noreferrer">
            <img src={lead.design.beforeUrl} alt="Customer's original photo" loading="lazy" />
            <span>Before</span>
          </a>
          <a href={lead.design.afterUrl} target="_blank" rel="noreferrer">
            <img src={lead.design.afterUrl} alt="Chosen design" loading="lazy" />
            <span>After</span>
          </a>
        </div>
      ) : (
        <div className="muted">No design attached</div>
      )}

      <div className="lead-body">
        <div className="lead-top">
          <div>
            <h3>{lead.name}</h3>
            <small>
              {when}
              {lead.city && ` · ${lead.city}`}
            </small>
          </div>
          <select
            className={`status-select status-${lead.status}`}
            value={lead.status}
            onChange={(e) => onStatus(e.target.value as LeadStatus)}
            aria-label={`Status for ${lead.name}`}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="lead-contact">
          <a className="btn btn-sm" href={`tel:${lead.phone}`}>
            Call {lead.phone}
          </a>
          <a className="btn btn-sm" href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          {lead.email && (
            <a className="btn btn-sm" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
          )}
        </div>

        {lead.design && (
          <p className="lead-design">
            <strong>{lead.design.label} design</strong> · {lead.design.summary}
          </p>
        )}
        {lead.message && <p className="lead-note">“{lead.message}”</p>}
      </div>
    </article>
  );
}
