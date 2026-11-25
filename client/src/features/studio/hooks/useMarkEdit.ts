import { useMemo, useState } from 'react';
import { ELEMENTS, describeSelection, elementsFor, resolveSelection, type RoomTypeId } from '@shared/catalog';
import { editImage } from '../../../api/studio';
import { toDataUrl } from '../../../lib/image';
import type { ChangeRequest } from '../components/ChangePanel';
import type { Tool } from '../components/MaskEditor';
import { pasteBack } from '../lib/composite';
import { maskStats } from '../lib/mask';
import { EMPTY_DRAFT, newId, type Draft, type MarkChange, type MarkStep } from '../model/steps';
import type { Session } from './useSession';

// Mark & edit: pick a part, mark it, choose the change. The AI redraws the whole
// photo, and the browser pastes back only the marked area (lib/composite.ts).

export type MarkEdit = ReturnType<typeof useMarkEdit>;

export function useMarkEdit(session: Session, roomType: RoomTypeId) {
  const { photo, steps, busy } = session;
  // The next change being set up.
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushPct, setBrushPct] = useState(3);

  const element = elementsFor(roomType).find((e) => e.id === draft.part) ?? null;
  const marked = useMemo(() => (photo ? maskStats(draft.ops, photo.width, photo.height) : { coverage: 0, box: null }), [draft.ops, photo]);
  // Parts already changed in this session (either mode), ticked in the part list.
  const done = useMemo(
    () =>
      new Set(
        steps.flatMap((s) =>
          s.kind === 'mark' ? (s.part ? [s.part] : []) : Object.keys((s.kind === 'design' ? s.design.variants[s.chosen] : s.spec.concepts[s.chosen])?.elements ?? {}),
        ),
      ),
    [steps],
  );
  const hint = !marked.box
    ? draft.action === 'remove'
      ? 'Paint over the object to remove, including its shadow.'
      : draft.action === 'add'
        ? 'Mark where the new object should go.'
        : element
          ? `Mark the ${element.label.toLowerCase()} on the photo.`
          : 'Pick the part to change, then mark it on the photo.'
    : draft.action === 'remove'
      ? 'Press “Remove it” to take the marked object away.'
      : draft.action === 'add' && !draft.reference
        ? 'Say what to add, then press →.'
        : draft.reference
      ? 'Press → to put the item from your photo in the marked area.'
      : element
        ? 'Click a change above to make it.'
        : 'Pick the part, or describe the change in your own words.';

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    session.setView('edit');
  }

  function pickTool(next: Tool) {
    setTool(next);
    session.setView('edit');
  }

  /** Sends one change to the AI and pastes back only the marked area. */
  function run(change: MarkChange, base: string, replace: boolean) {
    if (!photo || busy) return;
    const removing = change.action === 'remove';
    const el = change.part && !removing ? (ELEMENTS.find((e) => e.id === change.part) ?? null) : null;
    const resolved = el && change.finish && change.action === 'change' ? resolveSelection(el, change.finish) : null;
    const text = resolved ? '' : (change.text ?? '').trim();
    const reference = resolved || removing ? undefined : change.reference;
    const box = maskStats(change.ops, photo.width, photo.height).box;
    if (!box || (!removing && !resolved && !text && !reference)) return;
    const label = removing ? 'Removed' : reference ? (el ? `${el.label} from photo` : 'Item from photo') : change.action === 'add' ? 'Added' : (el?.label ?? 'Marked area');
    const title = removing ? 'Removing the marked object…' : reference ? 'Putting the item from your photo in place…' : change.action === 'add' ? 'Adding it to the marked area…' : undefined;

    void session.track({ kind: 'mark', label, title, count: 1, base }, async (stillHere) => {
      const response = await editImage({
        image: await toDataUrl(base),
        width: photo.width,
        height: photo.height,
        roomType,
        part: el?.id,
        finish: resolved ? change.finish : undefined,
        text: text || undefined,
        reference,
        area: box,
        action: resolved ? 'change' : change.action,
      });
      const image = await pasteBack(base, response.image, change.ops, photo.width, photo.height);
      if (!stillHere()) return URL.revokeObjectURL(image);
      const spec = resolved
        ? describeSelection(resolved)
        : { value: text ? `“${text}”` : removing ? 'The marked object' : 'Placed from the photo', hex: undefined };
      session.commit(
        {
          kind: 'mark',
          id: newId(),
          part: el?.id ?? null,
          finish: resolved ? change.finish : undefined,
          text: text || undefined,
          reference,
          ops: change.ops,
          action: resolved ? 'change' : change.action,
          before: base,
          image,
          label,
          value: spec.value,
          hex: spec.hex,
          prompt: response.prompt,
          ms: response.ms,
        },
        replace,
      );
      if (!replace) setDraft(EMPTY_DRAFT);
    });
  }

  /** A suggestion, the custom finish, typed words or an item photo, on the marked area. */
  function apply(req: ChangeRequest) {
    run({ part: draft.part, finish: req.finish, text: req.text, reference: req.reference, ops: draft.ops, action: req.action ?? draft.action }, session.current, false);
  }

  /** Ctrl+Enter: the custom finish if it is complete, else the typed words or item photo. */
  function applyFromKeyboard() {
    if (draft.action === 'remove') apply({ text: draft.text, action: 'remove' });
    else if (draft.action === 'change' && draft.finish && element && resolveSelection(element, draft.finish)) apply({ finish: draft.finish });
    else if (draft.text.trim() || draft.reference) apply({ text: draft.text, reference: draft.reference?.dataUrl });
  }

  /** Makes the change again from the same starting image: the AI gives a different result each time. */
  function retry(step: MarkStep) {
    run({ part: step.part, finish: step.finish, text: step.text, reference: step.reference, ops: step.ops, action: step.action }, step.before, true);
  }

  /** Puts an undone change's settings back in the panel, ready to adjust. */
  function restore(step: MarkStep) {
    setDraft({ part: step.part, finish: step.finish, text: step.text ?? '', reference: step.reference ? { dataUrl: step.reference, name: 'item' } : undefined, ops: step.ops, action: step.action });
  }

  /** Parts differ per room: drop a picked part that `room` doesn't have. */
  function fitRoom(room: RoomTypeId) {
    if (draft.part && !elementsFor(room).some((e) => e.id === draft.part)) setDraft((d) => ({ ...d, part: null, finish: undefined }));
  }

  /** Ctrl+Z: takes back the last brush stroke. Applied changes have their own Undo button. */
  function undoStroke(): boolean {
    if (!draft.ops.length || busy) return false;
    update({ ops: draft.ops.slice(0, -1) });
    return true;
  }

  return {
    draft,
    update,
    reset: () => setDraft(EMPTY_DRAFT),
    tool,
    pickTool,
    brushPct,
    setBrushPct,
    element,
    marked,
    done,
    hint,
    apply,
    applyFromKeyboard,
    retry,
    restore,
    fitRoom,
    undoStroke,
  };
}
