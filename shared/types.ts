import type { RoomTypeId } from './catalog';

/** What the browser sends to POST /api/redesign. */
export interface RedesignRequest {
  /** The room photo as a data URL (JPEG, PNG or WebP). */
  image: string;
  width: number;
  height: number;
  /** A real photo of a room, or a 3D render from Cabinet Vision. */
  source: 'photo' | 'render';
  roomType: RoomTypeId;
  /** One design is generated per style. Empty = one design that keeps the current style. */
  styleIds: string[];
  /** Change group id -> chosen option id. */
  changes: Record<string, string>;
  extras: string[];
  notes: string;
}

export interface Variation {
  /** Random id, only used to tell designs apart in the browser. */
  id: string;
  label: string;
  styleId: string | null;
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
