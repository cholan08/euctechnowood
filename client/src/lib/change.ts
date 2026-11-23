import type { Selection } from '../../../shared/catalog';
import type { Variation } from '../../../shared/types';
import type { DesignState } from './design';
import type { MaskOp } from './mask';

export type Mode = 'mark' | 'standard';

/** Mark & edit: the change being set up in the panel. */
export interface Draft {
  part: string | null;
  /** A custom finish, set in "Custom finish". Suggestions are applied straight away instead. */
  finish?: Selection;
  /** Staff's own words, typed in "Describe it". */
  text: string;
  /** A photo of an item to put in the marked area (a sofa, a light...). */
  reference?: { dataUrl: string; name: string };
  ops: MaskOp[];
}

export const EMPTY_DRAFT: Draft = { part: null, text: '', ops: [] };

interface StepBase {
  id: string;
  /** The image this change was made on: the photo, or the previous change's result. */
  before: string;
  /** The result (a blob URL). Exists only in this tab until downloaded. */
  image: string;
  /** "Base cabinets", "Option A" */
  label: string;
  /** "Sage green · Laminate · Matte", "3 changes" */
  value: string;
  hex?: string;
  /** The prompt sent to the AI, shown with ?debug. */
  prompt: string;
  ms: number;
}

/** One marked change: only the marked area of `before` was replaced. */
export interface MarkStep extends StepBase {
  kind: 'mark';
  part: string | null;
  finish?: Selection;
  text?: string;
  /** The item photo (data URL), when an item was put in the marked area. */
  reference?: string;
  ops: MaskOp[];
}

/** One Standard design: the AI's whole image. Options A–D share `before`; `chosen` is the one in use. */
export interface DesignStep extends StepBase {
  kind: 'design';
  /** The panel as it was when generated, so Undo and Try again can bring it back. */
  design: DesignState;
  variations: Variation[];
  chosen: number;
}

/** Changes stack: each one is made on the result of the one before. */
export type Step = MarkStep | DesignStep;

/** The last step of the session, sharpened by the AI at 2K. */
export interface Final {
  id: string;
  /** The step it was made from ("" = the photo itself). Stale once that is no longer the latest. */
  from: string;
  image: string;
  width: number;
  height: number;
  prompt: string;
  ms: number;
}
