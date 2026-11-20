import type { StylePreset } from '../../shared/catalog';
import type { ParsedRequest } from './validate';

export interface Job {
  label: string;
  styleId: string | null;
  prompt: string;
  /** Plain-language list of what the customer chose, shown to the sales team. */
  summary: string;
}

// Guardrails that apply to every generation. Most quality problems (moved
// windows, floating furniture, "AI look") are fought here first, so tune this
// list against real customer photos.
const RULES = [
  'Change only what the design direction and the changes call for; leave everything else as it is.',
  'Every object at realistic scale, standing on the floor or fixed to a wall, with correct perspective and soft contact shadows. Nothing floating, overlapping or cut through.',
  'Keep walkways and door swings clear.',
  'Believable materials and lighting that match the windows and light fittings. Natural colours, no over-saturation, no plastic or CGI look.',
  'No people, text, logos, brand names or watermarks.',
  'Return one image with the same framing and aspect ratio as the input.',
];

/** One job per chosen style, or a single job when no style is chosen. */
export function buildJobs(request: ParsedRequest): Job[] {
  const styles: (StylePreset | null)[] = request.styles.length ? request.styles : [null];
  return styles.map((style) => ({
    label: style?.label ?? (request.source === 'render' ? 'Photoreal render' : 'Your changes'),
    styleId: style?.id ?? null,
    prompt: composePrompt(request, style),
    summary: summarize(request, style),
  }));
}

function summarize(request: ParsedRequest, style: StylePreset | null): string {
  const parts = [
    request.room.label,
    style ? `${style.label} style` : '',
    ...request.changes.map((c) => c.label),
    ...request.extras.map((e) => e.label),
    request.notes ? `Note: ${request.notes}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

function composePrompt(request: ParsedRequest, style: StylePreset | null): string {
  const room = request.room.label.toLowerCase();
  const lines: string[] = [];

  if (request.source === 'render') {
    lines.push(
      `This image is a 3D render of a ${room} made in cabinet design software (Cabinet Vision). Turn it into a photorealistic photograph of the same room, as if taken by a professional interior photographer.`,
      'Keep the cabinet layout, dimensions, proportions, materials and camera perspective exactly as designed, unless a change below says otherwise.',
    );
  } else {
    lines.push(
      `This is a real photo of a ${room} in a home in India. Redesign it and return a photorealistic photo of the same room after the makeover.`,
      'Keep the architecture exactly: walls, windows, doors, columns, beams, ceiling height, floor area, camera position, lens and perspective. Do not move, resize, add or remove windows or doors. Keep the same framing.',
    );
  }

  lines.push(
    '',
    style
      ? `Design direction: ${style.prompt}.`
      : 'Design direction: keep the current style and change only what is listed below.',
  );

  const changes = [...request.changes, ...request.extras].map((option) => option.prompt);
  if (request.notes) changes.push(`Customer note: ${request.notes}`);
  if (changes.length) lines.push('', 'Changes:', ...changes.map((c) => `- ${c}`));

  lines.push('', 'Rules:', ...RULES.map((r) => `- ${r}`));
  return lines.join('\n');
}
