import { useEffect, useRef, useState } from 'react';
import {
  INSTRUCTION_MAX,
  describeSelection,
  elementsFor,
  resolveSelection,
  suggestionsFor,
  type Material,
  type RoomElement,
  type RoomTypeId,
  type Selection,
} from '../../../../shared/catalog';
import type { Draft } from '../../lib/change';
import { ITEM_MAX_SIDE, prepareImage } from '../../lib/image';
import type { MaskStats } from '../../lib/mask';
import { FileDrop } from '../ui/FileDrop';
import { Icon } from '../ui/Icon';
import { PromptBar } from './PromptBar';

export interface ChangeRequest {
  finish?: Selection;
  text?: string;
  /** Item photo (data URL) to put in the marked area. */
  reference?: string;
}

interface Props {
  roomType: RoomTypeId;
  draft: Draft;
  onDraft: (patch: Partial<Draft>) => void;
  marked: MaskStats;
  /** Parts already changed in this session, to tick them in the list. */
  done: ReadonlySet<string>;
  busy: boolean;
  /** Make the change now, on the marked area. */
  onApply: (change: ChangeRequest) => void;
}

/**
 * Mark & edit, in three steps: which part, where it is on the photo, and the
 * change. Once the area is marked, the changes for that part show as prompts;
 * one click makes it. Nothing outside the mark is touched.
 */
export function ChangePanel({ roomType, draft, onDraft, marked, done, busy, onApply }: Props) {
  const elements = elementsFor(roomType);
  const element = elements.find((e) => e.id === draft.part) ?? null;
  const resolved = element && draft.finish ? resolveSelection(element, draft.finish) : null;
  const [custom, setCustom] = useState(false);
  const [attachError, setAttachError] = useState('');
  const isMarked = Boolean(marked.box);
  const changeRef = useRef<HTMLElement>(null);
  const ownRef = useRef<HTMLDivElement>(null);
  const hasItem = Boolean(draft.reference);

  // On a laptop the panel scrolls on its own: bring the prompts into view once there is a mark.
  useEffect(() => {
    if (isMarked && window.matchMedia('(min-width: 901px)').matches) changeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isMarked, draft.part]);

  // An attached item photo: show it and the button that places it.
  useEffect(() => {
    if (hasItem && window.matchMedia('(min-width: 901px)').matches) ownRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hasItem]);

  // Moving to another part keeps the custom finish when it has the same material ("wall cabinets like the base").
  function pickPart(e: RoomElement) {
    const keep = draft.finish && e.materials.some((m) => m.id === draft.finish!.material);
    onDraft({ part: e.id, finish: keep ? draft.finish : undefined });
  }

  const text = draft.text.trim();
  const item = draft.reference;
  const canPlace = !busy && Boolean(text || item);

  async function attach(file: File) {
    setAttachError('');
    try {
      const img = await prepareImage(file, ITEM_MAX_SIDE);
      onDraft({ reference: { dataUrl: img.dataUrl, name: file.name } });
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Could not read this photo.');
    }
  }

  return (
    <div className="steps">
      <section className="step">
        <h2 className="step-title">
          <span className="step-num">1</span> Part to change
        </h2>
        <div className="parts" role="radiogroup" aria-label="Part to change">
          {elements.map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={e.id === draft.part} className="part" onClick={() => pickPart(e)}>
              <span>{e.label}</span>
              {done.has(e.id) && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      </section>

      <section className="step">
        <h2 className="step-title">
          <span className="step-num">2</span> Mark it on the photo
        </h2>
        {isMarked ? (
          <p className="step-done">
            <Icon name="check" size={14} /> Marked · {Math.max(1, Math.round(marked.coverage * 100))}% of the photo
            <button type="button" className="link" onClick={() => onDraft({ ops: [] })}>
              <Icon name="x" size={12} /> Clear
            </button>
          </p>
        ) : (
          <p className="step-hint">
            Paint over {element ? `the ${element.label.toLowerCase()}` : 'the part'} with the <b>Brush</b>, or click its corners with <b>Corners</b>.
          </p>
        )}
        <p className="step-note">
          <Icon name="lock" size={12} /> Only the marked area changes. The rest stays exactly as in the photo.
        </p>
      </section>

      <section ref={changeRef} className={`step${isMarked ? '' : ' step-off'}`} aria-label="Pick a change">
        <h2 className="step-title">
          <span className="step-num">3</span> Pick a change
        </h2>

        {!isMarked ? (
          <p className="step-hint">
            Mark the area first. {element ? `Changes for the ${element.label.toLowerCase()}` : 'The changes'} show here; one click makes it. To add an item from a photo
            (a sofa, a light), mark where it should go.
          </p>
        ) : (
          <>
            {element ? (
              <div className="prompts" role="group" aria-label={`Changes for the ${element.label.toLowerCase()}`}>
                {suggestionsFor(element).map((s) => (
                  <div key={s.label} className="prompt-row">
                    <button type="button" className="prompt" disabled={busy} onClick={() => onApply({ finish: s.selection })} title={`Change the marked ${element.label.toLowerCase()} to ${s.label}`}>
                      <span className="prompt-dot" style={s.hex ? { background: s.hex } : undefined} aria-hidden="true" />
                      <span className="prompt-text">{s.label}</span>
                      <Icon name="arrow" size={14} />
                    </button>
                    <button
                      type="button"
                      className="prompt-adjust"
                      disabled={busy}
                      onClick={() => {
                        onDraft({ finish: { ...s.selection, details: draft.finish?.details } });
                        setCustom(true);
                      }}
                      title="Adjust: open it in Custom finish to change the shade or add details"
                    >
                      <Icon name="sliders" size={14} />
                      <span className="sr-only">Adjust {s.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="step-hint">Pick the part above to see ready changes for it, or describe the change below.</p>
            )}

            {element && (
              <div className={`custom${custom ? ' open' : ''}`}>
                <button type="button" className="custom-head" aria-expanded={custom} onClick={() => setCustom(!custom)}>
                  <Icon name="sliders" size={14} /> Custom finish
                  {resolved && <b className="step-value">{describeSelection(resolved).value}</b>}
                  <Icon name="chevron" size={14} />
                </button>
                {custom && (
                  <div className="custom-body">
                    <FinishPicker key={element.id} element={element} value={draft.finish} onChange={(finish) => onDraft({ finish })} />
                    {resolved && (
                      <div className="field">
                        <label className="field-label" htmlFor="custom-details">
                          Details <i>optional · any language</i>
                        </label>
                        <PromptBar
                          id="custom-details"
                          label={`Details for the ${element.label.toLowerCase()}`}
                          value={draft.finish?.details ?? ''}
                          onChange={(details) => onDraft({ finish: { ...draft.finish!, details } })}
                          placeholder='e.g. "fluted grooves, gold edge on top"'
                          maxLength={INSTRUCTION_MAX}
                          context={{ kind: 'details', roomType, part: element.id, finish: draft.finish }}
                        />
                      </div>
                    )}
                    <button type="button" className="btn btn-sm btn-block" disabled={busy || !resolved} onClick={() => onApply({ finish: draft.finish })}>
                      <Icon name="sparkle" size={15} /> Apply custom finish
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="field own-words" ref={ownRef}>
              <div className="own-head">
                <label className="field-label" htmlFor="own-words">
                  {item ? 'Item from your photo' : element ? 'Or in your own words' : 'Describe the change'} <i>any language</i>
                </label>
                {!item && (
                  <FileDrop onFile={attach} className="attach">
                    <Icon name="photo" size={13} /> Item photo
                  </FileDrop>
                )}
              </div>
              {item && (
                <div className="attached">
                  <img src={item.dataUrl} alt="The item to put in the marked area" />
                  <span>
                    <b>Goes into the marked area.</b> Mark a little more than the space it needs; add words if you like.
                  </span>
                  <button type="button" className="link" onClick={() => onDraft({ reference: undefined })}>
                    <Icon name="x" size={12} /> Remove
                  </button>
                </div>
              )}
              {attachError && <p className="pbar-error">{attachError}</p>}
              <PromptBar
                id="own-words"
                label={item ? 'Words for placing the item' : 'Describe the change in your own words'}
                value={draft.text}
                onChange={(text) => onDraft({ text })}
                placeholder={item ? 'optional, e.g. "facing the TV, against the wall"' : element ? 'e.g. "light grey with fluted grooves"' : 'e.g. "remove the bottles from the counter"'}
                maxLength={INSTRUCTION_MAX}
                context={{ kind: 'change', roomType, part: element?.id }}
                onSubmit={() => canPlace && onApply({ text, reference: item?.dataUrl })}
                submitDisabled={!canPlace}
                submitTitle={item ? 'Put the item in the marked area' : 'Make this change on the marked area'}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

interface FinishProps {
  element: RoomElement;
  value: Selection | undefined;
  onChange: (next: Selection) => void;
}

function FinishPicker({ element, value, onChange }: FinishProps) {
  const material = element.materials.find((m) => m.id === value?.material);

  function pickMaterial(m: Material) {
    onChange({
      material: m.id,
      shade: m.shades?.find((s) => s.id === value?.shade)?.id ?? m.shades?.[0]?.id,
      colour: m.custom ? value?.colour : undefined,
      finish: m.finishes?.find((f) => f.id === value?.finish)?.id ?? m.finishes?.[0]?.id,
      details: value?.details,
    });
  }

  const set = (patch: Partial<Selection>) => value && onChange({ ...value, ...patch });
  const shade = material?.shades?.find((s) => s.id === value?.shade);

  return (
    <>
      <div className="opts" role="radiogroup" aria-label={`${element.label} material`}>
        {element.materials.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={m.id === material?.id} className="opt" onClick={() => pickMaterial(m)}>
            {m.label}
          </button>
        ))}
      </div>

      {material?.shades && (
        <div className="field">
          <span className="field-label">
            {material.shadeLabel ?? 'Colour'} <b>{value?.colour ? `Custom ${value.colour}` : shade?.label}</b>
          </span>
          <div className="swatches" role="radiogroup" aria-label={material.shadeLabel ?? 'Colour'}>
            {material.shades.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={!value?.colour && s.id === value?.shade}
                aria-label={s.label}
                title={s.label}
                className="sw"
                style={{ background: s.hex }}
                onClick={() => set({ shade: s.id, colour: undefined })}
              />
            ))}
            {material.custom && (
              <label className={`sw sw-custom${value?.colour ? ' on' : ''}`} title="Any colour (from a shade card)" style={value?.colour ? { background: value.colour } : undefined}>
                <input
                  type="color"
                  className="sr-only"
                  value={value?.colour ?? shade?.hex ?? '#888888'}
                  onChange={(e) => set({ colour: e.target.value.toUpperCase() })}
                />
                {!value?.colour && <Icon name="plus" size={12} />}
              </label>
            )}
          </div>
        </div>
      )}

      {material?.finishes && (
        <div className="field">
          <span className="field-label">{material.finishLabel ?? 'Finish'}</span>
          <div className="opts" role="radiogroup" aria-label={material.finishLabel ?? 'Finish'}>
            {material.finishes.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={f.id === value?.finish} className="opt" onClick={() => set({ finish: f.id })}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
