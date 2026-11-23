// The room, broken into the parts a modular-furniture designer specifies: base
// cabinets, countertop, handles, floor... Both ways of working read this file:
// - Mark & edit: ONE part at a time. Staff mark it on the photo and click a
//   suggested change (SUGGESTIONS below) or set a custom finish.
// - Standard: a spec for the whole room (options A–D). Each part is LOCKED
//   (kept as in the image) or set to material + shade + sheen (+ shutter design).
// The UI renders this file and the server turns the chosen ids into the AI prompt,
// so this is the one place to add or reword options.
//
// Later EUC can replace the generic shades with their real laminate / quartz
// catalogue (shade codes, supplier names) without touching any other file.

import { describeHex } from './colour';

export const ROOM_TYPES = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'living', label: 'Living room / Hall' },
  { id: 'dining', label: 'Dining area' },
  { id: 'kids', label: "Kids' room" },
  { id: 'study', label: 'Study / Home office' },
  { id: 'pooja', label: 'Pooja room' },
  { id: 'bathroom', label: 'Bathroom' },
] as const;

export type RoomTypeId = (typeof ROOM_TYPES)[number]['id'];

/** A pickable value: a shade, a sheen, a laying pattern... */
export interface Choice {
  id: string;
  label: string;
  /** Words used in the prompt. Defaults to the label in lower case. */
  prompt?: string;
  /** Colour shown in the UI. */
  hex?: string;
}

export interface Material {
  id: string;
  label: string;
  /**
   * Noun phrase for the prompt, e.g. "laminate", "quartz". Solid colours read
   * "sage green laminate"; patterns read "quartz in Calacatta white". Put
   * {shade} in the phrase to place the shade somewhere else.
   */
  prompt: string;
  /** What the shade list is called in the UI ("Colour", "Pattern", "Finish"...). */
  shadeLabel?: string;
  shades?: Choice[];
  /** A solid-colour material: allows any custom colour, and the hex is sent to the AI. */
  custom?: boolean;
  /** What the finish list is called ("Sheen", "Profile", "Laying pattern"...). */
  finishLabel?: string;
  /** Each finish's prompt is a clause appended to the sentence, e.g. "with a super-matte finish". */
  finishes?: Choice[];
}

export type ElementGroup = 'cabinetry' | 'surfaces';

/** One part of the room that can be changed. */
export interface RoomElement {
  id: string;
  label: string;
  /** Tab in the Standard panel. */
  group: ElementGroup;
  /** How the prompt names it: "the base (lower) cabinet shutters". */
  noun: string;
  rooms?: readonly RoomTypeId[];
  materials: Material[];
  /** Shutter / panel design, for joinery only (Standard mode). */
  profiles?: Choice[];
  /** Shutters: the prompt also holds every door and drawer line in place. */
  doors?: boolean;
  /** The change may alter the part's shape (new handles, a false ceiling), so the prompt does not hold it. */
  reshape?: boolean;
}

/** A point on the image, 0–1 from the top left. */
export interface Point {
  x: number;
  y: number;
}

/** What the user chose for one part. In Standard mode, no selection = locked to the original. */
export interface Selection {
  material: string;
  shade?: string;
  /** A custom colour (#rrggbb), for materials with `custom: true`. Wins over `shade`. */
  colour?: string;
  finish?: string;
  /**
   * Staff's extra details in their own words ("fluted grooves about 2 cm apart"),
   * typed in the prompt bar, often polished with AI help. Added to the prompt as is.
   */
  details?: string;
  /** Standard mode only: shutter design. */
  profile?: string;
  /**
   * Standard mode only: a photo of the real material sample (laminate sheet, tile,
   * slab) as a data URL. The AI matches its colour, pattern and grain; it wins over
   * `shade` and `colour`. Like every image here, it is never stored.
   */
  sample?: string;
  /** Standard mode only: where this part is, when only one of several should change. */
  area?: Point;
}

/** Sample photos per option. With the room photo that is five images, xAI's limit for one edit. */
export const MAX_SAMPLES = 4;

/** A rectangle on the image, 0–1 from the top left: where the marked area is. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- shades

const SOLID: Choice[] = [
  { id: 'frosty-white', label: 'Frosty white', hex: '#F3F2EE' },
  { id: 'ivory', label: 'Ivory', hex: '#EDE6D6' },
  { id: 'cashmere', label: 'Cashmere', hex: '#D9CDBD', prompt: 'cashmere beige' },
  { id: 'greige', label: 'Greige', hex: '#B5ABA0', prompt: 'greige (warm grey-beige)' },
  { id: 'light-grey', label: 'Light grey', hex: '#C9CBCC' },
  { id: 'stone-grey', label: 'Stone grey', hex: '#8E9093' },
  { id: 'graphite', label: 'Graphite', hex: '#45484C', prompt: 'graphite grey' },
  { id: 'black', label: 'Charcoal black', hex: '#232427' },
  { id: 'sage', label: 'Sage green', hex: '#9AA98F' },
  { id: 'olive', label: 'Olive green', hex: '#6F7A4E' },
  { id: 'forest', label: 'Forest green', hex: '#2F4F43', prompt: 'deep forest green' },
  { id: 'teal', label: 'Teal', hex: '#2E6A6A', prompt: 'deep teal' },
  { id: 'powder-blue', label: 'Powder blue', hex: '#B9CCDA' },
  { id: 'navy', label: 'Navy blue', hex: '#24324A' },
  { id: 'dusty-pink', label: 'Dusty pink', hex: '#D8B4AE' },
  { id: 'terracotta', label: 'Terracotta', hex: '#B9634A' },
  { id: 'mustard', label: 'Mustard', hex: '#C9A03A', prompt: 'mustard yellow' },
  { id: 'burgundy', label: 'Burgundy', hex: '#6E2A35' },
];

const WOOD: Choice[] = [
  { id: 'bleached-oak', label: 'Bleached oak', hex: '#D9C6A5' },
  { id: 'light-oak', label: 'Light oak', hex: '#C8A97E' },
  { id: 'natural-teak', label: 'Natural teak', hex: '#A8743F' },
  { id: 'walnut', label: 'Walnut', hex: '#5C4033', prompt: 'American walnut' },
  { id: 'smoked-oak', label: 'Smoked oak', hex: '#6E5A47' },
  { id: 'wenge', label: 'Wenge', hex: '#3B2C24', prompt: 'dark wenge' },
  { id: 'ash-grey', label: 'Ash grey wood', hex: '#9A9188', prompt: 'grey-washed ash' },
  { id: 'rosewood', label: 'Rosewood', hex: '#5A2E24', prompt: 'Indian rosewood (sheesham)' },
];

const METAL: Choice[] = [
  { id: 'matte-black', label: 'Matte black', hex: '#1E1E1F' },
  { id: 'brushed-gold', label: 'Brushed gold', hex: '#C2A15E' },
  { id: 'brushed-steel', label: 'Brushed steel', hex: '#A7AAAD', prompt: 'brushed stainless steel' },
  { id: 'antique-brass', label: 'Antique brass', hex: '#8C6A3A' },
  { id: 'rose-gold', label: 'Rose gold', hex: '#C69585' },
  { id: 'gunmetal', label: 'Gunmetal', hex: '#4A4C50', prompt: 'gunmetal grey' },
];

const FABRIC: Choice[] = [
  { id: 'oatmeal', label: 'Oatmeal', hex: '#D8CDB9', prompt: 'oatmeal beige' },
  { id: 'ivory', label: 'Ivory', hex: '#EDE6D6' },
  { id: 'light-grey', label: 'Light grey', hex: '#BFC1C2' },
  { id: 'charcoal', label: 'Charcoal', hex: '#3E4044' },
  { id: 'sage', label: 'Sage green', hex: '#9AA98F' },
  { id: 'emerald', label: 'Emerald', hex: '#2F6B55', prompt: 'emerald green' },
  { id: 'navy', label: 'Navy blue', hex: '#24324A' },
  { id: 'rust', label: 'Rust', hex: '#A4532F', prompt: 'rust orange' },
  { id: 'mustard', label: 'Mustard', hex: '#C9A03A', prompt: 'mustard yellow' },
  { id: 'blush', label: 'Blush pink', hex: '#D8B4AE' },
];

const STONE_SLABS: Choice[] = [
  { id: 'calacatta', label: 'Calacatta white', hex: '#EEEBE6', prompt: 'Calacatta white marble-look with bold grey-gold veins' },
  { id: 'statuario', label: 'Statuario white', hex: '#F1EFEC', prompt: 'Statuario white marble-look with soft grey veins' },
  { id: 'pure-white', label: 'Pure white', hex: '#F4F3F0', prompt: 'plain pure white' },
  { id: 'concrete', label: 'Concrete grey', hex: '#9D9C99', prompt: 'concrete-look grey' },
  { id: 'nero', label: 'Nero marquina', hex: '#1F1F21', prompt: 'Nero Marquina black with fine white veins' },
  { id: 'beige', label: 'Warm beige', hex: '#D9C9AE', prompt: 'warm beige' },
];

// ---------------------------------------------------------------- finishes

const SHEEN: Choice[] = [
  { id: 'matte', label: 'Matte', prompt: 'with a matte finish' },
  { id: 'super-matte', label: 'Super-matte', prompt: 'with a super-matte, anti-fingerprint, non-reflective finish' },
  { id: 'gloss', label: 'High gloss', prompt: 'with a high-gloss finish and soft, realistic reflections' },
  { id: 'textured', label: 'Textured', prompt: 'with a subtle textured (suede) surface' },
];

const PAINT_SHEEN: Choice[] = [
  { id: 'matte', label: 'Matte', prompt: 'with a matte finish' },
  { id: 'satin', label: 'Satin', prompt: 'with a satin finish' },
  { id: 'gloss', label: 'High gloss', prompt: 'with a deep high-gloss lacquer finish and soft, realistic reflections' },
];

const STONE_FINISH: Choice[] = [
  { id: 'polished', label: 'Polished', prompt: 'with a polished finish' },
  { id: 'honed', label: 'Honed (matte)', prompt: 'with a honed matte finish' },
  { id: 'leathered', label: 'Leathered', prompt: 'with a leathered, softly textured finish' },
];

const TILE_FINISH: Choice[] = [
  { id: 'gloss', label: 'Glossy', prompt: 'with a glossy glaze' },
  { id: 'matte', label: 'Matte', prompt: 'with a matte surface' },
];

const PROFILE_FRAME: Choice[] = [
  { id: 'black', label: 'Black profile', prompt: 'in slim matte-black aluminium profiles' },
  { id: 'gold', label: 'Gold profile', prompt: 'in slim champagne-gold aluminium profiles' },
  { id: 'silver', label: 'Silver profile', prompt: 'in slim brushed-silver aluminium profiles' },
];

const SHUTTER_PROFILES: Choice[] = [
  { id: 'slab', label: 'Flat slab', prompt: 'as flat slab shutters' },
  { id: 'shaker', label: 'Shaker', prompt: 'as shaker shutters with a slim recessed frame' },
  { id: 'fluted', label: 'Fluted', prompt: 'as shutters with fine vertical fluted grooves' },
  { id: 'slatted', label: 'Slatted', prompt: 'as shutters with vertical slats' },
  { id: 'arch', label: 'Arched', prompt: 'as shutters with a soft arched top panel' },
];

// ---------------------------------------------------------------- material sets

const SHUTTER_MATERIALS: Material[] = [
  { id: 'laminate', label: 'Laminate', prompt: 'laminate', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Sheen', finishes: SHEEN },
  { id: 'wood-laminate', label: 'Wood-grain laminate', prompt: 'wood-grain laminate with a realistic grain', shadeLabel: 'Wood', shades: WOOD, finishLabel: 'Sheen', finishes: SHEEN.filter((f) => f.id !== 'gloss') },
  { id: 'acrylic', label: 'Acrylic', prompt: 'acrylic', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Sheen', finishes: [SHEEN[2], { id: 'matte', label: 'Matte acrylic', prompt: 'with a smooth matte acrylic finish' }] },
  { id: 'pu', label: 'PU paint', prompt: 'PU-painted (lacquered)', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Sheen', finishes: PAINT_SHEEN },
  { id: 'veneer', label: 'Wood veneer', prompt: 'natural wood veneer', shadeLabel: 'Wood', shades: WOOD, finishLabel: 'Sheen', finishes: [{ id: 'open-pore', label: 'Open-pore matte', prompt: 'with an open-pore matte lacquer' }, { id: 'satin', label: 'Satin', prompt: 'with a satin lacquer' }] },
  {
    id: 'glass',
    label: 'Glass + profile',
    prompt: '{shade} glass',
    shadeLabel: 'Glass',
    shades: [
      { id: 'fluted', label: 'Fluted', prompt: 'fluted (reeded)', hex: '#C9D2D2' },
      { id: 'frosted', label: 'Frosted', hex: '#E3E7E7' },
      { id: 'clear', label: 'Clear', prompt: 'clear', hex: '#DDEBEC' },
      { id: 'bronze', label: 'Tinted bronze', hex: '#8A6E57' },
      { id: 'smoke', label: 'Smoked grey', hex: '#5F6366' },
    ],
    finishLabel: 'Profile',
    finishes: PROFILE_FRAME,
  },
  { id: 'lacquered-glass', label: 'Back-painted glass', prompt: 'back-painted lacquered glass', shadeLabel: 'Colour', shades: SOLID, custom: true },
];

const UPHOLSTERY: Material[] = [
  { id: 'fabric', label: 'Fabric', prompt: 'woven fabric upholstery', shadeLabel: 'Colour', shades: FABRIC, custom: true },
  { id: 'boucle', label: 'Bouclé', prompt: 'textured bouclé upholstery', shadeLabel: 'Colour', shades: FABRIC.slice(0, 5), custom: true },
  { id: 'velvet', label: 'Velvet', prompt: 'velvet upholstery with a soft sheen', shadeLabel: 'Colour', shades: FABRIC, custom: true },
  {
    id: 'leather',
    label: 'Leather',
    prompt: 'leather upholstery',
    shadeLabel: 'Colour',
    shades: [
      { id: 'tan', label: 'Tan', hex: '#A86F3E' },
      { id: 'cognac', label: 'Cognac', hex: '#8A4B2A' },
      { id: 'cream', label: 'Cream', hex: '#E8DDC8' },
      { id: 'black', label: 'Black', hex: '#1F1F20' },
    ],
  },
];

const PAINT: Material[] = [
  { id: 'emulsion', label: 'Paint', prompt: 'emulsion paint', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Sheen', finishes: [{ id: 'matte', label: 'Matte', prompt: 'with a matte finish' }, { id: 'eggshell', label: 'Eggshell', prompt: 'with a soft eggshell sheen' }] },
  { id: 'limewash', label: 'Limewash', prompt: 'limewash paint with soft, cloudy brush movement', shadeLabel: 'Colour', shades: SOLID.slice(0, 6).concat(SOLID[8], SOLID[15]), custom: true },
  { id: 'texture', label: 'Texture paint', prompt: 'textured plaster-effect paint', shadeLabel: 'Colour', shades: SOLID.slice(0, 7), custom: true },
];

const TILE_PATTERNS: Choice[] = [
  { id: 'geometric', label: 'Monochrome geometric', prompt: 'black-and-white geometric patterned', hex: '#8F8F8F' },
  { id: 'moroccan', label: 'Moroccan blue', prompt: 'blue-and-white Moroccan patterned', hex: '#3C5E8F' },
  { id: 'terrazzo', label: 'Terrazzo', prompt: 'terrazzo-look', hex: '#D9D2C7' },
  { id: 'hexagon', label: 'Hexagon white', prompt: 'small white hexagon', hex: '#ECEBE7' },
];

const COUNTER_MATERIALS: Material[] = [
  {
    id: 'granite',
    label: 'Granite',
    prompt: 'granite',
    shadeLabel: 'Stone',
    shades: [
      { id: 'absolute-black', label: 'Absolute black', hex: '#141414', prompt: 'jet-black (absolute black)' },
      { id: 'black-galaxy', label: 'Black galaxy', hex: '#1E1C1A', prompt: 'black galaxy, black with fine gold flecks' },
      { id: 'tan-brown', label: 'Tan brown', hex: '#4A2E24', prompt: 'tan brown, dark brown with black and copper specks' },
      { id: 'steel-grey', label: 'Steel grey', hex: '#55585B' },
      { id: 'kashmir-white', label: 'Kashmir white', hex: '#DCD7D0', prompt: 'Kashmir white, off-white with grey and garnet specks' },
    ],
    finishLabel: 'Surface',
    finishes: STONE_FINISH,
  },
  { id: 'quartz', label: 'Quartz', prompt: 'quartz', shadeLabel: 'Pattern', shades: STONE_SLABS, finishLabel: 'Surface', finishes: STONE_FINISH.slice(0, 2) },
  {
    id: 'marble',
    label: 'Marble',
    prompt: 'natural marble',
    shadeLabel: 'Stone',
    shades: [
      { id: 'statuario', label: 'Statuario', hex: '#F1EFEC', prompt: 'Statuario white' },
      { id: 'carrara', label: 'Carrara', hex: '#E6E6E4', prompt: 'Carrara white-grey' },
      { id: 'makrana', label: 'Makrana white', hex: '#EFEDE8', prompt: 'Indian Makrana white' },
      { id: 'emperador', label: 'Emperador', hex: '#6A4A35', prompt: 'brown Emperador' },
    ],
    finishLabel: 'Surface',
    finishes: STONE_FINISH.slice(0, 2),
  },
  { id: 'sintered', label: 'Sintered stone', prompt: 'thin sintered-stone slab', shadeLabel: 'Pattern', shades: STONE_SLABS, finishLabel: 'Surface', finishes: STONE_FINISH.slice(0, 2) },
  { id: 'wood', label: 'Solid wood', prompt: 'solid-wood butcher-block', shadeLabel: 'Wood', shades: WOOD.slice(0, 5) },
  { id: 'corian', label: 'Solid surface', prompt: 'seamless solid-surface (Corian-type)', shadeLabel: 'Colour', shades: SOLID.slice(0, 7), custom: true },
];

// ---------------------------------------------------------------- elements

const ALL_JOINERY_ROOMS = ['kitchen', 'bedroom', 'kids', 'study', 'dining', 'pooja', 'bathroom', 'living'] as const;

export const ELEMENTS: RoomElement[] = [
  { id: 'base-cabinets', label: 'Base cabinets', group: 'cabinetry', noun: 'the base (lower) cabinet shutters and drawer fronts', rooms: ['kitchen'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'wall-cabinets', label: 'Wall cabinets', group: 'cabinetry', noun: 'the wall-hung (upper) cabinet shutters', rooms: ['kitchen'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'tall-units', label: 'Tall units', group: 'cabinetry', noun: 'the tall unit (pantry / appliance column) shutters', rooms: ['kitchen'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'wardrobe', label: 'Wardrobe', group: 'cabinetry', noun: 'the wardrobe shutters', rooms: ['bedroom', 'kids'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'loft', label: 'Loft', group: 'cabinetry', noun: 'the loft (overhead storage) shutters', rooms: ['kitchen', 'bedroom', 'kids'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'tv-unit', label: 'TV unit', group: 'cabinetry', noun: 'the TV unit cabinetry and its back panel', rooms: ['living', 'bedroom'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'storage', label: 'Storage units', group: 'cabinetry', noun: 'the built-in storage cabinets (crockery, shoe or book units)', rooms: ['living', 'dining', 'study', 'kids'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'study-unit', label: 'Study table', group: 'cabinetry', noun: 'the study table and its shelves', rooms: ['study', 'kids', 'bedroom'], materials: SHUTTER_MATERIALS.slice(0, 5) },
  { id: 'pooja-unit', label: 'Pooja unit', group: 'cabinetry', noun: 'the pooja unit (mandir) cabinetry', rooms: ['pooja'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES, doors: true },
  { id: 'vanity', label: 'Vanity', group: 'cabinetry', noun: 'the vanity cabinet shutters', rooms: ['bathroom'], materials: SHUTTER_MATERIALS, profiles: SHUTTER_PROFILES.slice(0, 3), doors: true },
  { id: 'bed', label: 'Bed & headboard', group: 'cabinetry', noun: 'the bed frame and headboard', rooms: ['bedroom', 'kids'], materials: [...UPHOLSTERY.slice(0, 3), SHUTTER_MATERIALS[4], SHUTTER_MATERIALS[1]] },
  { id: 'sofa', label: 'Sofa', group: 'cabinetry', noun: 'the sofa upholstery (same sofa shape and size)', rooms: ['living'], materials: UPHOLSTERY },
  {
    id: 'handles',
    label: 'Handles',
    group: 'cabinetry',
    noun: 'the cabinet and wardrobe handles',
    reshape: true,
    rooms: ALL_JOINERY_ROOMS,
    materials: [
      { id: 'gola', label: 'G-profile (handleless)', prompt: 'G-profile / gola handleless channels', shadeLabel: 'Metal', shades: METAL },
      { id: 'bar', label: 'Slim bar', prompt: 'slim bar handles', shadeLabel: 'Metal', shades: METAL },
      { id: 'edge', label: 'Edge profile', prompt: 'long edge-mounted profile handles along the top of each shutter', shadeLabel: 'Metal', shades: METAL },
      { id: 'knob', label: 'Knobs', prompt: 'small round knobs', shadeLabel: 'Metal', shades: METAL },
      { id: 'leather-pull', label: 'Leather pulls', prompt: 'tan leather strap pulls with metal fixings', shadeLabel: 'Metal', shades: METAL },
      { id: 'push', label: 'Push-to-open', prompt: 'no visible handles (push-to-open shutters)' },
    ],
  },

  { id: 'countertop', label: 'Countertop', group: 'surfaces', noun: 'the countertop (same thickness and edges)', rooms: ['kitchen', 'bathroom'], materials: COUNTER_MATERIALS },
  {
    id: 'backsplash',
    label: 'Backsplash / dado',
    group: 'surfaces',
    noun: 'the backsplash (the wall between the countertop and the wall cabinets)',
    rooms: ['kitchen'],
    materials: [
      { id: 'slab', label: 'Stone slab', prompt: 'full-height stone slab', shadeLabel: 'Pattern', shades: STONE_SLABS, finishLabel: 'Surface', finishes: STONE_FINISH.slice(0, 2) },
      { id: 'subway', label: 'Subway tiles', prompt: 'subway tiles laid in a brick pattern', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Glaze', finishes: TILE_FINISH },
      { id: 'zellige', label: 'Zellige tiles', prompt: 'handmade zellige tiles with uneven glaze', shadeLabel: 'Colour', shades: SOLID, custom: true },
      { id: 'pattern', label: 'Pattern tiles', prompt: '{shade} tiles', shadeLabel: 'Pattern', shades: TILE_PATTERNS },
      { id: 'glass', label: 'Back-painted glass', prompt: 'back-painted glass', shadeLabel: 'Colour', shades: SOLID, custom: true },
    ],
  },
  {
    id: 'wall-tiles',
    label: 'Wall tiles',
    group: 'surfaces',
    noun: 'the wall tiles',
    rooms: ['bathroom'],
    materials: [
      { id: 'large', label: 'Large-format', prompt: 'large-format tiles with thin joints', shadeLabel: 'Pattern', shades: STONE_SLABS, finishLabel: 'Surface', finishes: TILE_FINISH },
      { id: 'subway', label: 'Subway tiles', prompt: 'subway tiles laid in a brick pattern', shadeLabel: 'Colour', shades: SOLID, custom: true, finishLabel: 'Glaze', finishes: TILE_FINISH },
      { id: 'pattern', label: 'Pattern tiles', prompt: '{shade} tiles', shadeLabel: 'Pattern', shades: TILE_PATTERNS },
    ],
  },
  { id: 'walls', label: 'Wall paint', group: 'surfaces', noun: 'the painted walls', rooms: ['kitchen', 'bedroom', 'living', 'dining', 'kids', 'study', 'pooja'], materials: PAINT },
  {
    id: 'feature-wall',
    label: 'Feature wall',
    group: 'surfaces',
    noun: 'the main feature wall (behind the bed, TV, sofa, dining table or mandir)',
    rooms: ['bedroom', 'living', 'dining', 'kids', 'study', 'pooja'],
    materials: [
      { id: 'fluted', label: 'Fluted panels', prompt: 'vertical fluted wood panelling', shadeLabel: 'Wood', shades: WOOD },
      { id: 'panelling', label: 'PU panelling', prompt: 'PU-painted wall panelling with simple moulded frames', shadeLabel: 'Colour', shades: SOLID, custom: true },
      { id: 'wallpaper', label: 'Wallpaper', prompt: '{shade} wallpaper', shadeLabel: 'Pattern', shades: [
        { id: 'linen', label: 'Textured linen', prompt: 'subtle textured linen-look', hex: '#D8CFC0' },
        { id: 'botanical', label: 'Botanical', prompt: 'muted botanical leaf-print', hex: '#7E8C6E' },
        { id: 'geometric', label: 'Geometric', prompt: 'fine gold-line geometric', hex: '#BFA36C' },
        { id: 'stripes', label: 'Pinstripe', prompt: 'thin vertical pinstripe', hex: '#9BA3AC' },
      ] },
      { id: 'stone', label: 'Stone cladding', prompt: 'stone cladding', shadeLabel: 'Stone', shades: [
        { id: 'slate', label: 'Grey slate', prompt: 'stacked grey slate', hex: '#5D6064' },
        { id: 'sandstone', label: 'Sandstone', prompt: 'beige sandstone', hex: '#CDB48D' },
        { id: 'white-brick', label: 'White brick', prompt: 'white-painted exposed brick', hex: '#E9E6E0' },
        { id: 'red-brick', label: 'Red brick', prompt: 'exposed red brick', hex: '#9C5B42' },
      ] },
      { id: 'jaali', label: 'CNC jaali', prompt: 'a {shade} CNC-cut jaali screen panel with soft backlight', shadeLabel: 'Finish', shades: [
        { id: 'white', label: 'White', hex: '#F2F0EB' },
        { id: 'gold', label: 'Gold', hex: '#C2A15E' },
        { id: 'teak', label: 'Teak wood', prompt: 'teak wood', hex: '#A8743F' },
      ] },
    ],
  },
  {
    id: 'floor',
    label: 'Flooring',
    group: 'surfaces',
    noun: 'the floor',
    materials: [
      { id: 'vitrified', label: 'Vitrified tiles', prompt: '{shade} large-format vitrified tiles with thin joints', shadeLabel: 'Colour', shades: [
        { id: 'white', label: 'Glossy white', prompt: 'white', hex: '#F1EFEA' },
        { id: 'beige', label: 'Light beige', prompt: 'light beige', hex: '#E5D9C4' },
        { id: 'grey', label: 'Warm grey', prompt: 'warm grey', hex: '#A7A29B' },
        { id: 'dark', label: 'Dark grey', prompt: 'dark grey', hex: '#55575A' },
        { id: 'marble-look', label: 'Marble-look', prompt: 'white marble-look', hex: '#ECE8E2' },
      ], finishLabel: 'Surface', finishes: TILE_FINISH },
      { id: 'wood', label: 'Wooden', prompt: 'wood-look plank flooring', shadeLabel: 'Wood', shades: WOOD.slice(0, 7), finishLabel: 'Laying', finishes: [
        { id: 'planks', label: 'Straight planks', prompt: 'laid in straight planks' },
        { id: 'herringbone', label: 'Herringbone', prompt: 'laid in a herringbone pattern' },
        { id: 'chevron', label: 'Chevron', prompt: 'laid in a chevron pattern' },
      ] },
      { id: 'marble', label: 'Marble', prompt: 'polished marble slabs', shadeLabel: 'Stone', shades: [
        { id: 'italian-white', label: 'Italian white', prompt: 'Italian white', hex: '#F0ECE6' },
        { id: 'botticino', label: 'Botticino beige', prompt: 'Botticino beige', hex: '#E0D2B8' },
        { id: 'grey', label: 'Grey vein', prompt: 'grey-veined', hex: '#B8B6B2' },
      ] },
      { id: 'kota', label: 'Kota / natural stone', prompt: 'natural Kota stone', shadeLabel: 'Stone', shades: [
        { id: 'blue', label: 'Kota blue-grey', prompt: 'blue-grey', hex: '#6E7C80' },
        { id: 'brown', label: 'Kota brown', prompt: 'brown', hex: '#8A6A4D' },
      ] },
      { id: 'terrazzo', label: 'Terrazzo', prompt: 'terrazzo', shadeLabel: 'Colour', shades: SOLID.slice(0, 6) },
    ],
  },
  {
    id: 'ceiling',
    label: 'Ceiling',
    group: 'surfaces',
    noun: 'the ceiling',
    reshape: true,
    materials: [
      { id: 'cove', label: 'False ceiling + cove', prompt: 'a gypsum false ceiling with a recessed warm-white cove light around its edge' },
      { id: 'peripheral', label: 'Peripheral drop', prompt: 'a peripheral gypsum false ceiling drop around the edges with recessed downlights, flat in the centre' },
      { id: 'slats', label: 'Wooden slats', prompt: 'a wooden slat ceiling panel over the main area with hidden warm lighting' },
      { id: 'plain', label: 'Plain gypsum', prompt: 'a flat, clean white gypsum ceiling with recessed downlights' },
    ],
  },
];

// ---------------------------------------------------------------- suggested changes (Mark & edit)

/** A ready-made change, shown as a clickable prompt once the part is marked. */
export interface Suggestion extends Selection {
  /** Wording on the button when the automatic one ("Sage green laminate, matte") reads badly. */
  label?: string;
}

const SHUTTER_SUGGEST: Suggestion[] = [
  { material: 'laminate', shade: 'sage', finish: 'super-matte' },
  { material: 'acrylic', shade: 'frosty-white', finish: 'gloss' },
  { material: 'laminate', shade: 'graphite', finish: 'super-matte' },
  { material: 'wood-laminate', shade: 'light-oak', finish: 'matte' },
  { material: 'veneer', shade: 'walnut', finish: 'open-pore' },
  { material: 'pu', shade: 'navy', finish: 'satin' },
  { material: 'laminate', shade: 'cashmere', finish: 'matte' },
  { material: 'glass', shade: 'fluted', finish: 'black', label: 'Fluted glass in black profile' },
];

const UPHOLSTERY_SUGGEST: Suggestion[] = [
  { material: 'fabric', shade: 'oatmeal' },
  { material: 'boucle', shade: 'ivory' },
  { material: 'velvet', shade: 'emerald' },
  { material: 'leather', shade: 'tan' },
  { material: 'velvet', shade: 'navy' },
  { material: 'fabric', shade: 'charcoal' },
  { material: 'veneer', shade: 'walnut', finish: 'open-pore' },
  { material: 'wood-laminate', shade: 'light-oak', finish: 'matte' },
];

/** Element id -> suggestions. Ones whose material the part does not have are skipped. */
const SUGGESTIONS: Record<string, Suggestion[]> = {
  handles: [
    { material: 'gola', shade: 'matte-black', label: 'Matte black G-profile (handleless)' },
    { material: 'bar', shade: 'brushed-gold', label: 'Brushed gold slim bar handles' },
    { material: 'bar', shade: 'matte-black', label: 'Matte black slim bar handles' },
    { material: 'edge', shade: 'brushed-steel', label: 'Brushed steel edge profile' },
    { material: 'knob', shade: 'antique-brass', label: 'Antique brass knobs' },
    { material: 'push', label: 'No handles (push-to-open)' },
  ],
  countertop: [
    { material: 'quartz', shade: 'calacatta', finish: 'polished' },
    { material: 'granite', shade: 'black-galaxy', finish: 'polished' },
    { material: 'granite', shade: 'absolute-black', finish: 'leathered' },
    { material: 'quartz', shade: 'pure-white', finish: 'polished' },
    { material: 'marble', shade: 'statuario', finish: 'polished' },
    { material: 'sintered', shade: 'nero', finish: 'honed' },
    { material: 'quartz', shade: 'concrete', finish: 'honed' },
    { material: 'wood', shade: 'light-oak' },
  ],
  backsplash: [
    { material: 'slab', shade: 'calacatta', finish: 'polished' },
    { material: 'subway', shade: 'frosty-white', finish: 'gloss' },
    { material: 'zellige', shade: 'sage' },
    { material: 'pattern', shade: 'moroccan' },
    { material: 'glass', shade: 'graphite' },
    { material: 'subway', shade: 'forest', finish: 'gloss' },
  ],
  'wall-tiles': [
    { material: 'large', shade: 'statuario', finish: 'gloss' },
    { material: 'large', shade: 'concrete', finish: 'matte' },
    { material: 'subway', shade: 'frosty-white', finish: 'gloss' },
    { material: 'pattern', shade: 'terrazzo' },
    { material: 'pattern', shade: 'hexagon' },
    { material: 'subway', shade: 'sage', finish: 'matte' },
  ],
  walls: [
    { material: 'emulsion', shade: 'ivory', finish: 'matte' },
    { material: 'emulsion', shade: 'greige', finish: 'eggshell' },
    { material: 'emulsion', shade: 'sage', finish: 'matte' },
    { material: 'emulsion', shade: 'powder-blue', finish: 'matte' },
    { material: 'limewash', shade: 'terracotta' },
    { material: 'texture', shade: 'cashmere' },
  ],
  'feature-wall': [
    { material: 'fluted', shade: 'walnut' },
    { material: 'panelling', shade: 'sage' },
    { material: 'wallpaper', shade: 'linen' },
    { material: 'stone', shade: 'white-brick' },
    { material: 'stone', shade: 'slate' },
    { material: 'jaali', shade: 'gold' },
  ],
  floor: [
    { material: 'vitrified', shade: 'marble-look', finish: 'gloss' },
    { material: 'wood', shade: 'light-oak', finish: 'herringbone', label: 'Light oak wooden floor, herringbone' },
    { material: 'wood', shade: 'natural-teak', finish: 'planks', label: 'Natural teak wooden floor, straight planks' },
    { material: 'marble', shade: 'italian-white' },
    { material: 'vitrified', shade: 'grey', finish: 'matte' },
    { material: 'kota', shade: 'blue' },
  ],
  ceiling: [{ material: 'cove' }, { material: 'peripheral' }, { material: 'slats' }, { material: 'plain' }],
  bed: UPHOLSTERY_SUGGEST,
  sofa: UPHOLSTERY_SUGGEST,
};

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** The ready-made changes for one part, as clickable prompts: "Sage green laminate, super-matte". */
export function suggestionsFor(element: RoomElement): { selection: Selection; label: string; hex?: string }[] {
  const list = SUGGESTIONS[element.id] ?? (element.materials.includes(SHUTTER_MATERIALS[0]) ? SHUTTER_SUGGEST : undefined);
  // Parts without a list get the first shade of each material.
  const items: Suggestion[] = list ?? element.materials.map((m) => ({ material: m.id, shade: m.shades?.[0]?.id, finish: m.finishes?.[0]?.id }));
  return items.flatMap(({ label, ...selection }) => {
    const r = resolveSelection(element, selection);
    // Skip suggestions this part can't take (a material or shade it does not have).
    if (!r || (selection.shade && !r.shade) || (selection.finish && !r.finish)) return [];
    const name = r.shade ? `${r.shade.label} ${lowerFirst(r.material.label)}` : r.material.label;
    return [{ selection, label: label ?? (r.finish ? `${name}, ${lowerFirst(r.finish.label)}` : name), hex: r.shade?.hex }];
  });
}

// ---------------------------------------------------------------- Standard mode: light and extras

export const MOODS: Choice[] = [
  { id: '', label: 'As in image', prompt: '' },
  { id: 'daylight', label: 'Bright daylight', prompt: 'Bright, natural daytime light coming through the existing windows, neutral white balance.' },
  { id: 'evening', label: 'Warm evening', prompt: 'Evening: warm 3000K interior lighting is on, cosy and inviting, windows darker.' },
  { id: 'showroom', label: 'Showroom', prompt: 'Even, bright neutral 4000K showroom lighting that shows the materials and colours accurately.' },
];

export interface AddOn extends Choice {
  section: 'lighting' | 'cleanup' | 'staging';
  rooms?: readonly RoomTypeId[];
  prompt: string;
}

/** Independent additions. Staging items ADD objects, so they are kept clearly separate. */
export const ADDONS: AddOn[] = [
  { id: 'under-cabinet', section: 'lighting', label: 'Under-cabinet LED', rooms: ['kitchen'], prompt: 'Add warm LED profile strip lights under the wall cabinets, with an even glow on the backsplash.' },
  { id: 'profile-lights', section: 'lighting', label: 'Profile lights in units', rooms: ['kitchen', 'bedroom', 'living', 'dining', 'kids', 'study', 'pooja'], prompt: 'Add warm LED profile lights inside open shelves and glass-shutter units.' },
  { id: 'downlights', section: 'lighting', label: 'Downlights', prompt: 'Add evenly spaced recessed downlights in the ceiling.' },
  { id: 'pendants', section: 'lighting', label: 'Pendant lights', rooms: ['kitchen', 'dining', 'bedroom', 'living'], prompt: 'Add two or three pendant lights over the counter, island, dining table or bedside.' },
  { id: 'declutter', section: 'cleanup', label: 'Declutter', prompt: 'Remove clutter, loose items and visible wires from counters, floor and shelves.' },
  { id: 'clean-walls', section: 'cleanup', label: 'Fix stains & cracks', prompt: 'Clean up stains, damp marks and cracks on walls and ceiling so surfaces look freshly finished.' },
  { id: 'counter-styling', section: 'staging', label: 'Countertop styling', rooms: ['kitchen', 'bathroom'], prompt: 'Add a few tasteful accessories on the counter (a fruit bowl, a small plant, a chopping board).' },
  { id: 'plants', section: 'staging', label: 'Indoor plants', prompt: 'Add one or two healthy indoor plants in simple planters, without blocking any cabinet.' },
  { id: 'curtains', section: 'staging', label: 'Curtains / blinds', prompt: 'Add simple linen curtains or roller blinds on the existing windows.' },
  { id: 'art', section: 'staging', label: 'Wall art', rooms: ['bedroom', 'living', 'dining', 'kids', 'study'], prompt: 'Add one or two framed artworks on a free wall, at eye level.' },
  { id: 'rug', section: 'staging', label: 'Rug', rooms: ['living', 'bedroom', 'dining', 'kids', 'study'], prompt: 'Add a neutral area rug that fits the furniture layout.' },
];

export const ADDON_SECTIONS = [
  { id: 'lighting', label: 'Lighting' },
  { id: 'cleanup', label: 'Clean-up' },
  { id: 'staging', label: 'Staging · adds objects' },
] as const;

export const MAX_VARIANTS = 4;
export const NOTES_MAX = 300;
/** The most a prompt bar takes: details for a part, or a Mark & edit change in staff's own words. */
export const INSTRUCTION_MAX = 160;

/** Prompt-bar text as it goes to the AI: one line, no stray spaces, within the limit. */
export const cleanText = (s: string | undefined, max = INSTRUCTION_MAX) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------------------------------------------------------------- reading a selection

export function appliesTo(item: { rooms?: readonly RoomTypeId[] }, room: RoomTypeId): boolean {
  return !item.rooms || item.rooms.includes(room);
}

export const elementsFor = (room: RoomTypeId) => ELEMENTS.filter((e) => appliesTo(e, room));

export interface ResolvedSelection {
  element: RoomElement;
  material: Material;
  shade?: Choice;
  colour?: string;
  finish?: Choice;
  profile?: Choice;
  /** Data URL of the material sample photo, for materials that have shades. */
  sample?: string;
  area?: Point;
  details?: string;
}

const inUnit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

/** Resolves ids against the catalogue. Returns null if the material is unknown; unknown sub-options are dropped. */
export function resolveSelection(element: RoomElement, sel: Selection): ResolvedSelection | null {
  const material = element.materials.find((m) => m.id === sel.material);
  if (!material) return null;
  return {
    element,
    material,
    shade: material.shades?.find((s) => s.id === sel.shade),
    colour: material.custom && sel.colour && /^#[0-9a-f]{6}$/i.test(sel.colour) ? sel.colour.toUpperCase() : undefined,
    finish: material.finishes?.find((f) => f.id === sel.finish),
    profile: element.profiles?.find((p) => p.id === sel.profile),
    // A sample stands in for a shade, so only materials that have shades take one.
    sample: material.shades && sel.sample ? sel.sample : undefined,
    area: sel.area && inUnit(sel.area.x) && inUnit(sel.area.y) ? { x: sel.area.x, y: sel.area.y } : undefined,
    details: cleanText(sel.details) || undefined,
  };
}

const words = (c: Choice) => c.prompt ?? c.label.toLowerCase();

const AREA_NAMES = [
  ['upper left', 'upper centre', 'upper right'],
  ['left', 'centre', 'right'],
  ['lower left', 'lower centre', 'lower right'],
];

/** "lower left", "centre"... the third of the image a point falls in. */
export function areaLabel(p: Point): string {
  const band = (n: number) => (n < 1 / 3 ? 0 : n > 2 / 3 ? 2 : 1);
  return AREA_NAMES[band(p.y)][band(p.x)];
}

/** A picked point in words for the AI (Standard mode). */
export function describeArea(p: Point): string {
  const pct = (n: number) => Math.round(n * 100);
  return `${areaLabel(p)} of the image (about ${pct(p.x)}% from the left and ${pct(p.y)}% from the top)`;
}

/** Short, human spec: "Sage green · Laminate · Super-matte · Shaker". */
export function describeSelection(r: ResolvedSelection): { value: string; hex?: string } {
  const parts = [
    r.sample ? 'From sample' : r.colour ? `Custom ${r.colour}` : r.shade?.label,
    r.material.label,
    r.finish?.label,
    r.profile?.label,
    r.area && `at ${areaLabel(r.area)}`,
    r.details && `“${r.details.length > 40 ? `${r.details.slice(0, 38).trimEnd()}…` : r.details}”`,
  ].filter(Boolean);
  return { value: parts.join(' · '), hex: r.sample ? undefined : (r.colour ?? r.shade?.hex) };
}

/** The material and shade in words: "sage green (#9AA98F) laminate". Without the shade when a sample photo stands in for it. */
function materialWords(r: ResolvedSelection, fromSample = false): string {
  const shade = fromSample
    ? ''
    : r.colour
      ? `a custom colour ${r.colour} (${describeHex(r.colour)})`
      : r.shade
        ? r.material.custom && r.shade.hex
          ? `${words(r.shade)} (${r.shade.hex})`
          : words(r.shade)
        : '';
  const noun = r.material.prompt;
  return noun.includes('{shade}')
    ? noun.replace('{shade}', shade).replace(/\s+/g, ' ').trim()
    : !shade
      ? noun
      : r.material.custom
        ? `${shade} ${noun}`
        : `${noun} in ${shade}`;
}

/** Mark & edit: the new finish in words, "sage green (#9AA98F) laminate, with a matte finish". Details are added separately. */
export function finishPrompt(r: ResolvedSelection): string {
  const what = materialWords(r);
  return r.finish ? `${what}, ${words(r.finish)}` : what;
}

/** Staff's details as a sentence for the prompt: "Details: fluted grooves about 2 cm apart." */
export const detailsSentence = (details: string | undefined) => (details ? `Details: ${details.replace(/[.\s]+$/, '')}.` : '');

/**
 * Standard mode: the instruction for one changed part of the room.
 * `sampleRef` is how the prompt names the sample image, e.g. "<IMAGE_1>" (it depends on the AI provider).
 */
export function selectionPrompt(r: ResolvedSelection, sampleRef?: string): string {
  const sample = r.sample && sampleRef;
  let what = materialWords(r, Boolean(sample));
  if (sample) what += ` that exactly matches the material sample in ${sampleRef}: the same colour, pattern, grain direction and texture, at a true-to-life scale`;
  const tail = [r.profile && words(r.profile), r.finish && words(r.finish)].filter(Boolean).join(', ');
  const target = r.area ? `${r.element.noun} located at the ${describeArea(r.area)}, and only those,` : r.element.noun;
  return [`Change ${target} to ${what}${tail ? `, ${tail}` : ''}.`, detailsSentence(r.details)].filter(Boolean).join(' ');
}

/**
 * Where the marked area is, in words: "lower left part of the photo (about 5–48% from
 * the left, 55–100% from the top)". The edit API takes no mask, so this is how the AI
 * is pointed at the part. Empty when the mark covers most of the photo.
 */
export function describeBox(b: Box): string {
  if (b.w > 0.75 && b.h > 0.75) return '';
  // Which third the centre is in, or null when the box spans most of that direction.
  const band = (start: number, size: number) => {
    if (size > 0.66) return null;
    const centre = start + size / 2;
    return centre < 1 / 3 ? 0 : centre > 2 / 3 ? 2 : 1;
  };
  const v = band(b.y, b.h);
  const h = band(b.x, b.w);
  const name =
    [v === null ? '' : ['upper', '', 'lower'][v], h === null ? '' : ['left', '', 'right'][h]].filter(Boolean).join(' ') ||
    (v === 1 || h === 1 ? 'centre' : '');
  const pct = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100);
  const range = `about ${pct(b.x)}–${pct(b.x + b.w)}% from the left and ${pct(b.y)}–${pct(b.y + b.h)}% from the top`;
  return name ? `${name} part of the photo (${range})` : `area ${range}`;
}
