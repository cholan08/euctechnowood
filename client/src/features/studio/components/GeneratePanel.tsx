import { useEffect, useState } from 'react';
import { MOODS, NOTES_MAX, elementsFor, type RoomTypeId, type Selection } from '@shared/catalog';
import { DESIGN_STYLES, MAX_CONCEPTS, MAX_FURNITURE, findPalette, localFurniture, type FurnitureIdea } from '@shared/styles';
import { recommend } from '../../../api/studio';
import { Icon } from '../../../components/ui/Icon';
import { conceptFrom, renumberConcepts } from '../model/generate';
import type { Generate } from '../hooks/useGenerate';
import { ElementEditor } from './ElementEditor';
import { PromptBar } from './PromptBar';

interface Props {
  roomType: RoomTypeId;
  gen: Generate;
}

type Section = 'style' | 'materials' | 'furniture' | 'brief';

/**
 * Generate: an empty or unfinished room → designed concepts. Pick a style, then
 * its colour combinations (one concept each). Every part of each concept can be
 * customised; the room's walls, windows, doors and camera are always kept.
 */
export function GeneratePanel({ roomType, gen }: Props) {
  const { spec, setSpec, style, active, setActive } = gen;
  const [open, setOpen] = useState<Section>('style');
  const [part, setPart] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<FurnitureIdea[]>([]);
  const [ideasFrom, setIdeasFrom] = useState('');
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState('');
  const [custom, setCustom] = useState('');

  const concept = spec.concepts[active] ?? spec.concepts[0];
  const elements = elementsFor(roomType);
  const palette = concept ? findPalette(style, concept.palette) : style.palettes[0];

  // The built-in list for this style and room, until staff ask the AI for ideas.
  useEffect(() => {
    setIdeas(localFurniture(roomType));
    setIdeasFrom('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style.id, roomType]);

  const update = (patch: Partial<typeof spec>) => setSpec({ ...spec, ...patch });

  function togglePalette(id: string) {
    const at = spec.concepts.findIndex((c) => c.palette === id);
    if (at >= 0) {
      if (spec.concepts.length === 1) return;
      update({ concepts: renumberConcepts(spec.concepts.filter((_, i) => i !== at)) });
      setActive(Math.max(0, Math.min(active, spec.concepts.length - 2)));
    } else if (spec.concepts.length < MAX_CONCEPTS) {
      update({ concepts: renumberConcepts([...spec.concepts, conceptFrom(style, id, roomType, spec.concepts.length)]) });
      setActive(spec.concepts.length);
    }
  }

  /** One more concept with the same combination: the AI arranges it differently. */
  function addSame() {
    if (!concept || spec.concepts.length >= MAX_CONCEPTS) return;
    update({ concepts: renumberConcepts([...spec.concepts, structuredClone(concept)]) });
    setActive(spec.concepts.length);
  }

  function removeConcept(i: number) {
    if (spec.concepts.length < 2) return;
    update({ concepts: renumberConcepts(spec.concepts.filter((_, j) => j !== i)) });
    setActive(Math.max(0, active >= i ? active - 1 : active));
  }

  function setElement(id: string, sel: Selection | undefined) {
    const elementsNext = { ...concept.elements };
    if (sel) elementsNext[id] = sel;
    else delete elementsNext[id];
    update({ concepts: spec.concepts.map((c, i) => (i === active ? { ...c, elements: elementsNext } : c)) });
  }

  function toggleFurniture(name: string) {
    const has = spec.furniture.includes(name);
    if (!has && spec.furniture.length >= MAX_FURNITURE) return;
    update({ furniture: has ? spec.furniture.filter((f) => f !== name) : [...spec.furniture, name] });
  }

  async function askIdeas() {
    setLoadingIdeas(true);
    setIdeasError('');
    try {
      const r = await recommend({ roomType, style: style.id, palette: palette.id, brief: spec.brief });
      setIdeas(r.items);
      setIdeasFrom(r.provider === 'mock' || r.provider === 'built-in' ? '' : 'AI ideas for this brief');
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : 'Ideas are not available right now.');
    } finally {
      setLoadingIdeas(false);
    }
  }

  function addCustom() {
    const name = custom.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) return;
    if (!ideas.some((i) => i.name === name)) setIdeas([...ideas, { name, note: 'Added by you' }]);
    if (!spec.furniture.includes(name) && spec.furniture.length < MAX_FURNITURE) update({ furniture: [...spec.furniture, name] });
    setCustom('');
  }

  const head = (id: Section, title: string, value: string) => (
    <button type="button" className="gen-head" aria-expanded={open === id} onClick={() => setOpen(open === id ? ('' as Section) : id)}>
      <span className="gen-title">{title}</span>
      <span className="gen-value">{value}</span>
      <Icon name="chevron" size={14} />
    </button>
  );

  const changedParts = concept ? Object.keys(concept.elements).filter((id) => elements.some((e) => e.id === id)).length : 0;

  return (
    <div className="gen">
      <p className="gen-note">
        <Icon name="lock" size={12} /> For empty or unfinished rooms. Walls, windows, doors, ceiling and the camera stay exactly as in the photo.
      </p>

      <section className={`gen-sec${open === 'style' ? ' open' : ''}`}>
        {head('style', 'Style & colours', `${style.label} · ${spec.concepts.length} concept${spec.concepts.length === 1 ? '' : 's'}`)}
        {open === 'style' && (
          <div className="gen-body">
            <div className="style-grid" role="radiogroup" aria-label="Design style">
              {DESIGN_STYLES.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={s.id === style.id} className="style-card" onClick={() => gen.pickStyle(s.id)} title={s.blurb}>
                  <span className="style-swatches" aria-hidden="true">
                    {s.palettes[0].colours.slice(0, 4).map((c) => (
                      <span key={c} style={{ background: c }} />
                    ))}
                  </span>
                  <strong>{s.label}</strong>
                  <small>{s.blurb}</small>
                </button>
              ))}
            </div>
            <span className="field-label">
              Colour combinations <i>one concept each · up to {MAX_CONCEPTS}</i>
            </span>
            <div className="palette-list">
              {style.palettes.map((p) => {
                const on = spec.concepts.some((c) => c.palette === p.id);
                return (
                  <label key={p.id} className={`palette${on ? ' on' : ''}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => togglePalette(p.id)} />
                    <span className="palette-sw" aria-hidden="true">
                      {p.colours.map((c) => (
                        <span key={c} style={{ background: c }} />
                      ))}
                    </span>
                    <span>{p.label}</span>
                    <Icon name={on ? 'check' : 'plus'} size={13} />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className={`gen-sec${open === 'materials' ? ' open' : ''}`}>
        {head('materials', 'Customise materials', `${changedParts} parts set`)}
        {open === 'materials' && concept && (
          <div className="gen-body">
            <div className="variants" aria-label="Concepts">
              {spec.concepts.map((c, i) => (
                <div key={i} className={`variant${i === active ? ' on' : ''}`}>
                  <button type="button" className="variant-pick" aria-pressed={i === active} onClick={() => setActive(i)} title={`${c.name}: ${findPalette(style, c.palette).label}`}>
                    <span className="variant-letter">{i + 1}</span>
                    <span className="variant-dot" style={{ background: findPalette(style, c.palette).colours[0] }} />
                  </button>
                  {spec.concepts.length > 1 && (
                    <button type="button" className="variant-x" aria-label={`Remove ${c.name}`} onClick={() => removeConcept(i)}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </div>
              ))}
              {spec.concepts.length < MAX_CONCEPTS && (
                <button type="button" className="variant-add" onClick={addSame} title="Another concept with the same colours: the AI arranges it differently">
                  <Icon name="plus" size={14} /> Same again
                </button>
              )}
            </div>
            <p className="tab-hint">
              <b>{concept.name}</b> · {palette.label}. Change any part, or set it to “style decides”.
            </p>
            <div className="el-list">
              {elements.map((e) => (
                <ElementEditor
                  key={`${active}-${e.id}`}
                  roomType={roomType}
                  element={e}
                  value={concept.elements[e.id]}
                  open={part === e.id}
                  onToggle={() => setPart(part === e.id ? null : e.id)}
                  onChange={(sel) => setElement(e.id, sel)}
                  siblings={[]}
                  canAddSample={false}
                  samples={false}
                  unsetLabel="Style decides"
                  clearLabel="Let the style decide"
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={`gen-sec${open === 'furniture' ? ' open' : ''}`}>
        {head('furniture', 'Furniture', spec.furniture.length ? `${spec.furniture.length} picked` : 'Style decides')}
        {open === 'furniture' && (
          <div className="gen-body">
            <div className="ideas-head">
              <span className="field-label">{ideasFrom || 'Recommended for this room'}</span>
              <button type="button" className="link" onClick={askIdeas} disabled={loadingIdeas} title="Ideas from the AI that follow your brief (any language)">
                {loadingIdeas ? <span className="spinner" /> : <Icon name="wand" size={13} />} Ideas for my brief
              </button>
            </div>
            <p className="ideas-look">
              <b>{style.label} look:</b> {style.furnitureLook}, in the {palette.label.toLowerCase()} colours.
            </p>
            {ideasError && <p className="pbar-error">{ideasError}</p>}
            <ul className="ideas">
              {ideas.map((i) => {
                const on = spec.furniture.includes(i.name);
                return (
                  <li key={i.name}>
                    <label className={on ? 'on' : ''}>
                      <input type="checkbox" checked={on} onChange={() => toggleFurniture(i.name)} disabled={!on && spec.furniture.length >= MAX_FURNITURE} />
                      <span>
                        <b>{i.name}</b>
                        {i.note && <small>{i.note}</small>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="add-row">
              <input className="text-input" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} placeholder='Add your own, e.g. "jhula swing"' maxLength={80} />
              <button type="button" className="btn btn-sm" onClick={addCustom} disabled={!custom.trim()}>
                <Icon name="plus" size={14} /> Add
              </button>
            </div>
            <p className="step-note">Nothing ticked: the AI adds what the room needs. Up to {MAX_FURNITURE} pieces.</p>
          </div>
        )}
      </section>

      <section className={`gen-sec${open === 'brief' ? ' open' : ''}`}>
        {head('brief', 'Brief & light', spec.brief ? 'Brief added' : MOODS.find((m) => m.id === spec.mood)?.label ?? 'As in photo')}
        {open === 'brief' && (
          <div className="gen-body">
            <div className="notes">
              <label className="field-label" htmlFor="gen-brief">
                Brief <i>optional · any language</i>
                <span className="notes-count">
                  {spec.brief.length} / {NOTES_MAX}
                </span>
              </label>
              <PromptBar
                id="gen-brief"
                label="Design brief"
                multiline
                value={spec.brief}
                onChange={(brief) => update({ brief })}
                placeholder='e.g. "family of four, kids play area near the window, lots of storage"'
                maxLength={NOTES_MAX}
                context={{ kind: 'note', roomType }}
              />
            </div>
            <div className="field">
              <span className="field-label">Lighting</span>
              <div className="opts">
                {MOODS.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={spec.mood === m.id} className="opt" onClick={() => update({ mood: m.id })}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
