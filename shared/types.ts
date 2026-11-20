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
  /** Set when the design was saved; needed to request a quote for it. */
  id?: string;
  label: string;
  styleId: string | null;
  /** The exact prompt sent to the AI, shown in the UI so the team can tune it. */
  prompt: string;
  /** URL of the generated image, when it succeeded. */
  image?: string;
  error?: string;
  ms: number;
}

export interface RedesignResponse {
  provider: string;
  variations: Variation[];
}

/** POST /api/leads */
export interface QuoteRequest {
  designId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  message: string;
}

export type LeadStatus = 'new' | 'contacted' | 'won' | 'lost';
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'won', 'lost'];

export interface AdminLead {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  message: string;
  status: LeadStatus;
  createdAt: string;
  design: {
    label: string;
    roomType: string;
    summary: string;
    beforeUrl: string;
    afterUrl: string;
  } | null;
}
