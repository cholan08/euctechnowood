import { ROOM_TYPES, type RoomTypeId } from '../../../../shared/catalog';
import type { PreparedImage } from '../../lib/image';
import { FileDrop } from '../ui/FileDrop';
import type { DesignState } from '../../lib/design';

interface Props {
  photo: PreparedImage;
  design: DesignState;
  onDesign: (patch: Partial<DesignState>) => void;
  onFile: (file: File) => void;
}

/** Top of the options panel: the uploaded image, what it is, and the room type. */
export function SourceCard({ photo, design, onDesign, onFile }: Props) {
  return (
    <div className="source">
      <FileDrop onFile={onFile} className="source-thumb">
        <img src={photo.dataUrl} alt="Your uploaded image" />
        <span>Replace</span>
      </FileDrop>

      <div className="source-fields">
        <div className="segmented" role="radiogroup" aria-label="What did you upload?">
          <label>
            <input type="radio" className="sr-only" name="source" checked={design.source === 'photo'} onChange={() => onDesign({ source: 'photo' })} />
            Room photo
          </label>
          <label>
            <input type="radio" className="sr-only" name="source" checked={design.source === 'render'} onChange={() => onDesign({ source: 'render' })} />
            CV render
          </label>
        </div>
        <label className="source-room">
          <span className="sr-only">Room type</span>
          <select value={design.roomType} onChange={(e) => onDesign({ roomType: e.target.value as RoomTypeId })}>
            {ROOM_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
