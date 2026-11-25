import { useState } from 'react';
import type { RoomTypeId } from '@shared/catalog';
import { DESIGN_STYLES, findPalette } from '@shared/styles';
import { generate as generateApi } from '../../../api/studio';
import { revokeImages, toBlobUrls } from '../../../lib/download';
import { toDataUrl } from '../../../lib/image';
import { startGenerate, type GenerateState } from '../model/generate';
import { describeOption, newId, type ConceptStep } from '../model/steps';
import type { Session } from './useSession';

// Generate: an empty or unfinished room photo → 1–4 designed concepts in a style.
// Each concept is one of the style's colour combinations, which staff can
// customise part by part. The AI keeps the room's walls, windows, doors and
// camera; generating again replaces the last set of concepts.

export type Generate = ReturnType<typeof useGenerate>;

export function useGenerate(session: Session, roomType: RoomTypeId) {
  const { photo, busy, last } = session;
  const [spec, setSpec] = useState<GenerateState>(() => startGenerate(DESIGN_STYLES[0].id, roomType));
  const [active, setActive] = useState(0);
  const replaces = last?.kind === 'concept';
  const style = DESIGN_STYLES.find((s) => s.id === spec.style) ?? DESIGN_STYLES[0];
  const canGenerate = Boolean(photo) && !busy && spec.concepts.length > 0;

  function run(state: GenerateState, base: string, replace: boolean) {
    if (!photo || busy) return;
    void session.track({ kind: 'concept', label: style.label, count: state.concepts.length, base }, async (stillHere) => {
      const response = await generateApi({ image: await toDataUrl(base), width: photo.width, height: photo.height, roomType, ...state });
      const variations = await toBlobUrls(response.concepts);
      if (!stillHere()) return revokeImages(variations);
      const chosen = variations.findIndex((v) => v.image);
      const failed = variations.filter((v) => !v.image);
      if (chosen < 0) {
        revokeImages(variations);
        throw new Error(failed[0]?.error ?? 'No concept could be made. Please try again.');
      }
      const v = variations[chosen];
      const step: ConceptStep = {
        kind: 'concept',
        id: newId(),
        spec: structuredClone(state),
        variations,
        chosen,
        before: base,
        image: v.image!,
        ...describeOption(v),
        palette: paletteFor(state, chosen),
        prompt: v.prompt,
        ms: v.ms,
      };
      session.commit(step, replace);
      if (failed.length) session.setError(`${failed.map((f) => f.label).join(', ')} didn't work: ${failed[0].error ?? 'no image was returned'}`);
    });
  }

  function paletteFor(state: GenerateState, index: number): string[] {
    const s = DESIGN_STYLES.find((x) => x.id === state.style);
    return s ? findPalette(s, state.concepts[index]?.palette).colours : [];
  }

  return {
    spec,
    setSpec,
    style,
    active,
    setActive,
    replaces,
    canGenerate,
    /** A new style starts again from its combinations; the furniture, brief and light stay. */
    pickStyle(id: string) {
      setSpec((s) => startGenerate(id, roomType, s));
      setActive(0);
    },
    /** A different room type changes which parts exist: refill the concepts. */
    fitRoom(room: RoomTypeId) {
      setSpec((s) => startGenerate(s.style, room, s));
      setActive(0);
    },
    generate() {
      if (!canGenerate) return;
      run(spec, replaces ? last!.before : session.current, replaces);
    },
    /** Uses another concept of the last set. Concepts share the image they were made from. */
    choose(index: number) {
      if (last?.kind !== 'concept' || busy) return;
      const v = last.variations[index];
      if (!v?.image) return;
      session.replaceLast({ ...last, chosen: index, image: v.image, ...describeOption(v), palette: paletteFor(last.spec, index), prompt: v.prompt, ms: v.ms });
    },
    retry(step: ConceptStep) {
      run(step.spec, step.before, true);
    },
    restore(step: ConceptStep) {
      setSpec(step.spec);
      setActive(Math.min(step.chosen, step.spec.concepts.length - 1));
    },
  };
}
