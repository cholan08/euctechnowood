import { useState } from 'react';
import { ADDONS, ADDON_SECTIONS, MAX_SAMPLES, MAX_VARIANTS, MOODS, NOTES_MAX, appliesTo, elementsFor, type ElementGroup, type RoomTypeId, type Selection } from '@shared/catalog';
import type { DesignSpec } from '@shared/types';
import { DESIGN_STYLES, findPalette, styleSelections } from '@shared/styles';
import { countVariant, emptyVariant, letter, renumber, type DesignState } from '../model/design';
import { Icon } from '../../../components/ui/Icon';
import { ElementEditor } from './ElementEditor';
import { PromptBar } from './PromptBar';

interface Props {
  roomType: RoomTypeId;
  value: DesignState;
  onChange: (next: DesignState) => void;
  active: number;
  onActive: (index: number) => void;
  /** The part whose position is being picked on the image, if any. */
  picking: string | null;
  onPickArea: (elementId: string) => void;
}

type Tab = ElementGroup | 'extras';

/**
 * Standard mode: the spec editor. The customer's image is the design, so nothing
 * here restyles the room: each part is locked to the original until it is given a
 * new spec. Options A–D are alternative specs of the same room, one image each.
 */
export function DesignPanel({ roomType, value, onChange, active, onActive, picking, onPickArea }: Props) {
  const [tab, setTab] = useState<Tab>('cabinetry');
  const [open, setOpen] = useState<string | null>(null);
  const variant = value.variants[active] ?? value.variants[0];
  const elements = elementsFor(roomType);
  const count = countVariant(variant, roomType);

  const setVariants = (variants: DesignSpec[]) => onChange({ ...value, variants });
  const setVariant = (patch: Partial<DesignSpec>) => setVariants(value.variants.map((v, i) => (i === active ? { ...v, ...patch } : v)));

  function setElement(id: string, sel: Selection | undefined) {
    const next = { ...variant.elements };
    if (sel) next[id] = sel;
    else delete next[id];
    setVariant({ elements: next });
  }

  function applyToAll(id: string) {
    const sel = variant.elements[id];
    setVariants(value.variants.map((v) => ({ ...v, elements: { ...v.elements, [id]: sel } })));
  }

  // A new option starts as a copy of the current one: the usual job is "same, but a different shutter colour".
  function addVariant() {
    if (value.variants.length >= MAX_VARIANTS) return;
    setVariants(renumber([...value.variants, structuredClone(variant)]));
    onActive(value.variants.length);
  }

  function removeVariant(i: number) {
    if (value.variants.length < 2) return;
    setVariants(renumber(value.variants.filter((_, j) => j !== i)));
    onActive(Math.max(0, active >= i ? active - 1 : active));
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'cabinetry', label: 'Cabinetry', count: count.cabinetry },
    { id: 'surfaces', label: 'Surfaces', count: count.surfaces },
    { id: 'extras', label: 'Light & extras', count: count.extras },
  ];

  const changedHere = elements.filter((e) => variant.elements[e.id]);
  // One edit takes the room photo plus a few samples; the same sample on two parts counts once.
  const samples = new Set(changedHere.flatMap((e) => variant.elements[e.id].sample ?? []));

  return (
    <>
      <StyleFill
        roomType={roomType}
        optionName={variant.name}
        onFill={(elementsNext) => setVariant({ elements: { ...variant.elements, ...elementsNext } })}
        onOptions={(fills) => {
          const next = fills.slice(0, MAX_VARIANTS).map((f, i) => ({ ...structuredClone(variant), name: `Option ${letter(i)}`, elements: { ...variant.elements, ...f } }));
          setVariants(renumber(next));
          onActive(0);
        }}
      />

      <div className="variants" aria-label="Design options">
        {value.variants.map((v, i) => {
          const c = countVariant(v, roomType);
          return (
            <div key={i} className={`variant${i === active ? ' on' : ''}`}>
              <button type="button" className="variant-pick" aria-pressed={i === active} onClick={() => onActive(i)} title={`${v.name}: ${c.total} changes`}>
                <span className="variant-letter">{letter(i)}</span>
                <span className="variant-count">{c.total}</span>
              </button>
              {value.variants.length > 1 && (
                <button type="button" className="variant-x" aria-label={`Remove ${v.name}`} onClick={() => removeVariant(i)}>
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
          );
        })}
        {value.variants.length < MAX_VARIANTS ? (
          <button type="button" className="variant-add" onClick={addVariant} title="Add an option (copies the current one)">
            <Icon name="plus" size={14} /> Option
          </button>
        ) : (
          <span className="variant-max">Max {MAX_VARIANTS}</span>
        )}
        <button
          type="button"
          className="variant-reset"
          onClick={() => setVariants(value.variants.map((v, i) => (i === active ? { ...emptyVariant(i), name: v.name } : v)))}
          disabled={count.total === 0}
          title={`Lock every part of ${variant.name} back to the original`}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Parts of the room">
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
            {t.count > 0 && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="tab-panel" id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab !== 'extras' ? (
          <>
            <p className="tab-hint">
              <Icon name="lock" size={12} /> Every part stays exactly as in the image until you change it.
            </p>
            <div className="el-list">
              {elements
                .filter((e) => e.group === tab)
                .map((e) => (
                  <ElementEditor
                    key={`${active}-${e.id}`}
                    roomType={roomType}
                    element={e}
                    value={variant.elements[e.id]}
                    open={open === e.id}
                    onToggle={() => setOpen(open === e.id ? null : e.id)}
                    onChange={(sel) => setElement(e.id, sel)}
                    siblings={changedHere.filter((s) => s.id !== e.id).map((s) => ({ element: s, value: variant.elements[s.id] }))}
                    onApplyAll={value.variants.length > 1 ? () => applyToAll(e.id) : undefined}
                    onPickArea={() => onPickArea(e.id)}
                    picking={picking === e.id}
                    canAddSample={samples.size < MAX_SAMPLES}
                  />
                ))}
            </div>
          </>
        ) : (
          <Extras variant={variant} room={roomType} onChange={setVariant} />
        )}
      </div>
    </>
  );
}

function Extras({ variant, room, onChange }: { variant: DesignSpec; room: RoomTypeId; onChange: (p: Partial<DesignSpec>) => void }) {
  const toggle = (id: string) =>
    onChange({ addons: variant.addons.includes(id) ? variant.addons.filter((a) => a !== id) : [...variant.addons, id] });

  return (
    <>
      <div className="field">
        <span className="field-label">Lighting mood</span>
        <div className="opts">
          {MOODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={variant.mood === m.id} className="opt" onClick={() => onChange({ mood: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {ADDON_SECTIONS.map((section) => {
        const items = ADDONS.filter((a) => a.section === section.id && appliesTo(a, room));
        if (!items.length) return null;
        return (
          <div key={section.id} className="field">
            <span className="field-label">{section.label}</span>
            <div className="chips">
              {items.map((a) => {
                const on = variant.addons.includes(a.id);
                return (
                  <label key={a.id} className="chip">
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(a.id)} />
                    <Icon name={on ? 'check' : 'plus'} size={14} />
                    {a.label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="notes">
        <label className="field-label" htmlFor="designer-note">
          Designer's note <i>optional · any language</i>
          <span className="notes-count">
            {variant.notes.length} / {NOTES_MAX}
          </span>
        </label>
        <PromptBar
          id="designer-note"
          label="Designer's note"
          multiline
          value={variant.notes}
          onChange={(notes) => onChange({ notes })}
          placeholder="e.g. make the hob wall a slightly darker shade than the rest"
          maxLength={NOTES_MAX}
          context={{ kind: 'note', roomType: room }}
        />
      </div>
    </>
  );
}

/**
 * "Start from a style" for a furnished room: fills ONLY the parts staff tick with a
 * style's colour combination. Every part not ticked stays locked to the photo,
 * so the customer's real design changes only where they asked.
 */
function StyleFill({ roomType, optionName, onFill, onOptions }: { roomType: RoomTypeId; optionName: string; onFill: (e: Record<string, Selection>) => void; onOptions: (fills: Record<string, Selection>[]) => void }) {
  const [open, setOpen] = useState(false);
  const [styleId, setStyleId] = useState(DESIGN_STYLES[0].id);
  const [paletteId, setPaletteId] = useState('');
  const [parts, setParts] = useState<ReadonlySet<string>>(new Set());
  const style = DESIGN_STYLES.find((s) => s.id === styleId)!;
  const palette = findPalette(style, paletteId);
  const available = Object.keys(styleSelections(palette, roomType));
  const elements = elementsFor(roomType).filter((e) => available.includes(e.id));
  const picked = new Set([...parts].filter((p) => available.includes(p)));

  const toggle = (id: string) => setParts((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className={`style-fill${open ? ' open' : ''}`}>
      <button type="button" className="custom-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="palette" size={14} /> Start from a style
        <b className="step-value">{open ? '' : `${DESIGN_STYLES.length} styles`}</b>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div className="custom-body">
          <div className="opts" role="radiogroup" aria-label="Style">
            {DESIGN_STYLES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={s.id === styleId} className="opt" onClick={() => { setStyleId(s.id); setPaletteId(''); }} title={s.blurb}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="palette-list">
            {style.palettes.map((p) => (
              <label key={p.id} className={`palette${p.id === palette.id ? ' on' : ''}`}>
                <input type="radio" className="sr-only" name="fill-palette" checked={p.id === palette.id} onChange={() => setPaletteId(p.id)} />
                <span className="palette-sw" aria-hidden="true">
                  {p.colours.map((c) => <span key={c} style={{ background: c }} />)}
                </span>
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          <span className="field-label">Parts the customer wants changed <i>the rest stays as in the photo</i></span>
          <div className="chips">
            {elements.map((e) => (
              <label key={e.id} className="chip">
                <input type="checkbox" className="sr-only" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
                <Icon name={picked.has(e.id) ? 'check' : 'plus'} size={14} />
                {e.label}
              </label>
            ))}
          </div>
          <div className="fill-actions">
            <button type="button" className="btn btn-sm" disabled={!picked.size} onClick={() => onFill(styleSelections(palette, roomType, picked))}>
              Fill {optionName}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!picked.size || style.palettes.length < 2}
              onClick={() => onOptions(style.palettes.map((p) => styleSelections(p, roomType, picked)))}
              title="One option per colour combination, to compare side by side"
            >
              Options A–{letter(Math.min(MAX_VARIANTS, style.palettes.length) - 1)} from {style.palettes.length} combinations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
