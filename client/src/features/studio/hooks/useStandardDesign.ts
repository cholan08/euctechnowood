import { useEffect, useState } from 'react';
import { elementsFor, type Point, type RoomTypeId } from '@shared/catalog';
import { redesign } from '../../../api/studio';
import { revokeImages, toBlobUrls } from '../../../lib/download';
import { toDataUrl } from '../../../lib/image';
import { countVariant, EMPTY_DESIGN, type DesignState } from '../model/design';
import { describeOption, newId, type DesignStep, type Mode } from '../model/steps';
import type { Session } from './useSession';

// Standard: a spec for the whole room with options A–D; the AI redraws the whole
// image once per option. Generating again replaces the last Standard design.

export type StandardDesign = ReturnType<typeof useStandardDesign>;

export function useStandardDesign(session: Session, roomType: RoomTypeId, mode: Mode) {
  const { photo, busy, last } = session;
  const [design, setDesign] = useState<DesignState>(EMPTY_DESIGN);
  // Which option the panel edits, and a part whose position is being picked on the image.
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);

  const counts = design.variants.map((v) => countVariant(v, roomType));
  const activeCount = counts[active] ?? counts[0];
  const editing = design.variants[active] ?? design.variants[0];
  // A render with no changes is still a job: "make it photoreal". A photo needs at least one change per option.
  const emptyOption = design.source === 'photo' ? design.variants.find((_, i) => counts[i].total === 0) : undefined;
  const optionCount = design.variants.length;
  const generateLabel =
    design.source === 'render' && counts.every((c) => c.total === 0) ? 'Make it photoreal' : optionCount > 1 ? `Generate ${optionCount} options` : 'Generate design';
  const replacesDesign = last?.kind === 'design';
  const canGenerate = Boolean(photo) && !busy && !emptyOption;
  const pickingLabel = picking ? (elementsFor(roomType).find((e) => e.id === picking)?.label ?? null) : null;

  // Parts of the option being edited that are pinned to one place in the image.
  const markers =
    mode === 'standard'
      ? elementsFor(roomType).flatMap((e) => {
          const area = editing.elements[e.id]?.area;
          return area ? [{ id: e.id, label: e.label, ...area }] : [];
        })
      : [];

  // Picking belongs to one part of one option in one image: stop it when any of those change.
  useEffect(() => setPicking(null), [active, roomType, photo, mode]);

  function run(spec: DesignState, base: string, replace: boolean) {
    if (!photo || busy) return;
    void session.track({ kind: 'design', label: '', count: spec.variants.length, base }, async (stillHere) => {
      const response = await redesign({ image: await toDataUrl(base), width: photo.width, height: photo.height, roomType, ...spec });
      const variations = await toBlobUrls(response.variations);
      if (!stillHere()) return revokeImages(variations);
      const chosen = variations.findIndex((v) => v.image);
      const failed = variations.filter((v) => !v.image);
      if (chosen < 0) {
        revokeImages(variations);
        throw new Error(failed[0]?.error ?? 'No design could be made. Please try again.');
      }
      const v = variations[chosen];
      const step: DesignStep = {
        kind: 'design',
        id: newId(),
        design: structuredClone(spec),
        variations,
        chosen,
        before: base,
        image: v.image!,
        ...describeOption(v),
        prompt: v.prompt,
        ms: v.ms,
      };
      session.commit(step, replace);
      if (failed.length) session.setError(`${failed.map((f) => f.label).join(', ')} didn't work: ${failed[0].error ?? 'no image was returned'}`);
    });
  }

  function generate() {
    if (!canGenerate) return;
    setPicking(null);
    const base = replacesDesign ? last!.before : session.current;
    run(design, base, replacesDesign);
  }

  /** Uses another option of the last design. Options share the image they were made from. */
  function choose(index: number) {
    if (last?.kind !== 'design' || busy) return;
    const v = last.variations[index];
    if (!v?.image) return;
    session.replaceLast({ ...last, chosen: index, image: v.image, ...describeOption(v), prompt: v.prompt, ms: v.ms });
    setActive(Math.min(index, design.variants.length - 1));
  }

  function retry(step: DesignStep) {
    run(step.design, step.before, true);
  }

  /** Puts an undone design's spec back in the panel. */
  function restore(step: DesignStep) {
    setDesign(step.design);
    setActive(Math.min(step.chosen, step.design.variants.length - 1));
  }

  /** "Only this one": the next click on the image sets where this part is. */
  function startPicking(elementId: string) {
    setPicking(elementId);
    session.setView('edit');
    session.scrollToImageOnPhone();
  }

  function placeArea(area: Point) {
    const id = picking;
    setPicking(null);
    if (!id) return;
    setDesign((d) => ({
      ...d,
      variants: d.variants.map((v, i) => (i === active && v.elements[id] ? { ...v, elements: { ...v.elements, [id]: { ...v.elements[id], area } } } : v)),
    }));
  }

  return {
    design,
    setDesign,
    setSource: (source: DesignState['source']) => setDesign((d) => ({ ...d, source })),
    /** A new photo keeps the photo/render choice and clears the rest. */
    reset: () => {
      setDesign((d) => ({ ...EMPTY_DESIGN, source: d.source }));
      setActive(0);
    },
    active,
    setActive,
    editing,
    activeCount,
    optionCount,
    emptyOption,
    generateLabel,
    replacesDesign,
    canGenerate,
    markers,
    picking,
    pickingLabel,
    cancelPicking: () => setPicking(null),
    startPicking,
    placeArea,
    generate,
    choose,
    retry,
    restore,
  };
}
