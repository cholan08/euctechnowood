import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROOM_TYPES } from '@shared/catalog';
import { PROJECT_STATUSES, imageUrl, type ProjectStatus } from '@shared/workspace';
import { projects } from '../../api/workspace';
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/ui/Icon';
import { Empty, ErrorNote, Page, ago, errorText, plural, useLoad } from './components/common';
import { MembersDialog } from './components/MembersDialog';
import { RoomDialog } from './components/RoomDialog';

export default function ProjectPage() {
  const { id = '' } = useParams();
  const { me, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: project, error, setData, reload } = useLoad(() => projects.get(id), [id]);
  const [addingRoom, setAddingRoom] = useState(false);
  const [team, setTeam] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  if (!project) {
    return (
      <Page title="Project" back={{ to: '/', label: 'Projects' }}>
        {error ? <ErrorNote error={error} /> : <div className="page-loading"><span className="spinner" /> Loading…</div>}
      </Page>
    );
  }

  const canManage = isAdmin || project.ownerId === me?.user.id;

  async function update(patch: { status?: ProjectStatus; notes?: string; name?: string }) {
    try {
      setData(await projects.update(id, patch));
      setActionError('');
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${project!.name}” with its ${plural(project!.rooms.length, 'room')} and every image? This cannot be undone.`)) return;
    try {
      await projects.remove(id);
      navigate('/');
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  function rename() {
    const name = window.prompt('Project name', project!.name)?.trim();
    if (name && name !== project!.name) void update({ name });
  }

  return (
    <Page
      back={{ to: '/', label: 'Projects' }}
      eyebrow={
        <Link to={`/clients/${project.clientId}`} className="eyebrow-link">
          {project.clientName}
        </Link>
      }
      title={
        <>
          {project.name}
          {project.canEdit && (
            <button type="button" className="icon-btn" onClick={rename} title="Rename the project">
              <Icon name="pencil" size={15} />
            </button>
          )}
        </>
      }
      actions={
        <>
          {canManage && (
            <button type="button" className="btn btn-ghost" onClick={remove}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          {project.canEdit && (
            <button type="button" className="btn btn-accent" onClick={() => setAddingRoom(true)}>
              <Icon name="plus" size={16} /> Add room
            </button>
          )}
        </>
      }
    >
      <ErrorNote error={actionError} />
      <div className="project-bar">
        <label className="inline-field">
          <span>Status</span>
          <select value={project.status} disabled={!project.canEdit} onChange={(e) => void update({ status: e.target.value as ProjectStatus })}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-field">
          <span>Owner</span>
          <b>{project.ownerName ?? '—'}</b>
        </span>
        <span className="inline-field">
          <span>Team</span>
          <b>{project.members.length ? project.members.map((m) => `${m.name}${m.access === 'edit' ? '' : ' (view)'}`).join(', ') : 'Owner only'}</b>
          {canManage && (
            <button type="button" className="link" onClick={() => setTeam(true)}>
              <Icon name="users" size={13} /> Manage
            </button>
          )}
        </span>
        {!project.canEdit && (
          <span className="view-only">
            <Icon name="eye" size={13} /> View only
          </span>
        )}
      </div>

      <h2 className="section-title">Rooms</h2>
      {project.rooms.length ? (
        <div className="card-grid">
          {project.rooms.map((r) => (
            <Link key={r.id} to={`/rooms/${r.id}`} className="card room-card">
              <div className="card-thumb">{r.coverImageId || r.originalImageId ? <img src={imageUrl((r.coverImageId ?? r.originalImageId)!)} alt="" loading="lazy" /> : <Icon name="photo" size={28} />}</div>
              <div className="card-body">
                <strong>{r.name}</strong>
                <span>{ROOM_TYPES.find((t) => t.id === r.roomType)?.label}</span>
                <span className="card-meta">
                  {plural(r.imageCount, 'image')} · {plural(r.designCount, 'saved design')} · {ago(r.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty icon="photo" title="No rooms yet.">
          {project.canEdit && <p>Add each room's photo (or a Cabinet Vision render) to start designing.</p>}
        </Empty>
      )}

      <h2 className="section-title">Notes</h2>
      {notes === null ? (
        <div className="notes-view">
          <p className="pre">{project.notes || <i>No notes.</i>}</p>
          {project.canEdit && (
            <button type="button" className="link" onClick={() => setNotes(project.notes)}>
              <Icon name="pencil" size={13} /> Edit notes
            </button>
          )}
        </div>
      ) : (
        <div className="notes-edit">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000} />
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotes(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-accent" onClick={() => void update({ notes }).then(() => setNotes(null))}>
              Save notes
            </button>
          </div>
        </div>
      )}

      {addingRoom && <RoomDialog projectId={id} onClose={() => setAddingRoom(false)} onSaved={(r) => navigate(`/rooms/${r.id}`)} />}
      {team && (
        <MembersDialog
          project={project}
          onClose={() => setTeam(false)}
          onSaved={(p) => {
            setData(p);
            setTeam(false);
            reload();
          }}
        />
      )}
    </Page>
  );
}
