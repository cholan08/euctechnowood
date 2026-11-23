import { ROOM_TYPES, type RoomTypeId } from '../../../../shared/catalog';
import type { PreparedImage } from '../../lib/image';
import type { Mode } from '../../lib/change';
import type { DesignState } from '../../lib/design';
import { FileDrop } from '../ui/FileDrop';

interface Props {
  photo: PreparedImage;
  roomType: RoomTypeId;
  onRoomType: (room: RoomTypeId) => void;
  onFile: (file: File) => void;
  disabled: boolean;
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** Standard mode only: is the upload a room photo or a Cabinet Vision render? */
  source: DesignState['source'];
  onSource: (source: DesignState['source']) => void;
}

const MODES: { id: Mode; label: string; title: string }[] = [
  { id: 'mark', label: 'Mark & edit', title: 'Mark one part on the photo and pick its change. Only the marked area changes.' },
  { id: 'standard', label: 'Standard', title: 'Set new finishes for the whole room (options A–D). The AI redraws the whole image.' },
];

/** Top of the panel: the customer's photo, the room type, and the way of working. */
export function SourceCard({ photo, roomType, onRoomType, onFile, disabled, mode, onMode, source, onSource }: Props) {
  return (
    <div className="source-card">
      <div className="source">
        <FileDrop onFile={onFile} className={`source-thumb${disabled ? ' disabled' : ''}`}>
          <img src={photo.dataUrl} alt="The customer's photo" />
          <span>Replace</span>
        </FileDrop>

        <div className="source-fields">
          <label className="source-room">
            <span className="field-label">Room</span>
            <select value={roomType} onChange={(e) => onRoomType(e.target.value as RoomTypeId)}>
              {ROOM_TYPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {mode === 'standard' && (
            <div className="segmented segmented-sm" role="radiogroup" aria-label="What did you upload?">
              <label>
                <input type="radio" className="sr-only" name="source" checked={source === 'photo'} onChange={() => onSource('photo')} />
                Room photo
              </label>
              <label title="A Cabinet Vision render: with no changes, Generate makes it photoreal">
                <input type="radio" className="sr-only" name="source" checked={source === 'render'} onChange={() => onSource('render')} />
                CV render
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="segmented mode-switch" role="radiogroup" aria-label="Way of working">
        {MODES.map((m) => (
          <label key={m.id} title={m.title}>
            <input type="radio" className="sr-only" name="mode" checked={mode === m.id} onChange={() => onMode(m.id)} disabled={disabled} />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  );
}
