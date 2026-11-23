import type { Box, RoomTypeId, Selection } from './catalog';

// ---------------------------------------------------------------- Mark & edit

/**
 * What the browser sends to POST /api/edit: ONE change to one marked area.
 * The browser keeps the exact mask; the server only needs where it is, for the prompt.
 * The change is a finish from the catalogue (`part` + `finish`) or staff's own words (`text`).
 */
export interface EditRequest {
  /** The image to edit as a data URL (JPEG, PNG or WebP): the photo, or the result of the previous change. */
  image: string;
  width: number;
  height: number;
  roomType: RoomTypeId;
  /** Element id from the catalogue, e.g. "base-cabinets". Needed with `finish`; optional with `text`. */
  part?: string;
  finish?: Selection;
  /** Staff's own instruction, e.g. "walnut wood with fluted grooves". */
  text?: string;
  /** A photo of an item to put in the marked area (a sofa, chair, light...), as a data URL. Used with `text`, not `finish`. */
  reference?: string;
  /** Bounding box of the area staff marked on the image, 0–1. */
  area: Box;
}

export interface EditResponse {
  /**
   * The AI's whole edited image as a data URL. The browser pastes back only the
   * marked area of it. Images are never stored on the server.
   */
  image: string;
  /** The exact prompt sent to the AI, shown with ?debug so the team can tune it. */
  prompt: string;
  ms: number;
  provider: string;
}

// ---------------------------------------------------------------- Standard

/** One design option ("Option A"): a full spec of what to change. Each produces one image. */
export interface DesignSpec {
  name: string;
  /** Element id -> what to change it to. Elements not listed stay exactly as in the image. */
  elements: Record<string, Selection>;
  addons: string[];
  /** Lighting mood id; "" = as in the image. */
  mood: string;
  notes: string;
}

/** What the browser sends to POST /api/redesign. */
export interface RedesignRequest {
  /** The image as a data URL (JPEG, PNG or WebP). */
  image: string;
  width: number;
  height: number;
  /** A real photo of a room, or a 3D render from Cabinet Vision. */
  source: 'photo' | 'render';
  roomType: RoomTypeId;
  /** 1 to MAX_VARIANTS options; one image per option. */
  variants: DesignSpec[];
}

/** One line of a design's spec sheet, e.g. "Base cabinets: Sage green · Laminate · Matte". */
export interface SpecLine {
  label: string;
  value: string;
  hex?: string;
}

export interface Variation {
  /** Random id, only used to tell designs apart in the browser. */
  id: string;
  label: string;
  /** What was changed, for the on-screen spec sheet. */
  specs: SpecLine[];
  /** The exact prompt sent to the AI, shown with ?debug so the team can tune it. */
  prompt: string;
  /**
   * The generated image as a data URL, when it succeeded. Images are never stored
   * on the server: this response is the only copy until the user downloads it.
   */
  image?: string;
  error?: string;
  ms: number;
}

export interface RedesignResponse {
  provider: string;
  variations: Variation[];
}

// ---------------------------------------------------------------- AI help for prompt bars

/**
 * What a prompt bar is for:
 * - details: extra details for a part's new finish (Mark & edit or Standard)
 * - change: a Mark & edit change in staff's own words, on the marked area
 * - note: Standard's designer's note for the whole room
 */
export type AssistKind = 'details' | 'change' | 'note';

/** What the browser sends to POST /api/assist: the bar's text and what it is about. */
export interface AssistRequest {
  kind: AssistKind;
  roomType: RoomTypeId;
  /** Element id, when the bar belongs to a part. */
  part?: string;
  /** The finish picked so far, so suggestions fit it. */
  finish?: Selection;
  /** What staff typed (any language); empty asks for ideas. */
  text: string;
}

export interface AssistResponse {
  /** Up to three short English instructions, closest to what was typed first. */
  suggestions: string[];
  provider: string;
}

// ---------------------------------------------------------------- Final 2K

/** What the browser sends to POST /api/final: the finished image, for one realism pass at 2K. */
export interface FinalRequest {
  image: string;
  width: number;
  height: number;
  roomType: RoomTypeId;
}

export type FinalResponse = EditResponse;
