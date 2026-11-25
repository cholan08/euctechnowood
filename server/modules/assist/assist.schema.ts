import { z } from 'zod';
import { ELEMENTS, INSTRUCTION_MAX, NOTES_MAX, appliesTo, cleanText, resolveSelection, type ResolvedSelection, type RoomElement } from '@shared/catalog';
import { findRoom, parseBody, roomTypeField, selectionFields, type Room } from '../../lib/validation';

export interface ParsedAssist {
  kind: 'details' | 'change' | 'note';
  room: Room;
  element: RoomElement | null;
  /** The finish picked so far, if any. */
  finish: ResolvedSelection | null;
  text: string;
}

const assistSchema = z.object({
  kind: z.enum(['details', 'change', 'note']),
  roomType: roomTypeField,
  part: z.string().max(40).optional(),
  finish: z.object(selectionFields).optional(),
  text: z.string().max(NOTES_MAX + 40, 'That text is too long for AI help.').default(''),
});

/** Checks an AI help request. An unknown part or finish is dropped rather than refused: the help is only a hint. */
export function parseAssistRequest(body: unknown): ParsedAssist {
  const b = parseBody(assistSchema, body);
  const room = findRoom(b.roomType);
  const element = (b.part && ELEMENTS.find((e) => e.id === b.part && appliesTo(e, room.id))) || null;
  const finish = element && b.finish ? resolveSelection(element, b.finish) : null;
  const text = cleanText(b.text, b.kind === 'note' ? NOTES_MAX : INSTRUCTION_MAX);
  return { kind: b.kind, room, element, finish, text };
}
