// The design choices a customer can make. The UI renders these and the server
// turns the chosen ids into the AI prompt, so this file is the one place to add,
// remove or reword options. Later this should come from a database so each
// manufacturer can manage their own catalogue (their real laminates, finishes...).

export const ROOM_TYPES = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'living', label: 'Living room / Hall' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'dining', label: 'Dining area' },
  { id: 'kids', label: "Kids' room" },
  { id: 'study', label: 'Study / Home office' },
  { id: 'pooja', label: 'Pooja room' },
  { id: 'bathroom', label: 'Bathroom' },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]['id'];

export interface StylePreset {
  id: string;
  label: string;
  prompt: string;
}

/** Each selected style produces one design variation. */
export const STYLES: StylePreset[] = [
  {
    id: 'modern',
    label: 'Modern',
    prompt:
      'modern: handleless flat shutters, clean lines, a neutral palette with one muted accent colour, slim black or brushed-metal fittings',
  },
  {
    id: 'indian-contemporary',
    label: 'Indian contemporary',
    prompt:
      'Indian contemporary: warm teak or walnut wood, brass accents, textured off-white walls, cane or jaali details used sparingly, warm lighting',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    prompt:
      'minimal: very few objects, white and soft grey surfaces, hidden storage, clear counters and shelves, calm and airy',
  },
  {
    id: 'scandinavian',
    label: 'Scandinavian',
    prompt:
      'Scandinavian: light oak wood, white walls, soft textiles, rounded furniture, a few plants, bright daylight feel',
  },
  {
    id: 'japandi',
    label: 'Japandi',
    prompt:
      'Japandi: low furniture, light natural wood, beige and charcoal palette, linen textures, simple ceramics',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    prompt:
      'luxury: lacquered or high-gloss shutters, marble-look surfaces, champagne-gold metal accents, layered cove and accent lighting',
  },
  {
    id: 'industrial',
    label: 'Industrial',
    prompt:
      'industrial: one exposed-brick or concrete-look accent wall, black metal frames, dark wood, filament pendant lights',
  },
  {
    id: 'classic-wood',
    label: 'Classic wooden',
    prompt:
      'classic wooden: rich wood shutters with simple raised panels, restrained carved accents, warm cream walls, brass handles',
  },
];

export const MAX_STYLES = 4;
export const NOTES_MAX = 300;

export interface CatalogOption {
  id: string;
  label: string;
  /** The instruction added to the AI prompt when this option is chosen. */
  prompt: string;
  /** Optional colour shown next to the label in the UI. */
  swatch?: string;
  /** Room types this option applies to. Omitted = all rooms. */
  rooms?: readonly RoomTypeId[];
}

export interface ChangeGroup {
  id: string;
  label: string;
  rooms?: readonly RoomTypeId[];
  options: CatalogOption[];
}

const STORAGE_ROOMS = ['kitchen', 'bedroom', 'kids', 'study', 'dining', 'pooja'] as const;
const FURNISHED_ROOMS = ['living', 'bedroom', 'dining', 'kids', 'study'] as const;

/** Pick at most one option per group. */
export const CHANGE_GROUPS: ChangeGroup[] = [
  {
    id: 'walls',
    label: 'Wall colour',
    options: [
      { id: 'warm-white', label: 'Warm white', swatch: '#F2EDE3', prompt: 'Repaint the walls warm white with a matte finish.' },
      { id: 'beige', label: 'Beige', swatch: '#D8C7A8', prompt: 'Repaint the walls a soft beige with a matte finish.' },
      { id: 'sage', label: 'Sage green', swatch: '#A7B49A', prompt: 'Repaint the walls a muted sage green with a matte finish.' },
      { id: 'powder-blue', label: 'Powder blue', swatch: '#B9CCDA', prompt: 'Repaint the walls a pale powder blue with a matte finish.' },
      { id: 'terracotta', label: 'Terracotta accent', swatch: '#C0694B', prompt: 'Paint one feature wall terracotta and the other walls warm white.' },
      { id: 'charcoal', label: 'Charcoal accent', swatch: '#44474C', prompt: 'Paint one feature wall charcoal grey and the other walls soft white.' },
      { id: 'panelled', label: 'Panelled feature wall', prompt: 'Add a feature wall with vertical fluted wooden panelling behind the main furniture or counter.' },
    ],
  },
  {
    id: 'shutters',
    label: 'Cabinet & wardrobe shutters',
    rooms: STORAGE_ROOMS,
    options: [
      { id: 'matte-white', label: 'Matte white laminate', swatch: '#F4F4F1', prompt: 'Change all cabinet and wardrobe shutters to matte white laminate.' },
      { id: 'gloss-acrylic', label: 'High-gloss acrylic', swatch: '#FAFAFA', prompt: 'Change all cabinet and wardrobe shutters to white high-gloss acrylic with soft reflections.' },
      { id: 'walnut', label: 'Walnut veneer', swatch: '#5C4033', prompt: 'Change all cabinet and wardrobe shutters to natural walnut wood veneer.' },
      { id: 'light-oak', label: 'Light oak laminate', swatch: '#C8A97E', prompt: 'Change all cabinet and wardrobe shutters to light oak wood-grain laminate.' },
      { id: 'two-tone', label: 'Two-tone', swatch: '#2F4F43', prompt: 'Make the shutters two-tone: white upper cabinets and deep green lower cabinets.' },
      { id: 'sage-matte', label: 'Sage green matte', swatch: '#9AA98F', prompt: 'Change all cabinet and wardrobe shutters to sage green matte laminate.' },
      { id: 'fluted-glass', label: 'Fluted glass + profile', prompt: 'Change the upper or tall shutters to fluted glass in slim black aluminium profiles.' },
    ],
  },
  {
    id: 'countertop',
    label: 'Countertop',
    rooms: ['kitchen'],
    options: [
      { id: 'black-granite', label: 'Black granite', swatch: '#1E1E1E', prompt: 'Change the countertop to polished jet-black granite.' },
      { id: 'white-quartz', label: 'White quartz', swatch: '#EEEDEA', prompt: 'Change the countertop to plain white quartz.' },
      { id: 'marble-look', label: 'Marble look', swatch: '#E6E3DE', prompt: 'Change the countertop to white marble-look stone with soft grey veins.' },
      { id: 'wood-top', label: 'Wooden top', swatch: '#A47148', prompt: 'Change the countertop to a warm solid-wood worktop.' },
    ],
  },
  {
    id: 'floor',
    label: 'Flooring',
    options: [
      { id: 'light-vitrified', label: 'Light vitrified tiles', swatch: '#E8DFD0', prompt: 'Change the floor to large-format light beige glossy vitrified tiles.' },
      { id: 'wood', label: 'Wooden flooring', swatch: '#B98B5E', prompt: 'Change the floor to warm oak wood-look plank flooring.' },
      { id: 'marble-floor', label: 'Italian marble look', swatch: '#F0ECE6', prompt: 'Change the floor to polished white Italian marble-look slabs.' },
      { id: 'grey-matte', label: 'Matte grey tiles', swatch: '#9A9A98', prompt: 'Change the floor to large matte grey tiles.' },
      { id: 'herringbone', label: 'Herringbone wood', swatch: '#A9784C', prompt: 'Change the floor to herringbone-pattern wooden flooring.' },
    ],
  },
  {
    id: 'ceiling',
    label: 'Ceiling & lights',
    options: [
      { id: 'cove', label: 'False ceiling + cove light', prompt: 'Add a gypsum false ceiling with a recessed warm-white cove light around its edge.' },
      { id: 'downlights', label: 'Recessed downlights', prompt: 'Add evenly spaced recessed downlights in the ceiling.' },
      { id: 'pendants', label: 'Pendant lights', prompt: 'Add two or three pendant lights over the main counter, island, dining table or bedside.' },
      { id: 'wood-slats', label: 'Wooden slat ceiling', prompt: 'Add a wooden slat ceiling panel over the main area with hidden warm lighting.' },
    ],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    rooms: FURNISHED_ROOMS,
    options: [
      { id: 'restyle', label: 'Restyle existing', prompt: 'Replace the existing loose furniture with new pieces in the chosen style, in the same positions and at the same size.' },
      { id: 'furnish', label: 'Furnish empty room', prompt: 'The room is empty or nearly empty: furnish it fully for its purpose with well-placed, correctly sized furniture and decor.' },
      { id: 'empty', label: 'Empty the room', prompt: 'Remove all loose furniture and decor, leaving the bare room with clean walls and floor.' },
    ],
  },
];

/** Independent add-ons; any number can be picked. */
export const EXTRAS: CatalogOption[] = [
  { id: 'declutter', label: 'Declutter', prompt: 'Remove clutter, loose items and visible wires from counters, floor and shelves.' },
  { id: 'plants', label: 'Indoor plants', prompt: 'Add a few healthy indoor plants in simple planters.' },
  { id: 'art', label: 'Wall art', prompt: 'Add one or two framed artworks on a free wall, at eye level.' },
  { id: 'curtains', label: 'Curtains / blinds', prompt: 'Add simple linen curtains or roller blinds on the windows.' },
  { id: 'rug', label: 'Rug', prompt: 'Add a neutral area rug that fits the furniture layout.', rooms: ['living', 'bedroom', 'dining', 'kids', 'study'] },
  { id: 'fan', label: 'Ceiling fan', prompt: 'Add a modern drop-down ceiling fan centred in the room.' },
  { id: 'tv-unit', label: 'TV unit', prompt: 'Add a wall-mounted TV unit with a slim TV on the most suitable wall.', rooms: ['living', 'bedroom'] },
  { id: 'chimney', label: 'Chimney & hob', prompt: 'Add a modern wall-mounted kitchen chimney above a built-in hob.', rooms: ['kitchen'] },
  { id: 'shelf-light', label: 'Shelf / under-cabinet lights', prompt: 'Add warm LED strip lights under the wall cabinets and inside open shelves, with an even glow.' },
  { id: 'garden-view', label: 'Garden view in windows', prompt: 'Show a green garden view through the windows with soft daylight coming in.' },
];

export function appliesTo(item: { rooms?: readonly RoomTypeId[] }, room: RoomTypeId): boolean {
  return !item.rooms || item.rooms.includes(room);
}
