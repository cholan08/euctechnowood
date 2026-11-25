import { useEffect, useRef, useState } from 'react';
import { downloadImage, revokeImages } from '../../../lib/download';
import type { PreparedImage } from '../../../lib/image';
import type { Busy, Final, Step, View } from '../model/steps';

// The part of the studio both ways of working share: the photo, the stack of
// changes, the final 2K image, what the AI is busy with, and what has been
// downloaded. Results exist only in this tab (blob URLs), so this hook also owns
// revoking them and warning before they would be lost.

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
const onPhone = () => window.matchMedia('(max-width: 900px)').matches;

function revokeStep(s: Step) {
  if (s.kind === 'mark') URL.revokeObjectURL(s.image);
  else revokeImages(s.variations);
}

/** In a project room, results are stored on the server as they are made (see usePersist). */
export interface StoreState {
  room: boolean;
  /** Uploads still on their way. */
  saving: number;
  /** The last upload failed. */
  failed: string;
}

export type Session = ReturnType<typeof useSession>;

export function useSession(initialPhoto: PreparedImage | null = null) {
  const [photo, setPhoto] = useState<PreparedImage | null>(initialPhoto);
  const [store, setStore] = useState<StoreState>({ room: false, saving: 0, failed: '' });
  // Applied changes from both modes, oldest first. The last one's image is what the photo looks like now.
  const [steps, setSteps] = useState<Step[]>([]);
  const [final, setFinal] = useState<Final | null>(null);
  const [view, setView] = useState<View>('edit');
  const [busy, setBusy] = useState<Busy | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  // Image URLs already downloaded. Nothing is stored anywhere else.
  const [downloaded, setDownloaded] = useState<ReadonlySet<string>>(new Set());
  // Bumped when the photo is replaced, so a late answer for the old photo is thrown away.
  const ticket = useRef(0);

  const last = steps.at(-1);
  const current = last?.image ?? photo?.dataUrl ?? '';
  // The final image only counts while it was made from what is on screen now.
  const freshFinal = final && final.from === current ? final : null;
  const saved = downloaded.has(current);
  // In a room everything is stored as it is made; only uploads in flight (or failed) can be lost.
  const unsaved = store.room
    ? store.saving > 0 || Boolean(store.failed)
    : Boolean(last || freshFinal) && !saved && !(freshFinal && downloaded.has(freshFinal.image));

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // Results exist only in this tab, so warn before closing or reloading it.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  /** True when nothing undownloaded would be lost, or the user agrees to lose it. */
  function confirmDiscard() {
    if (!unsaved) return true;
    return window.confirm(store.room ? 'Some results are still being saved to the room (or failed to save). Leave anyway?' : 'The latest result has not been downloaded and will be lost. Continue?');
  }

  function dropFinal() {
    if (final) URL.revokeObjectURL(final.image);
    setFinal(null);
  }

  /** Starts over with `next` (or no photo). Answers still on their way for the old photo are ignored. */
  function reset(next: PreparedImage | null) {
    ticket.current++;
    steps.forEach(revokeStep);
    setSteps([]);
    dropFinal();
    setDownloaded(new Set());
    setView('edit');
    setError('');
    setPhoto(next);
  }

  /** Adds a change to the stack, or swaps the last one (`replace`: Try again, or a new Standard design). */
  function commit(step: Step, replace: boolean) {
    const before = replace ? steps.slice(0, -1) : steps;
    if (replace && last) revokeStep(last);
    dropFinal();
    setSteps([...before, step]);
    setView('compare');
  }

  /** Swaps the last step for another version of itself (Standard: a different option A–D). */
  function replaceLast(step: Step) {
    dropFinal();
    setSteps([...steps.slice(0, -1), step]);
  }

  /** Removes the last change and returns it, so its settings can go back in the panel. */
  function popLast(): Step | undefined {
    if (!last || busy) return undefined;
    setSteps(steps.slice(0, -1));
    dropFinal();
    setView('edit');
    setError('');
    revokeStep(last);
    return last;
  }

  function showFinal(next: Final) {
    if (final) URL.revokeObjectURL(final.image);
    setFinal(next);
    setView('final');
  }

  /** Runs an AI job. `work` gets `stillHere()`, false once its answer came too late (the photo was replaced). */
  async function track(job: Busy, work: (stillHere: () => boolean) => Promise<void>) {
    const mine = ticket.current;
    setBusy(job);
    setError('');
    // On phones the image is above the panel, so bring it into view.
    if (onPhone()) window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      await work(() => mine === ticket.current);
    } catch (err) {
      if (mine === ticket.current) setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Downloads an image and remembers it, so leaving no longer warns about it. */
  function download(url: string, fileName: string) {
    downloadImage(url, fileName);
    setDownloaded((prev) => new Set(prev).add(url));
  }

  return {
    photo,
    store,
    setStore,
    steps,
    last,
    current,
    final: freshFinal,
    view,
    setView,
    busy,
    elapsed,
    error,
    setError,
    saved,
    unsaved,
    confirmDiscard,
    reset,
    commit,
    replaceLast,
    popLast,
    showFinal,
    track,
    download,
    scrollToImageOnPhone: () => onPhone() && window.scrollTo({ top: 0, behavior: 'smooth' }),
  };
}
