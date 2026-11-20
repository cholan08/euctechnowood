import { useState } from 'react';
import { CHANGE_GROUPS, EXTRAS, MAX_STYLES, NOTES_MAX, STYLES, appliesTo } from '../../../shared/catalog';
import type { RedesignRequest } from '../../../shared/types';

export type DesignState = Omit<RedesignRequest, 'image' | 'width' | 'height'>;

interface Props {
  value: DesignState;
  onChange: (next: DesignState) => void;
}

type Tab = 'styles' | 'finishes' | 'extras';

/** The design options, split into three tabs so everything fits on one screen. */
export function DesignPanel({ value, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('styles');
  const set = (patch: Partial<DesignState>) => onChange({ ...value, ...patch });
  const groups = CHANGE_GROUPS.filter((g) => appliesTo(g, value.roomType));
  const extras = EXTRAS.filter((e) => appliesTo(e, value.roomType));
  const stylesFull = value.styleIds.length >= MAX_STYLES;

  const counts: Record<Tab, number> = {
    styles: value.styleIds.length,
    finishes: groups.filter((g) => value.changes[g.id]).length,
    extras: value.extras.length + (value.notes.trim() ? 1 : 0),
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'styles', label: 'Styles' },
    { id: 'finishes', label: 'Finishes' },
    { id: 'extras', label: 'Extras' },
  ];

  const toggleStyle = (id: string) =>
    set({ styleIds: value.styleIds.includes(id) ? value.styleIds.filter((s) => s !== id) : [...value.styleIds, id] });

  const pick = (groupId: string, optionId: string) => {
    const changes = { ...value.changes };
    if (optionId) changes[groupId] = optionId;
    else delete changes[groupId];
    set({ changes });
  };

  const toggleExtra = (id: string) =>
    set({ extras: value.extras.includes(id) ? value.extras.filter((e) => e !== id) : [...value.extras, id] });

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Design options">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="tab-panel"
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div className="tab-panel" id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'styles' && (
          <>
            <p className="tab-hint">
              {value.source === 'render'
                ? 'Optional. Leave empty to keep your design exactly as drawn and only make it photoreal.'
                : `Pick up to ${MAX_STYLES}. You get one design per style.`}
            </p>
            <div className="style-grid">
              {STYLES.map((s) => {
                const checked = value.styleIds.includes(s.id);
                return (
                  <label key={s.id} className="style-card">
                    <input type="checkbox" className="sr-only" checked={checked} disabled={!checked && stylesFull} onChange={() => toggleStyle(s.id)} />
                    <strong>{s.label}</strong>
                    <span>{s.blurb}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {tab === 'finishes' && (
          <>
            <p className="tab-hint">Change any part of the room, or keep it as it is.</p>
            <div className="finish-list">
              {groups.map((g) => {
                const chosen = g.options.find((o) => o.id === value.changes[g.id]);
                return (
                  <label key={g.id} className="finish-row">
                    <span>{g.label}</span>
                    <span className={`select-wrap${chosen ? ' changed' : ''}`}>
                      {chosen?.swatch && <span className="swatch" style={{ background: chosen.swatch }} aria-hidden="true" />}
                      <select value={value.changes[g.id] ?? ''} onChange={(e) => pick(g.id, e.target.value)}>
                        <option value="">Keep as is</option>
                        {g.options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {tab === 'extras' && (
          <>
            <p className="tab-hint">Add finishing touches to every design.</p>
            <div className="chips">
              {extras.map((e) => (
                <label key={e.id} className="chip">
                  <input type="checkbox" className="sr-only" checked={value.extras.includes(e.id)} onChange={() => toggleExtra(e.id)} />
                  {e.label}
                </label>
              ))}
            </div>
            <label className="field notes">
              <span>
                Anything else? <span className="muted">(optional)</span>
              </span>
              <textarea
                rows={3}
                maxLength={NOTES_MAX}
                placeholder="e.g. add a breakfast counter with two bar stools"
                value={value.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
          </>
        )}
      </div>
    </>
  );
}
