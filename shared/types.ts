import type { RoomTypeId, Selection } from './catalog';

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
  /** The room photo as a data URL (JPEG, PNG or WebP). */
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
