import { useEffect } from 'react';
import { ITEM_MAX_SIDE, prepareImage } from '../../../lib/image';
import { errorMessage } from './useSession';
import type { Studio } from './useStudio';

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Keyboard and clipboard shortcuts: Esc cancels picking, Ctrl+Enter applies or
 * generates, Ctrl+Z takes back the last brush stroke, and a pasted image is
 * either the item for the marked area or a new room photo.
 */
export function useShortcuts(studio: Studio) {
  // Re-bound each render so the handlers always see the latest state.
  useEffect(() => {
    const { session, mark, standard, gen, mode } = studio;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && standard.picking) {
        standard.cancelPicking();
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (mode === 'standard') standard.generate();
        else if (mode === 'generate') gen.generate();
        else mark.applyFromKeyboard();
        return;
      }
      if (mode === 'mark' && e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping(e.target)) {
        if (mark.undoStroke()) e.preventDefault();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (!file || !file.type.startsWith('image/') || session.busy) return;
      e.preventDefault();
      // With an area marked, a pasted image is the item to put there ("this sofa"), not a new room photo.
      if (session.photo && mode === 'mark' && mark.marked.box) {
        prepareImage(file, ITEM_MAX_SIDE)
          .then((img) => mark.update({ reference: { dataUrl: img.dataUrl, name: file.name } }))
          .catch((err: unknown) => session.setError(errorMessage(err)));
        return;
      }
      void studio.openPhoto(file);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  });
}
