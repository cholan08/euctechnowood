import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clients } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/ui/Icon';
import { ClientDialog } from './components/ClientDialog';
import { Empty, ErrorNote, Page, ProjectCard, errorText, useLoad } from './components/common';
import { ProjectDialog } from './components/ProjectDialog';

export default function ClientPage() {
  const { id = '' } = useParams();
  const { canWork, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, error, reload } = useLoad(() => clients.get(id), [id]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState('');

  async function remove() {
    if (!data) return;
    if (!window.confirm(`Delete ${data.client.name} and all ${data.projects.length} of their projects, rooms and images? This cannot be undone.`)) return;
    try {
      await clients.remove(id);
      navigate('/clients');
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  if (!data) {
    return (
      <Page title="Client" back={{ to: '/clients', label: 'Clients' }}>
        {error ? <ErrorNote error={error} /> : <div className="page-loading"><span className="spinner" /> Loading…</div>}
      </Page>
    );
  }
  const { client, projects } = data;

  return (
    <Page
      back={{ to: '/clients', label: 'Clients' }}
      eyebrow="Client"
      title={client.name}
      actions={
        <>
          {isAdmin && (
            <button type="button" className="btn btn-ghost" onClick={remove}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          {canWork && (
            <>
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                <Icon name="pencil" size={15} /> Edit
              </button>
              <button type="button" className="btn btn-accent" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} /> New project
              </button>
            </>
          )}
        </>
      }
    >
      <ErrorNote error={actionError} />
      <dl className="facts">
        <div>
          <dt>Phone</dt>
          <dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
        </div>
        <div>
          <dt>Address / site</dt>
          <dd>{client.address || '—'}</dd>
        </div>
        {client.notes && (
          <div className="facts-wide">
            <dt>Notes</dt>
            <dd className="pre">{client.notes}</dd>
          </div>
        )}
      </dl>

      <h2 className="section-title">Projects</h2>
      {projects.length ? (
        <div className="card-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty icon="folder" title="No projects for this client yet." />
      )}

      {editing && (
        <ClientDialog
          client={client}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {adding && <ProjectDialog clientId={client.id} onClose={() => setAdding(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />}
    </Page>
  );
}
