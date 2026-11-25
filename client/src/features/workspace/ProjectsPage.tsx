import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECT_STATUSES } from '@shared/workspace';
import { projects } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/ui/Icon';
import { Empty, ErrorNote, Page, ProjectCard, useLoad } from './components/common';
import { ProjectDialog } from './components/ProjectDialog';

/** Home: every project, newest activity first, with search and filters. */
export default function ProjectsPage() {
  const { me, canWork } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, error, loading } = useLoad(() => projects.list({ q: q.trim(), status, mine }), [q, status, mine]);

  return (
    <Page
      eyebrow={`Welcome, ${me?.user.name.split(' ')[0] ?? ''}`}
      title="Projects"
      actions={
        canWork && (
          <button type="button" className="btn btn-accent" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> New project
          </button>
        )
      }
    >
      <div className="filters">
        <label className="search">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects or clients" aria-label="Search projects or clients" />
        </label>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Status">
          {[{ id: 'open', label: 'Open' }, ...PROJECT_STATUSES, { id: '', label: 'All' }].map((s) => (
            <label key={s.id}>
              <input type="radio" className="sr-only" name="status" checked={status === s.id} onChange={() => setStatus(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine
        </label>
      </div>

      <ErrorNote error={error} />
      {loading && !data ? (
        <div className="page-loading">
          <span className="spinner" /> Loading projects…
        </div>
      ) : data?.length ? (
        <div className="card-grid">
          {data.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty icon="folder" title={q || mine || status !== 'open' ? 'No projects match.' : 'No projects yet.'}>
          {canWork && !q && <p>Create a project for a client, add their room photos, then design in the studio.</p>}
        </Empty>
      )}

      {adding && <ProjectDialog onClose={() => setAdding(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />}
    </Page>
  );
}
