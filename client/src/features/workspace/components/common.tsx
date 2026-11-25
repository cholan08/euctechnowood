import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PROJECT_STATUSES, imageUrl, type ProjectStatus, type ProjectSummary } from '@shared/workspace';
import { Icon } from '../../../components/ui/Icon';

export const statusLabel = (s: ProjectStatus) => PROJECT_STATUSES.find((p) => p.id === s)?.label ?? s;

export function StatusChip({ status }: { status: ProjectStatus }) {
  return <span className={`status-chip st-${status}`}>{statusLabel(status)}</span>;
}

/** "5 min ago", "Yesterday", "12 Nov" */
export function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link to={`/projects/${p.id}`} className="card project-card">
      <div className="card-thumb">
        {p.coverImageId ? <img src={imageUrl(p.coverImageId)} alt="" loading="lazy" /> : <Icon name="photo" size={28} />}
        <StatusChip status={p.status} />
      </div>
      <div className="card-body">
        <strong>{p.name}</strong>
        <span>{p.clientName}</span>
        <span className="card-meta">
          {plural(p.roomCount, 'room')} · {p.ownerName ?? 'No owner'} · {ago(p.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

/** A page under the app bar: scrolls on its own, so the app keeps one screen on desktop. */
export function Page({ title, eyebrow, actions, children, back }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; back?: { to: string; label: string } }) {
  return (
    <main className="page">
      <div className="page-inner">
        {back && (
          <Link to={back.to} className="back-link">
            <Icon name="back" size={14} /> {back.label}
          </Link>
        )}
        <div className="page-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function Empty({ icon, title, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p className="alert alert-error" role="alert">
      <Icon name="alert" size={16} />
      {error}
    </p>
  );
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** Loads data for a page; `reload` fetches again after a change. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string; loading: boolean; reload: () => void; setData: (d: T) => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    load()
      .then((d) => {
        if (!live) return;
        setData(d);
        setError('');
      })
      .catch((err: unknown) => live && setError(errorText(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}
