import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROOM_TYPES, type RoomTypeId } from '@shared/catalog';
import { IMAGE_KINDS, imageUrl, type SavedDesign, type StoredImage } from '@shared/workspace';
import { rooms } from '../../api/workspace';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { CompareSlider } from '../studio/components/CompareSlider';
import { BoardDialog } from './components/BoardDialog';
import { Empty, ErrorNote, Page, ago, errorText, plural, useLoad } from './components/common';

type Tab = 'designs' | 'history';

/** One room: its saved designs, the full image history, and the presentation board. */
export default function RoomPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, reload } = useLoad(() => rooms.get(id), [id]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [comparing, setComparing] = useState<StoredImage | null>(null);
  const [board, setBoard] = useState(false);
  const [actionError, setActionError] = useState('');

  const savedIds = useMemo(() => new Set(data?.designs.map((d) => d.image.id) ?? []), [data]);

  if (!data) {
    return (
      <Page title="Room" back={{ to: '/', label: 'Projects' }}>
        {error ? <ErrorNote error={error} /> : <div className="page-loading"><span className="spinner" /> Loading…</div>}
      </Page>
    );
  }

  const { room, project, images, designs } = data;
  const canEdit = project.canEdit;
  const shown: Tab = tab ?? (designs.length ? 'designs' : 'history');
  const original = images.find((i) => i.kind === 'original');
  const latest = [...images].reverse().find((i) => i.kind !== 'board');

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      setActionError('');
      reload();
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  function saveDesign(img: StoredImage) {
    const name = window.prompt('Name this design for the client', img.label || 'Design')?.trim();
    if (name) void act(() => rooms.saveDesign(room.id, { imageId: img.id, name }));
  }

  function renameDesign(d: SavedDesign) {
    const name = window.prompt('Design name', d.name)?.trim();
    if (name && name !== d.name) void act(() => rooms.updateDesign(d.id, { name }));
  }

  function changeType(roomType: RoomTypeId) {
    void act(() => rooms.update(room.id, { roomType }));
  }

  async function removeRoom() {
    if (!window.confirm(`Delete the room “${room.name}” and its ${plural(images.length, 'image')}? This cannot be undone.`)) return;
    try {
      await rooms.remove(room.id);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  const studio = (from?: string) => `/rooms/${room.id}/studio${from ? `?from=${from}` : ''}`;

  return (
    <Page
      back={{ to: `/projects/${project.id}`, label: project.name }}
      eyebrow={
        <>
          <Link to={`/clients/${project.clientId}`} className="eyebrow-link">
            {project.clientName}
          </Link>{' '}
          · {project.name}
        </>
      }
      title={room.name}
      actions={
        <>
          {canEdit && (
            <button type="button" className="btn btn-ghost" onClick={removeRoom}>
              <Icon name="trash" size={15} /> Delete room
            </button>
          )}
          <button type="button" className="btn" onClick={() => setBoard(true)} disabled={!designs.length} title={designs.length ? 'Make a branded board for the client' : 'Save a design first'}>
            <Icon name="board" size={15} /> Presentation board
          </button>
          {canEdit && (
            <Link to={studio(latest && latest.kind !== 'original' ? latest.id : undefined)} className="btn btn-accent">
              <Icon name="sparkle" size={16} /> Open in studio
            </Link>
          )}
        </>
      }
    >
      <ErrorNote error={actionError} />
      <div className="project-bar">
        <label className="inline-field">
          <span>Room type</span>
          <select value={room.roomType} disabled={!canEdit} onChange={(e) => changeType(e.target.value as RoomTypeId)}>
            {ROOM_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <span className="inline-field">
          <span>History</span>
          <b>{plural(images.length, 'image')}</b>
        </span>
        <span className="inline-field">
          <span>Saved</span>
          <b>{plural(designs.length, 'design')}</b>
        </span>
      </div>

      <div className="tabs page-tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={shown === 'designs'} onClick={() => setTab('designs')}>
          Saved designs {designs.length > 0 && <span className="tab-count">{designs.length}</span>}
        </button>
        <button type="button" role="tab" className="tab" aria-selected={shown === 'history'} onClick={() => setTab('history')}>
          Image history <span className="tab-count">{images.length}</span>
        </button>
      </div>

      {shown === 'designs' ? (
        designs.length ? (
          <div className="card-grid">
            {designs.map((d) => (
              <figure key={d.id} className="card image-card">
                <button type="button" className="card-thumb" onClick={() => setComparing(d.image)} title="Compare with the original">
                  <img src={imageUrl(d.image.id)} alt={d.name} loading="lazy" />
                  <span className={`kind-chip k-${d.image.kind}`}>{IMAGE_KINDS[d.image.kind]}</span>
                </button>
                <figcaption className="card-body">
                  <strong>{d.name}</strong>
                  <span>{d.image.detail || d.image.label}</span>
                  <span className="card-meta">
                    {d.createdBy ?? '—'} · {ago(d.createdAt)}
                  </span>
                  <div className="card-actions">
                    {canEdit && (
                      <Link to={studio(d.image.id)} className="link">
                        <Icon name="sparkle" size={13} /> Continue
                      </Link>
                    )}
                    <a className="link icon-link" href={`${imageUrl(d.image.id)}?download=1`} title="Download">
                      <Icon name="download" size={15} />
                      <span className="sr-only">Download</span>
                    </a>
                    {canEdit && (
                      <>
                        <button type="button" className="link icon-link" onClick={() => renameDesign(d)} title="Rename">
                          <Icon name="pencil" size={15} />
                      <span className="sr-only">Rename</span>
                        </button>
                        <button type="button" className="link icon-link" onClick={() => void act(() => rooms.removeDesign(d.id))} title="Unsave: the image stays in the history">
                          <Icon name="x" size={15} />
                      <span className="sr-only">Unsave</span>
                        </button>
                      </>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <Empty icon="star" title="No saved designs yet.">
            <p>In the studio, press “Save design” on a result you want to show the client, or star an image in the history.</p>
          </Empty>
        )
      ) : (
        <ol className="history">
          {[...images].reverse().map((img) => (
            <li key={img.id} className="card image-card">
              <button type="button" className="card-thumb" onClick={() => img.kind !== 'original' && img.kind !== 'board' && setComparing(img)} title="Compare with the original">
                <img src={imageUrl(img.id)} alt={img.label} loading="lazy" />
                <span className={`kind-chip k-${img.kind}`}>{IMAGE_KINDS[img.kind]}</span>
                {savedIds.has(img.id) && (
                  <span className="saved-star" title="Saved design">
                    <Icon name="star" size={14} />
                  </span>
                )}
              </button>
              <div className="card-body">
                <strong>{img.label || IMAGE_KINDS[img.kind]}</strong>
                {img.detail && <span>{img.detail}</span>}
                <span className="card-meta">
                  {img.createdBy ?? '—'} · {ago(img.createdAt)} · {img.width}×{img.height}
                </span>
                <div className="card-actions">
                  {canEdit && img.kind !== 'board' && (
                    <Link to={studio(img.kind === 'original' ? undefined : img.id)} className="link">
                      <Icon name="sparkle" size={13} /> {img.kind === 'original' ? 'Start from photo' : 'Continue from here'}
                    </Link>
                  )}
                  {canEdit && img.kind !== 'original' && img.kind !== 'board' && !savedIds.has(img.id) && (
                    <button type="button" className="link icon-link" onClick={() => saveDesign(img)} title="Save as a design for the client">
                      <Icon name="star" size={15} />
                      <span className="sr-only">Save design</span>
                    </button>
                  )}
                  <a className="link icon-link" href={`${imageUrl(img.id)}?download=1`} title="Download">
                    <Icon name="download" size={15} />
                      <span className="sr-only">Download</span>
                  </a>
                  {canEdit && img.kind !== 'original' && (
                    <button type="button" className="link icon-link" onClick={() => window.confirm('Delete this image from the history?') && void act(() => rooms.removeImage(img.id))} title="Delete from the history">
                      <Icon name="trash" size={15} />
                      <span className="sr-only">Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {comparing && original && (
        <Dialog title={comparing.label || IMAGE_KINDS[comparing.kind]} onClose={() => setComparing(null)} wide>
          <div className="compare-dialog">
            <CompareSlider before={imageUrl(original.id)} after={imageUrl(comparing.id)} ratio={original.width / original.height} label={comparing.label} beforeLabel="Original" afterLabel={IMAGE_KINDS[comparing.kind]} />
          </div>
          {comparing.detail && <p className="dialog-note">{comparing.detail}</p>}
        </Dialog>
      )}
      {board && <BoardDialog detail={data} onClose={() => setBoard(false)} onSaved={reload} />}
    </Page>
  );
}
