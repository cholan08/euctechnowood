import { useEffect, useState } from 'react';
import { imageUrl, type RoomDetail, type SavedDesign } from '@shared/workspace';
import { rooms } from '../../../api/workspace';
import { useAuth } from '../../../app/auth';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { downloadImage } from '../../../lib/download';
import { blobToDataUrl, BOARD_SIZE, renderBoard, type BoardLine } from '../../../lib/board';
import { errorText } from './common';

/** The list of changes an image carries (saved by the studio), for the board. */
export function linesOf(d: SavedDesign): BoardLine[] {
  const m = d.image.meta as { changes?: BoardLine[]; specs?: BoardLine[] };
  const lines = m.changes ?? m.specs ?? [];
  if (lines.length) return lines.filter((l) => l && typeof l.label === 'string' && typeof l.value === 'string');
  return d.image.label ? [{ label: d.image.label, value: d.image.detail }] : [];
}

const paletteOf = (d: SavedDesign): string[] => {
  const m = d.image.meta as { palette?: string[] };
  if (Array.isArray(m.palette)) return m.palette.filter((h) => /^#[0-9a-f]{6}$/i.test(h));
  return [...new Set(linesOf(d).flatMap((l) => (l.hex ? [l.hex] : [])))];
};

/** Builds the client presentation board from saved designs: preview, download, keep in the room. */
export function BoardDialog({ detail, onClose, onSaved }: { detail: RoomDetail; onClose: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const [picked, setPicked] = useState<string[]>(detail.designs.slice(0, 3).map((d) => d.id));
  const [title, setTitle] = useState('Design presentation');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const chosen = picked.map((id) => detail.designs.find((d) => d.id === id)!).filter(Boolean);
  const concept = chosen.some((d) => d.image.kind === 'concept');

  useEffect(() => {
    if (!chosen.length || !detail.room.originalImageId) return;
    let live = true;
    setBusy(true);
    setSaved(false);
    const timer = setTimeout(() => {
      renderBoard({
        title,
        client: detail.project.clientName,
        project: detail.project.name,
        room: detail.room.name,
        designer: me?.user.name ?? '',
        before: imageUrl(detail.room.originalImageId!),
        designs: chosen.map((d) => ({ name: d.name, url: imageUrl(d.image.id) })),
        lines: linesOf(chosen[0]),
        palette: paletteOf(chosen[0]),
        notes,
        disclaimer: concept
          ? 'Concept visual made with AI from the room photo, for discussion. Final materials and sizes as per EUC drawings and samples.'
          : "Visual made with AI on the customer's own room photo, for discussion. Final materials as per EUC samples.",
      })
        .then((blob) => {
          if (!live) return;
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return { url: URL.createObjectURL(blob), blob };
          });
          setError('');
        })
        .catch((err: unknown) => live && setError(errorText(err)))
        .finally(() => live && setBusy(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.join(), title, notes]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      await rooms.saveImage(detail.room.id, {
        image: await blobToDataUrl(preview.blob),
        ...BOARD_SIZE,
        kind: 'board',
        label: title,
        detail: chosen.map((d) => d.name).join(', '),
        meta: { designs: picked },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const slug = `${detail.project.clientName}-${detail.room.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <Dialog title="Presentation board" onClose={onClose} wide>
      {!detail.designs.length ? (
        <p>Save at least one design first (the star on an image in the history, or “Save design” in the studio).</p>
      ) : (
        <div className="board-builder">
          <div className="board-side">
            <label className="form-field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
            </label>
            <div className="form-field">
              <span>Designs · up to 3, the first is shown large</span>
              <ul className="board-picks">
                {detail.designs.map((d) => {
                  const i = picked.indexOf(d.id);
                  return (
                    <li key={d.id}>
                      <label className={i >= 0 ? 'on' : ''}>
                        <input type="checkbox" className="sr-only" checked={i >= 0} onChange={() => toggle(d.id)} />
                        <img src={imageUrl(d.image.id)} alt="" />
                        <span>{d.name}</span>
                        {i >= 0 && <b className="pick-num">{i + 1}</b>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <label className="form-field">
              <span>Notes for the client</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Shutter samples to be confirmed at the showroom." />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn" disabled={!preview || busy || saved || !detail.project.canEdit} onClick={save} title="Keep the board in this room's history">
                <Icon name={saved ? 'check' : 'folder'} size={15} /> {saved ? 'Saved to room' : 'Save to room'}
              </button>
              <button type="button" className="btn btn-accent" disabled={!preview || busy} onClick={() => preview && downloadImage(preview.url, `euc-board-${slug}.jpg`)}>
                <Icon name="download" size={15} /> Download JPG
              </button>
            </div>
          </div>
          <div className="board-preview">
            {preview ? <img src={preview.url} alt="Preview of the presentation board" /> : <div className="page-loading"><span className="spinner" /> Drawing the board…</div>}
            {busy && preview && <span className="board-busy spinner" />}
          </div>
        </div>
      )}
    </Dialog>
  );
}
