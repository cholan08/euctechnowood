import { useEffect, useState } from 'react';
import { ROOM_TYPES, type RoomTypeId } from '@shared/catalog';
import { finalImage } from '../../../api/studio';
import { rooms } from '../../../api/workspace';
import { useAuth } from '../../../app/auth';
import { designFileName, finalFileName } from '../../../lib/download';
import { prepareImage, toDataUrl, type PreparedImage } from '../../../lib/image';
import { fitToFrame } from '../lib/composite';
import { hasOptions, newId, type Mode } from '../model/steps';
import { useGenerate } from './useGenerate';
import { useMarkEdit } from './useMarkEdit';
import { usePersist, type RoomContext } from './usePersist';
import { useStandardDesign } from './useStandardDesign';
import { errorMessage, useSession } from './useSession';

// The studio's state and actions in one place, for StudioPage to lay out. Each
// way of working has its own hook; this one wires them to the shared session
// and handles what spans all of them: the photo, room type, mode, undo, try
// again, the final 2K image, downloads, and (in a project room) storing results
// and saving designs.

export type Studio = ReturnType<typeof useStudio>;

export interface StudioOptions {
  /** A project room: results are stored there as they are made. Null = quick studio (nothing stored). */
  room?: RoomContext | null;
  photo?: PreparedImage | null;
  roomType?: RoomTypeId;
  /** Start in this way of working (Generate for an empty room). */
  mode?: Mode;
}

export function useStudio({ room = null, photo: initialPhoto = null, roomType: initialRoom = 'kitchen', mode: initialMode = 'mark' }: StudioOptions = {}) {
  const session = useSession(initialPhoto);
  const { refresh } = useAuth();
  const [roomType, setRoomType] = useState<RoomTypeId>(initialRoom);
  const [mode, setMode] = useState<Mode>(initialMode);
  const mark = useMarkEdit(session, roomType);
  const standard = useStandardDesign(session, roomType, mode);
  const gen = useGenerate(session, roomType);
  const persist = usePersist(session, room);
  const [savedDesigns, setSavedDesigns] = useState<ReadonlySet<string>>(new Set());

  const { photo, last, busy } = session;
  const roomLabel = ROOM_TYPES.find((r) => r.id === roomType)?.label ?? 'room';

  // "Images left today" in the account menu follows each AI job.
  useEffect(() => {
    if (!busy) void refresh();
  }, [busy, refresh]);

  function startOver(next: PreparedImage | null) {
    session.reset(next);
    mark.reset();
    standard.reset();
  }

  async function openPhoto(file: File) {
    // In a room the photo is the room's: a new photo is a new room, added on the project page.
    if (room || busy || (photo && !session.confirmDiscard())) return;
    session.setError('');
    try {
      startOver(await prepareImage(file));
      window.scrollTo({ top: 0 });
    } catch (err) {
      session.setError(errorMessage(err));
    }
  }

  function newPhoto() {
    if (!busy && session.confirmDiscard()) startOver(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    session.setView('edit');
    session.setError('');
  }

  function changeRoom(next: RoomTypeId) {
    setRoomType(next);
    mark.fitRoom(next);
    gen.fitRoom(next);
  }

  /** Makes the last change again from the same starting image. */
  function retry() {
    if (!last) return;
    if (last.kind === 'mark') mark.retry(last);
    else if (last.kind === 'design') standard.retry(last);
    else gen.retry(last);
  }

  /** Removes the last change and puts its settings back in the panel, ready to adjust. */
  function undo() {
    const step = session.popLast();
    if (!step) return;
    if (step.kind === 'mark') {
      mark.restore(step);
      setMode('mark');
    } else if (step.kind === 'design') {
      standard.restore(step);
      setMode('standard');
    } else {
      gen.restore(step);
      setMode('generate');
    }
  }

  /** Uses another option (A–D) or concept of the last step. */
  function choose(index: number) {
    if (last?.kind === 'design') standard.choose(index);
    else if (last?.kind === 'concept') gen.choose(index);
  }

  /** The last step: the AI sharpens the whole image to a realistic 2K photo. */
  function runFinal() {
    if (!photo || busy) return;
    const base = session.current;
    void session.track({ kind: 'final', label: '', count: 1, base }, async (stillHere) => {
      const response = await finalImage({ image: await toDataUrl(base), width: photo.width, height: photo.height, roomType });
      const fitted = await fitToFrame(base, response.image, photo.width, photo.height);
      if (!stillHere()) return URL.revokeObjectURL(fitted.url);
      session.showFinal({ id: newId(), from: base, image: fitted.url, width: fitted.width, height: fitted.height, prompt: response.prompt, ms: response.ms });
    });
  }

  function download() {
    if (last) session.download(session.current, designFileName(roomLabel, session.steps.length));
  }

  function downloadFinal() {
    if (session.final) session.download(session.final.image, finalFileName(roomLabel));
  }

  /** Keeps the image on screen as a named design for the client (project rooms only). */
  async function saveDesign(which: 'current' | 'final') {
    if (!room) return;
    const url = which === 'final' ? session.final?.image : session.current;
    if (!url) return;
    const suggested = which === 'final' ? 'Final design' : (last?.label ?? 'Design');
    const name = window.prompt('Name this design for the client', suggested)?.trim();
    if (!name) return;
    try {
      const imageId = await persist.idOf(url);
      if (!imageId) throw new Error('This image has not been saved to the room yet. Try again in a moment.');
      await rooms.saveDesign(room.roomId, { imageId, name });
      setSavedDesigns((s) => new Set(s).add(url));
    } catch (err) {
      session.setError(errorMessage(err));
    }
  }

  const options = hasOptions(last) && last.variations.length > 1 ? last : null;

  return {
    session,
    mark,
    standard,
    gen,
    room,
    roomType,
    changeRoom,
    mode,
    switchMode,
    openPhoto,
    newPhoto,
    retry,
    undo,
    choose,
    options,
    runFinal,
    download,
    downloadFinal,
    saveDesign,
    isSavedDesign: (url: string) => savedDesigns.has(url),
  };
}
