import type { Selection } from '@shared/catalog';
import type { EditAction, Variation } from '@shared/types';
import type { MaskOp } from '../lib/mask';
import type { DesignState } from './design';
import type { GenerateState } from './generate';

// The studio session's data: the changes made so far (steps), the one being set
// up (draft), the final 2K image, and what the AI is working on. Plain types and
// pure helpers only; the state itself lives in the hooks.

/** Mark & edit one part · Standard whole-room spec · Generate concepts for an empty room. */
export type Mode = 'mark' | 'standard' | 'generate';

/** What the image area shows: the marking canvas, before/after, or the final 2K image. */
export type View = 'edit' | 'compare' | 'final';

/** What the AI is working on, for the loading card. */
export interface Busy {
  kind: 'mark' | 'design' | 'concept' | 'final';
  /** "Base cabinets"; unused for the others. */
  label: string;
  /** Overrides the loading card's heading, e.g. "Placing the item…". */
  title?: string;
  /** How many images are being made. */
  count: number;
  /** The image being worked on, shown blurred underneath. */
  base: string;
}

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
  /** Change the part (default), add an object, or remove what is marked. */
  action: EditAction;
}

export const EMPTY_DRAFT: Draft = { part: null, text: '', ops: [], action: 'change' };

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
  /** Colours of the design (Generate: the combination's swatches), for the presentation board. */
  palette?: string[];
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
  action: EditAction;
}

/** One Standard design: the AI's whole image. Options A–D share `before`; `chosen` is the one in use. */
export interface DesignStep extends StepBase {
  kind: 'design';
  /** The panel as it was when generated, so Undo and Try again can bring it back. */
  design: DesignState;
  variations: Variation[];
  chosen: number;
}

/** Generated concepts of an empty room: one image per concept; `chosen` is the one in use. */
export interface ConceptStep extends StepBase {
  kind: 'concept';
  /** The Generate panel as it was, so Undo and Try again can bring it back. */
  spec: GenerateState;
  variations: Variation[];
  chosen: number;
}

/** Changes stack: each one is made on the result of the one before. */
export type Step = MarkStep | DesignStep | ConceptStep;

/** Steps that offer several images to choose from. */
export const hasOptions = (s: Step | undefined): s is DesignStep | ConceptStep => s?.kind === 'design' || s?.kind === 'concept';

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

/** What a Mark & edit change is made of: the part (if picked), a finish or staff's own words (and an item photo), and the mark. */
export interface MarkChange {
  part: string | null;
  finish?: MarkStep['finish'];
  text?: string;
  reference?: string;
  ops: MaskOp[];
  action: EditAction;
}

/** How a Standard option or a concept reads in the list of changes. */
export function describeOption(v: Variation): Pick<Step, 'label' | 'value' | 'hex'> {
  return { label: v.label, value: v.specs.length ? v.specs.map((s) => s.label).join(', ') : 'Photoreal', hex: v.specs.find((s) => s.hex)?.hex };
}

/** One line per change, for the history and the presentation board. */
export interface ChangeLine {
  label: string;
  value: string;
  hex?: string;
}

/** What a step changed, as lines: a mark is one line; an option or concept lists its spec. */
export function stepLines(s: Step): ChangeLine[] {
  if (s.kind === 'mark') return [{ label: s.label, value: s.value, hex: s.hex }];
  const v = s.variations[s.chosen];
  return (v?.specs ?? []).map((l) => ({ label: l.label, value: l.value, hex: l.hex }));
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
