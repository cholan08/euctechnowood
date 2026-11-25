import { useState } from 'react';
import { INSTRUCTION_MAX, areaLabel, describeSelection, resolveSelection, type Material, type RoomElement, type RoomTypeId, type Selection } from '@shared/catalog';
import { isHex } from '@shared/colour';
import { prepareImage, SAMPLE_MAX_SIDE } from '../../../lib/image';
import { FileDrop } from '../../../components/ui/FileDrop';
import { Icon } from '../../../components/ui/Icon';
import { PromptBar } from './PromptBar';

interface Props {
  roomType: RoomTypeId;
  element: RoomElement;
  value: Selection | undefined;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Selection | undefined) => void;
  /** Other changed parts of this option whose spec could be copied here ("Same as base cabinets"). */
  siblings: { element: RoomElement; value: Selection }[];
  /** Shown when there is more than one option. */
  onApplyAll?: () => void;
  /** Start picking this part's position on the image. Without it, "Where" is not offered. */
  onPickArea?: () => void;
  /** This part's position is being picked on the image right now. */
  picking?: boolean;
  /** False when the option already has the most sample photos one edit can take. */
  canAddSample: boolean;
  /** Offer a material sample photo (Standard). Default true. */
  samples?: boolean;
  /** What an unset part reads: "As in image" (Standard) or "Style decides" (Generate). */
  unsetLabel?: string;
  /** The button that unsets the part. */
  clearLabel?: string;
}

/**
 * One part of the room. Collapsed it reads "Locked · as in image" or its spec;
 * open it is a spec editor: material, shade or custom colour, sheen, shutter design.
 */
export function ElementEditor(props: Props) {
  const { roomType, element, value, open, onToggle, onChange, siblings, onApplyAll, onPickArea, picking = false, canAddSample } = props;
  const { samples = true, unsetLabel = 'As in image', clearLabel = 'Lock to original' } = props;
  const resolved = value ? resolveSelection(element, value) : null;
  const spec = resolved ? describeSelection(resolved) : null;
  const material = resolved?.material;
  const bodyId = `el-${element.id}`;

  function pickMaterial(m: Material) {
    const shade = m.shades?.find((s) => s.id === value?.shade)?.id ?? m.shades?.[0]?.id;
    const finish = m.finishes?.find((f) => f.id === value?.finish)?.id ?? m.finishes?.[0]?.id;
    onChange({
      material: m.id,
      shade,
      colour: m.custom ? value?.colour : undefined,
      finish,
      profile: value?.profile,
      sample: m.shades ? value?.sample : undefined,
      area: value?.area,
      details: value?.details,
    });
  }

  const set = (patch: Partial<Selection>) => value && onChange({ ...value, ...patch });

  const copyable = siblings.filter((s) => element.materials.some((m) => m.id === s.value.material));

  return (
    <div className={`el${resolved ? ' changed' : ''}${open ? ' open' : ''}`}>
      <button type="button" className="el-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        {spec ? (
          <span className="el-dot" style={spec.hex ? { background: spec.hex } : undefined} aria-hidden="true">
            {!spec.hex && <Icon name="check" size={11} />}
          </span>
        ) : (
          <span className="el-dot locked" aria-hidden="true">
            <Icon name="lock" size={11} />
          </span>
        )}
        <span className="el-name">{element.label}</span>
        <span className="el-value">{spec ? spec.value : unsetLabel}</span>
        <Icon name="chevron" size={14} />
      </button>

      {open && (
        <div className="el-body" id={bodyId}>
          {copyable.length > 0 && (
            <div className="field">
              <span className="field-label">Same as</span>
              <div className="opts">
                {copyable.map((s) => (
                  <button
                    key={s.element.id}
                    type="button"
                    className="opt"
                    onClick={() =>
                      onChange({
                        ...s.value,
                        profile: element.profiles?.some((p) => p.id === s.value.profile) ? s.value.profile : undefined,
                        area: value?.area,
                      })
                    }
                  >
                    <Icon name="copy" size={12} /> {s.element.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field-label">Material</span>
            <div className="opts" role="radiogroup" aria-label={`${element.label} material`}>
              {element.materials.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={m.id === material?.id} className="opt" onClick={() => pickMaterial(m)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {!material && <p className="el-hint">Pick a material to change this part. Until then it reads “{unsetLabel.toLowerCase()}”.</p>}

          {material?.shades && !value?.sample && (
            <ShadePicker material={material} shade={value?.shade} colour={value?.colour} onShade={(shade) => set({ shade, colour: undefined })} onColour={(colour) => set({ colour })} />
          )}

          {material?.finishes && (
            <div className="field">
              <span className="field-label">{material.finishLabel ?? 'Finish'}</span>
              <div className="opts">
                {material.finishes.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={f.id === value?.finish} className="opt" onClick={() => set({ finish: f.id })}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {material && element.profiles && (
            <div className="field">
              <span className="field-label">Shutter design</span>
              <div className="opts">
                <button type="button" role="radio" aria-checked={!value?.profile} className="opt" onClick={() => set({ profile: undefined })}>
                  Keep current
                </button>
                {element.profiles.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.id === value?.profile} className="opt" onClick={() => set({ profile: p.id })}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {samples && material?.shades && <SampleField sample={value?.sample} canAdd={canAddSample} onSample={(sample) => set({ sample })} />}

          {material && (
            <div className="field">
              <label className="field-label" htmlFor={`${bodyId}-details`}>
                Details <i>optional · any language</i>
              </label>
              <PromptBar
                id={`${bodyId}-details`}
                label={`Details for the ${element.label.toLowerCase()}`}
                value={value?.details ?? ''}
                onChange={(details) => set({ details })}
                placeholder='e.g. "fluted grooves, gold edge on top"'
                maxLength={INSTRUCTION_MAX}
                context={{ kind: 'details', roomType, part: element.id, finish: value }}
              />
            </div>
          )}

          {material && onPickArea && (
            <div className="field">
              <span className="field-label">Where</span>
              <div className="opts" role="radiogroup" aria-label={`Which ${element.label.toLowerCase()} to change`}>
                <button type="button" role="radio" aria-checked={!value?.area && !picking} className="opt" onClick={() => set({ area: undefined })}>
                  All in the image
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={Boolean(value?.area) || picking}
                  className="opt"
                  onClick={onPickArea}
                  title="Change only one of them: click where it is on the image"
                >
                  <Icon name="pin" size={12} /> {picking ? 'Click on the image…' : value?.area ? `Only at ${areaLabel(value.area)}` : 'Only one: pick on image'}
                </button>
              </div>
            </div>
          )}

          {resolved && (
            <div className="el-actions">
              <button type="button" className="link" onClick={() => onChange(undefined)}>
                <Icon name="lock" size={13} /> {clearLabel}
              </button>
              {onApplyAll && (
                <button type="button" className="link" onClick={onApplyAll}>
                  <Icon name="copy" size={13} /> Use in all options
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A photo of the real laminate, tile or slab. The AI matches it instead of a named shade. */
function SampleField({ sample, canAdd, onSample }: { sample?: string; canAdd: boolean; onSample: (dataUrl: string | undefined) => void }) {
  const [error, setError] = useState('');

  async function pick(file: File) {
    setError('');
    try {
      onSample((await prepareImage(file, SAMPLE_MAX_SIDE)).dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this photo.');
    }
  }

  return (
    <div className="field">
      <span className="field-label">
        Match a sample <i>optional</i>
      </span>
      {sample ? (
        <div className="sample">
          <img src={sample} alt="Material sample" />
          <span>The colour, pattern and grain come from this photo.</span>
          <button type="button" className="link" onClick={() => onSample(undefined)}>
            <Icon name="x" size={12} /> Remove sample
          </button>
        </div>
      ) : canAdd ? (
        <FileDrop onFile={pick} className="sample-drop">
          <Icon name="photo" size={15} /> Photo of the laminate, tile or slab
        </FileDrop>
      ) : (
        <p className="el-hint">This option already has the maximum number of sample photos.</p>
      )}
      {error && <p className="el-hint el-error">{error}</p>}
    </div>
  );
}

interface ShadeProps {
  material: Material;
  shade?: string;
  colour?: string;
  onShade: (id: string) => void;
  onColour: (hex: string) => void;
}

function ShadePicker({ material, shade, colour, onShade, onColour }: ShadeProps) {
  const current = material.shades?.find((s) => s.id === shade);
  const [draft, setDraft] = useState('');
  const label = colour ? `Custom ${colour.toUpperCase()}` : (current?.label ?? '');

  return (
    <div className="field">
      <span className="field-label">
        {material.shadeLabel ?? 'Colour'} <b>{label}</b>
      </span>
      <div className="swatches">
        {material.shades!.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={!colour && s.id === shade}
            aria-label={s.label}
            title={s.label}
            className="sw"
            style={{ background: s.hex }}
            onClick={() => onShade(s.id)}
          />
        ))}
        {material.custom && (
          <label className={`sw sw-custom${colour ? ' on' : ''}`} title="Custom colour" style={colour ? { background: colour } : undefined}>
            <input type="color" className="sr-only" value={colour ?? current?.hex ?? '#888888'} onChange={(e) => onColour(e.target.value.toUpperCase())} />
            {!colour && <Icon name="plus" size={12} />}
          </label>
        )}
      </div>
      {material.custom && (
        <input
          className="hex-input"
          placeholder="#HEX from the shade card"
          maxLength={7}
          value={draft}
          aria-label="Custom colour hex code"
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setDraft(e.target.value);
            if (isHex(v)) onColour(v.toUpperCase());
          }}
        />
      )}
    </div>
  );
}
