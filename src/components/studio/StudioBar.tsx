import { ROOM_TYPES, type RoomTypeId } from '../../../shared/catalog';
import type { PreparedImage } from '../../lib/image';
import { FileDrop } from '../ui/FileDrop';
import type { DesignState } from './DesignPanel';

interface Props {
  photo: PreparedImage;
  design: DesignState;
  onDesign: (patch: Partial<DesignState>) => void;
  onFile: (file: File) => void;
  onStartOver: () => void;
}

/** One row above the studio: the image, what it is, the room type and "Start over". */
export function StudioBar({ photo, design, onDesign, onFile, onStartOver }: Props) {
  return (
    <div className="studio-bar">
      <FileDrop onFile={onFile} className="bar-photo">
        <img src={photo.dataUrl} alt="Your uploaded image" />
        <span>Replace</span>
      </FileDrop>

      <div className="bar-title">
        <p className="crumb">Room Studio</p>
        <h1>{design.source === 'render' ? 'Render to photoreal' : 'Redesign your room'}</h1>
      </div>

      <div className="segmented bar-mode" role="radiogroup" aria-label="What did you upload?">
        <label>
          <input type="radio" className="sr-only" name="source" checked={design.source === 'photo'} onChange={() => onDesign({ source: 'photo' })} />
          Room photo
        </label>
        <label>
          <input type="radio" className="sr-only" name="source" checked={design.source === 'render'} onChange={() => onDesign({ source: 'render' })} />
          Cabinet Vision render
        </label>
      </div>

      <label className="bar-room">
        <span>Room</span>
        <select value={design.roomType} onChange={(e) => onDesign({ roomType: e.target.value as RoomTypeId })}>
          {ROOM_TYPES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn btn-sm bar-reset" onClick={onStartOver}>
        Start over
      </button>
    </div>
  );
}
