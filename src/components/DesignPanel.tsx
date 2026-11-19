import {
  CHANGE_GROUPS,
  EXTRAS,
  MAX_STYLES,
  NOTES_MAX,
  ROOM_TYPES,
  STYLES,
  appliesTo,
  type RoomTypeId,
} from '../../shared/catalog';
import type { RedesignRequest } from '../../shared/types';

export type DesignState = Omit<RedesignRequest, 'image' | 'width' | 'height'>;

interface Props {
  value: DesignState;
  onChange: (next: DesignState) => void;
}

export function DesignPanel({ value, onChange }: Props) {
  const set = (patch: Partial<DesignState>) => onChange({ ...value, ...patch });
  const groups = CHANGE_GROUPS.filter((g) => appliesTo(g, value.roomType));
  const extras = EXTRAS.filter((e) => appliesTo(e, value.roomType));
  const stylesFull = value.styleIds.length >= MAX_STYLES;

  const toggleStyle = (id: string) =>
    set({
      styleIds: value.styleIds.includes(id) ? value.styleIds.filter((s) => s !== id) : [...value.styleIds, id],
    });

  const pick = (groupId: string, optionId: string | null) => {
    const changes = { ...value.changes };
    if (optionId) changes[groupId] = optionId;
    else delete changes[groupId];
    set({ changes });
  };

  const toggleExtra = (id: string) =>
    set({ extras: value.extras.includes(id) ? value.extras.filter((e) => e !== id) : [...value.extras, id] });

  return (
    <>
      <fieldset>
        <legend>What did you upload?</legend>
        <div className="chips">
          <label className="chip">
            <input type="radio" name="source" checked={value.source === 'photo'} onChange={() => set({ source: 'photo' })} />
            Photo of a real room
          </label>
          <label className="chip">
            <input type="radio" name="source" checked={value.source === 'render'} onChange={() => set({ source: 'render' })} />
            3D render (Cabinet Vision)
          </label>
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="room-type">
          Room type
        </label>
        <select id="room-type" value={value.roomType} onChange={(e) => set({ roomType: e.target.value as RoomTypeId })}>
          {ROOM_TYPES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend>
          Styles <span className="muted">· one design per style, up to {MAX_STYLES}</span>
        </legend>
        <div className="chips">
          {STYLES.map((s) => {
            const checked = value.styleIds.includes(s.id);
            return (
              <label key={s.id} className="chip">
                <input type="checkbox" checked={checked} disabled={!checked && stylesFull} onChange={() => toggleStyle(s.id)} />
                {s.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {groups.map((g) => (
        <fieldset key={g.id}>
          <legend>{g.label}</legend>
          <div className="chips">
            <label className="chip">
              <input type="radio" name={g.id} checked={!value.changes[g.id]} onChange={() => pick(g.id, null)} />
              Keep
            </label>
            {g.options.map((o) => (
              <label key={o.id} className="chip">
                <input type="radio" name={g.id} checked={value.changes[g.id] === o.id} onChange={() => pick(g.id, o.id)} />
                {o.swatch && <span className="swatch" style={{ background: o.swatch }} aria-hidden="true" />}
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend>Extras</legend>
        <div className="chips">
          {extras.map((e) => (
            <label key={e.id} className="chip">
              <input type="checkbox" checked={value.extras.includes(e.id)} onChange={() => toggleExtra(e.id)} />
              {e.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">
          Anything else? <span className="muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={2}
          maxLength={NOTES_MAX}
          placeholder="e.g. add a breakfast counter with two bar stools"
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </>
  );
}
