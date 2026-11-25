import { useEffect, useRef } from 'react';
import { DESIGN_STYLES, findPalette } from '@shared/styles';
import type { ImageKind } from '@shared/workspace';
import { rooms } from '../../../api/workspace';
import { stepLines, type ChangeLine, type Step } from '../model/steps';
import type { Session } from './useSession';

// In a project room, every result is stored in the room's image history as soon
// as it is made: each change, every Standard option and concept, and the final
// image, each linked to the image it was made from and carrying the full list of
// changes so far (for the history and the presentation board). Nothing is lost on
// refresh, and the whole team can open the room.

export interface RoomContext {
  roomId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  roomName: string;
  /** The stored image the session started from (the original or a later result). */
  startImageId: string;
  /** Changes already in that image, so the list keeps growing across sessions. */
  startChanges: ChangeLine[];
}

const KIND: Record<Step['kind'], Exclude<ImageKind, 'original' | 'board' | 'final'>> = { mark: 'edit', design: 'design', concept: 'concept' };

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Could not save to the room.');

export function usePersist(session: Session, room: RoomContext | null) {
  // Image URL (blob or data) → its stored id, once uploaded (null if the upload failed).
  const ids = useRef(new Map<string, Promise<string | null>>());
  const saving = useRef(0);
  const { photo, steps, final, setStore } = session;

  useEffect(() => {
    setStore({ room: Boolean(room), saving: 0, failed: '' });
  }, [room, setStore]);

  // A new starting photo: only it is known to be stored.
  useEffect(() => {
    ids.current = new Map();
    if (room && photo) ids.current.set(photo.dataUrl, Promise.resolve(room.startImageId));
  }, [room, photo]);

  function upload(url: string, parentUrl: string, body: { kind: Exclude<ImageKind, 'original' | 'board'>; width: number; height: number; label: string; detail: string; meta: Record<string, unknown> }) {
    if (!room) return;
    // Read the bytes now: the blob URL is revoked if the result is replaced (Try again) before the upload ends.
    const bytes = fetch(url).then((r) => r.blob());
    const parent = ids.current.get(parentUrl) ?? Promise.resolve(null);
    saving.current++;
    setStore((s) => ({ ...s, saving: saving.current }));
    const done = (async () => {
      try {
        const [blob, parentId] = await Promise.all([bytes, parent]);
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Could not read the image.'));
          reader.readAsDataURL(blob);
        });
        const stored = await rooms.saveImage(room.roomId, { ...body, image, parentId });
        setStore((s) => ({ ...s, failed: '' }));
        return stored.id;
      } catch (err) {
        setStore((s) => ({ ...s, failed: `Not saved to the room: ${errorText(err)}` }));
        ids.current.delete(url); // a later change retries it
        return null;
      } finally {
        saving.current--;
        setStore((s) => ({ ...s, saving: saving.current }));
      }
    })();
    ids.current.set(url, done);
  }

  // Store every result not stored yet, oldest first, so each knows its parent.
  useEffect(() => {
    if (!room || !photo) return;
    let changes = room.startChanges;
    for (const step of steps) {
      const before = changes;
      if (step.kind === 'mark') {
        changes = [...before, ...stepLines(step)];
        if (!ids.current.has(step.image)) {
          upload(step.image, step.before, { kind: 'edit', width: photo.width, height: photo.height, label: step.label, detail: step.value, meta: { changes, prompt: step.prompt, action: step.action } });
        }
        continue;
      }
      const conceptSpec = step.kind === 'concept' ? step.spec : null;
      step.variations.forEach((v, i) => {
        if (!v.image || ids.current.has(v.image)) return;
        const lines = v.specs.map((l) => ({ label: l.label, value: l.value, hex: l.hex }));
        // A concept's swatches come from its own colour combination.
        const style = conceptSpec ? DESIGN_STYLES.find((st) => st.id === conceptSpec.style) : undefined;
        const palette = style && conceptSpec ? findPalette(style, conceptSpec.concepts[i]?.palette).colours : undefined;
        upload(v.image, step.before, {
          kind: KIND[step.kind],
          width: photo.width,
          height: photo.height,
          label: v.label,
          detail: lines.map((l) => l.label).join(', '),
          meta: { changes: [...before, ...lines], specs: lines, prompt: v.prompt, ...(palette ? { palette } : {}) },
        });
      });
      changes = [...before, ...stepLines(step)];
    }
    if (final && !ids.current.has(final.image)) {
      upload(final.image, final.from, { kind: 'final', width: final.width, height: final.height, label: 'Final 2K', detail: `${steps.length} change${steps.length === 1 ? '' : 's'}`, meta: { changes, prompt: final.prompt } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, photo, steps, final]);

  return {
    /** The stored id of an image on screen, once its upload is done. */
    idOf: (url: string) => ids.current.get(url) ?? Promise.resolve(null),
  };
}

export type Persist = ReturnType<typeof usePersist>;
