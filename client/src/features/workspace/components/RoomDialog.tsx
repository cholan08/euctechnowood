import { useState, type FormEvent } from 'react';
import { ROOM_TYPES, type RoomTypeId } from '@shared/catalog';
import type { Room } from '@shared/workspace';
import { projects } from '../../../api/workspace';
import { Dialog } from '../../../components/ui/Dialog';
import { FileDrop } from '../../../components/ui/FileDrop';
import { Icon } from '../../../components/ui/Icon';
import { prepareImage, type PreparedImage } from '../../../lib/image';
import { errorText } from './common';

/** Add a room to a project: its photo (or Cabinet Vision render), name and type. */
export function RoomDialog({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: (r: Room) => void }) {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [name, setName] = useState('');
  const [roomType, setRoomType] = useState<RoomTypeId>('kitchen');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    setError('');
    try {
      setPhoto(await prepareImage(file));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!photo) return setError('Add the room photo.');
    setBusy(true);
    setError('');
    try {
      const label = name.trim() || ROOM_TYPES.find((r) => r.id === roomType)!.label;
      onSaved(await projects.addRoom(projectId, { name: label, roomType, image: photo.dataUrl, width: photo.width, height: photo.height }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add a room" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <FileDrop onFile={pick} className={`room-drop${photo ? ' has-photo' : ''}`}>
          {photo ? (
            <img src={photo.dataUrl} alt="The room photo" />
          ) : (
            <>
              <Icon name="upload" size={20} />
              <strong>Room photo or Cabinet Vision render</strong>
              <span>JPG, PNG or WebP · empty rooms can be designed from scratch with Generate</span>
            </>
          )}
        </FileDrop>
        <div className="form-row">
          <label className="form-field">
            <span>Room type</span>
            <select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomTypeId)}>
              {ROOM_TYPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Master bedroom" />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy || !photo}>
            {busy ? <span className="spinner" /> : 'Add room'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
