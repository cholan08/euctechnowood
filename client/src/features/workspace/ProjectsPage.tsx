import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FOLLOW_UP_DAYS, PROJECT_SORTS, PROJECT_STATUSES, type ProjectSort, type ProjectStats } from '@shared/workspace';
import { projects } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/ui/Icon';
import { Empty, ErrorNote, Page, ProjectCard, ProjectRow, plural, useLoad } from './components/common';
import { ProjectDialog } from './components/ProjectDialog';

type View = 'list' | 'grid';
const VIEW_KEY = 'projects.view';
const SORT_KEY = 'projects.sort';

const TABS = [{ id: 'open', label: 'Open' }, ...PROJECT_STATUSES, { id: '', label: 'All' }];

function stored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const v = localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
}

/** The value once typing pauses, so search does not hit the server on every key. */
function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function tabCount(stats: ProjectStats | null, id: string): number | undefined {
  if (!stats) return undefined;
  if (id === 'open') return stats.open;
  if (id === '') return stats.open + stats.byStatus.archived;
  return stats.byStatus[id as keyof ProjectStats['byStatus']];
}

/** Home: every project with where it stands, who is on it and what to do next. */
export default function ProjectsPage() {
  const { me, canWork } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<View>(() => stored<View>(VIEW_KEY, 'list', ['list', 'grid']));
  const [sort, setSort] = useState<ProjectSort>(() => stored<ProjectSort>(SORT_KEY, 'recent', PROJECT_SORTS.map((s) => s.id)));
  const search = useDebounced(q.trim());
  const { data, error, loading } = useLoad(() => projects.list({ q: search, status, mine, sort }), [search, status, mine, sort]);
  const { data: stats } = useLoad(() => projects.stats(), [data?.length]);

  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pickView = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };
  const pickSort = (s: ProjectSort) => {
    setSort(s);
    localStorage.setItem(SORT_KEY, s);
  };
  const reset = () => {
    setQ('');
    setMine(false);
    setStatus('open');
  };
  const narrowed = q !== '' || mine || status === 'followup';
  const total = stats ? stats.open + stats.byStatus.archived : 0;

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
      {stats && total > 0 && (
        <p className="pj-summary">
          {plural(stats.open, 'open project')} · {plural(stats.rooms, 'room')} · {stats.designs} {stats.designs === 1 ? 'design' : 'designs'} kept
          {stats.followUp > 0 && (
            <button type="button" className={`pj-alert${status === 'followup' ? ' on' : ''}`} onClick={() => setStatus(status === 'followup' ? 'open' : 'followup')}>
              <span className="pj-dot" /> {stats.followUp} {stats.followUp === 1 ? 'needs' : 'need'} a follow-up
            </button>
          )}
        </p>
      )}

      <div className="pj-tabbar">
        <div className="pj-tabs" role="group" aria-label="Status">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="pj-tab" aria-pressed={status === t.id} onClick={() => setStatus(t.id)}>
              {t.label}
              {tabCount(stats, t.id) !== undefined && <span className="pj-count">{tabCount(stats, t.id)}</span>}
            </button>
          ))}
        </div>
        <button type="button" className="pj-tab" aria-pressed={mine} onClick={() => setMine(!mine)} title="Projects you own or were added to">
          <Icon name="user" size={13} /> Mine
          {stats && <span className="pj-count">{stats.mine}</span>}
        </button>
      </div>

      <div className="pj-toolbar">
        <label className="search search-quiet">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder="Search projects, clients or rooms"
            aria-label="Search projects, clients or rooms"
          />
          {q ? (
            <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>
        <div className="pj-toolbar-end">
          <label className="pj-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => pickSort(e.target.value as ProjectSort)}>
              {PROJECT_SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={13} />
          </label>
          <div className="pj-view" role="group" aria-label="Layout">
            <button type="button" aria-pressed={view === 'list'} onClick={() => pickView('list')} title="List">
              <Icon name="list" size={15} />
            </button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => pickView('grid')} title="Gallery">
              <Icon name="grid" size={15} />
            </button>
          </div>
        </div>
      </div>

      {narrowed && data && (
        <p className="pj-narrowed" aria-live="polite">
          {plural(data.length, 'result')}
          {status === 'followup' && ` · presented, no activity for ${FOLLOW_UP_DAYS}+ days`}
          <button type="button" className="link-btn" onClick={reset}>
            Clear
          </button>
        </p>
      )}

      <ErrorNote error={error} />
      {loading && !data ? (
        <Skeleton view={view} />
      ) : data?.length ? (
        view === 'list' ? (
          <div className={`project-list${loading ? ' is-stale' : ''}`}>
            <div className="project-row project-row-head" aria-hidden="true">
              <span />
              <span>Project</span>
              <span>Stage · next step</span>
              <span>Team</span>
              <span>Updated</span>
            </div>
            {data.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className={`card-grid${loading ? ' is-stale' : ''}`}>
            {data.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        )
      ) : (
        <Empty icon="folder" title={narrowed || status !== 'open' ? 'No projects here.' : 'No projects yet.'}>
          {narrowed || status !== 'open' ? (
            <button type="button" className="btn" onClick={reset}>
              Show all open projects
            </button>
          ) : (
            canWork && (
              <>
                <p>Create a project for a client, add their room photos, then design in the studio.</p>
                <button type="button" className="btn btn-accent" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={16} /> Create your first project
                </button>
              </>
            )
          )}
        </Empty>
      )}

      {adding && <ProjectDialog onClose={() => setAdding(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />}
    </Page>
  );
}

function Skeleton({ view }: { view: View }) {
  const n = Array.from({ length: view === 'list' ? 5 : 6 }, (_, i) => i);
  return view === 'list' ? (
    <div className="project-list" aria-busy="true" aria-label="Loading projects">
      {n.map((i) => (
        <div key={i} className="project-row">
          <span className="row-thumb skeleton" />
          <span className="row-main">
            <span className="skeleton skeleton-line" style={{ width: '55%' }} />
            <span className="skeleton skeleton-line" style={{ width: '35%' }} />
          </span>
        </div>
      ))}
    </div>
  ) : (
    <div className="card-grid" aria-busy="true" aria-label="Loading projects">
      {n.map((i) => (
        <div key={i} className="card">
          <div className="card-thumb skeleton" />
          <div className="card-body">
            <span className="skeleton skeleton-line" style={{ width: '60%' }} />
            <span className="skeleton skeleton-line" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
