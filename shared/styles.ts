import { ELEMENTS, appliesTo, type RoomTypeId, type Selection } from './catalog';

// Design styles (Modern, Luxury, Minimalist...) as STARTING POINTS, never as a
// whole-room restyle. A style is a set of material-and-colour combinations
// ("Graphite & oak") that fill in the per-part spec; staff then change any part,
// and every part they do not include stays exactly as in the photo. That is how
// the customer's real design is kept: the AI only changes what is listed.
//
// - Empty or unfinished room (Generate): the combination's finishes and the
//   furniture staff tick are added; walls, windows, doors and camera are kept.
// - Furnished room (Standard): "Apply style" fills only the parts staff choose.
//
// Every selection uses ids from catalog.ts; styles.test.ts checks they resolve.

/** Families of parts a combination sets at once. */
export type StylePart =
  | 'shutters' // base cabinets, tall units, wardrobe, loft, TV unit, storage, pooja unit, vanity, study table
  | 'accent' // wall cabinets (a second colour); falls back to shutters
  | 'handles'
  | 'countertop'
  | 'backsplash'
  | 'wallTiles'
  | 'walls'
  | 'featureWall'
  | 'floor'
  | 'ceiling'
  | 'upholstery'; // sofa, bed

const FAMILY: Record<string, StylePart> = {
  'base-cabinets': 'shutters',
  'tall-units': 'shutters',
  wardrobe: 'shutters',
  loft: 'shutters',
  'tv-unit': 'shutters',
  storage: 'shutters',
  'pooja-unit': 'shutters',
  vanity: 'shutters',
  'study-unit': 'shutters',
  'wall-cabinets': 'accent',
  handles: 'handles',
  countertop: 'countertop',
  backsplash: 'backsplash',
  'wall-tiles': 'wallTiles',
  walls: 'walls',
  'feature-wall': 'featureWall',
  floor: 'floor',
  ceiling: 'ceiling',
  sofa: 'upholstery',
  bed: 'upholstery',
};

export interface StylePalette {
  id: string;
  label: string;
  /** Swatches for the card and the presentation board, main colour first. */
  colours: string[];
  parts: Partial<Record<StylePart, Selection & { profile?: string }>>;
}

export interface DesignStyle {
  id: string;
  label: string;
  /** One line for the style card. */
  blurb: string;
  /** Style words for the prompt; never asks for layout changes. */
  prompt: string;
  /** How furniture should look in this style, for recommendations. */
  furnitureLook: string;
  palettes: StylePalette[];
}

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: 'modern',
    label: 'Modern',
    blurb: 'Clean lines, flat handle-less fronts, matte surfaces with warm wood.',
    prompt: 'modern: clean lines, flat slab fronts, handle-less profiles, matte surfaces with warm wood accents and concealed warm lighting',
    furnitureLook: 'low, clean-lined, slim metal or wood legs',
    palettes: [
      {
        id: 'graphite-oak',
        label: 'Graphite & oak',
        colours: ['#45484C', '#C8A97E', '#F4F3F0', '#1E1E1F'],
        parts: {
          shutters: { material: 'laminate', shade: 'graphite', finish: 'super-matte', profile: 'slab' },
          accent: { material: 'wood-laminate', shade: 'light-oak', finish: 'matte' },
          handles: { material: 'gola', shade: 'matte-black' },
          countertop: { material: 'quartz', shade: 'pure-white', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'calacatta', finish: 'honed' },
          wallTiles: { material: 'large', shade: 'concrete', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          featureWall: { material: 'fluted', shade: 'light-oak' },
          floor: { material: 'vitrified', shade: 'grey', finish: 'matte' },
          ceiling: { material: 'peripheral' },
          upholstery: { material: 'fabric', shade: 'light-grey' },
        },
      },
      {
        id: 'white-walnut',
        label: 'White & walnut',
        colours: ['#F3F2EE', '#5C4033', '#9D9C99', '#A7AAAD'],
        parts: {
          shutters: { material: 'acrylic', shade: 'frosty-white', finish: 'gloss', profile: 'slab' },
          accent: { material: 'wood-laminate', shade: 'walnut', finish: 'matte' },
          handles: { material: 'gola', shade: 'brushed-steel' },
          countertop: { material: 'quartz', shade: 'concrete', finish: 'honed' },
          backsplash: { material: 'subway', shade: 'frosty-white', finish: 'gloss' },
          wallTiles: { material: 'large', shade: 'pure-white', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'greige', finish: 'matte' },
          featureWall: { material: 'fluted', shade: 'walnut' },
          floor: { material: 'wood', shade: 'light-oak', finish: 'planks' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'fabric', shade: 'charcoal' },
        },
      },
      {
        id: 'sage-ivory',
        label: 'Sage & ivory',
        colours: ['#9AA98F', '#EDE6D6', '#EEEBE6', '#C2A15E'],
        parts: {
          shutters: { material: 'laminate', shade: 'sage', finish: 'matte', profile: 'slab' },
          accent: { material: 'laminate', shade: 'ivory', finish: 'matte' },
          handles: { material: 'bar', shade: 'brushed-gold' },
          countertop: { material: 'quartz', shade: 'calacatta', finish: 'polished' },
          backsplash: { material: 'zellige', shade: 'ivory' },
          wallTiles: { material: 'large', shade: 'beige', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'ivory', finish: 'matte' },
          featureWall: { material: 'panelling', shade: 'sage' },
          floor: { material: 'vitrified', shade: 'beige', finish: 'matte' },
          ceiling: { material: 'peripheral' },
          upholstery: { material: 'boucle', shade: 'oatmeal' },
        },
      },
    ],
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'High-gloss lacquer, marble, brass and gold, layered warm light.',
    prompt: 'luxury: rich high-gloss lacquer, book-matched marble, brushed gold and brass details and layered warm lighting, elegant and polished',
    furnitureLook: 'plush, tufted or channel-stitched, with brass or gold details',
    palettes: [
      {
        id: 'black-gold',
        label: 'Black & gold',
        colours: ['#232427', '#C2A15E', '#F1EFEC', '#2F6B55'],
        parts: {
          shutters: { material: 'pu', shade: 'black', finish: 'gloss', profile: 'slab' },
          accent: { material: 'glass', shade: 'bronze', finish: 'gold' },
          handles: { material: 'bar', shade: 'brushed-gold' },
          countertop: { material: 'marble', shade: 'statuario', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'calacatta', finish: 'polished' },
          wallTiles: { material: 'large', shade: 'calacatta', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'cashmere', finish: 'eggshell' },
          featureWall: { material: 'fluted', shade: 'walnut' },
          floor: { material: 'marble', shade: 'italian-white' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'velvet', shade: 'emerald' },
        },
      },
      {
        id: 'ivory-champagne',
        label: 'Ivory & champagne',
        colours: ['#EDE6D6', '#8C6A3A', '#EEEBE6', '#D9CDBD'],
        parts: {
          shutters: { material: 'pu', shade: 'ivory', finish: 'gloss', profile: 'shaker' },
          accent: { material: 'glass', shade: 'fluted', finish: 'gold' },
          handles: { material: 'edge', shade: 'antique-brass' },
          countertop: { material: 'sintered', shade: 'calacatta', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'statuario', finish: 'polished' },
          wallTiles: { material: 'large', shade: 'statuario', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'ivory', finish: 'eggshell' },
          featureWall: { material: 'panelling', shade: 'cashmere' },
          floor: { material: 'marble', shade: 'botticino' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'velvet', shade: 'ivory' },
        },
      },
      {
        id: 'emerald-walnut',
        label: 'Emerald & walnut',
        colours: ['#2F4F43', '#5C4033', '#EEEBE6', '#8C6A3A'],
        parts: {
          shutters: { material: 'pu', shade: 'forest', finish: 'satin', profile: 'shaker' },
          accent: { material: 'veneer', shade: 'walnut', finish: 'satin' },
          handles: { material: 'bar', shade: 'antique-brass' },
          countertop: { material: 'marble', shade: 'emperador', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'calacatta', finish: 'polished' },
          wallTiles: { material: 'large', shade: 'nero', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'ivory', finish: 'eggshell' },
          featureWall: { material: 'fluted', shade: 'walnut' },
          floor: { material: 'wood', shade: 'walnut', finish: 'herringbone' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'velvet', shade: 'emerald' },
        },
      },
    ],
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    blurb: 'Few materials, flat fronts, soft neutrals, nothing extra.',
    prompt: 'minimalist: very few materials, flat handle-less fronts, soft neutral colours, calm and uncluttered, hidden storage',
    furnitureLook: 'simple, low and light, few pieces, no ornament',
    palettes: [
      {
        id: 'all-white',
        label: 'All white',
        colours: ['#F3F2EE', '#F4F3F0', '#EDE6D6', '#A7AAAD'],
        parts: {
          shutters: { material: 'laminate', shade: 'frosty-white', finish: 'super-matte', profile: 'slab' },
          handles: { material: 'push' },
          countertop: { material: 'quartz', shade: 'pure-white', finish: 'honed' },
          backsplash: { material: 'slab', shade: 'pure-white', finish: 'honed' },
          wallTiles: { material: 'large', shade: 'pure-white', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          floor: { material: 'vitrified', shade: 'white', finish: 'matte' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'fabric', shade: 'ivory' },
        },
      },
      {
        id: 'greige-calm',
        label: 'Greige calm',
        colours: ['#B5ABA0', '#D9C9AE', '#D9CDBD', '#A7AAAD'],
        parts: {
          shutters: { material: 'laminate', shade: 'greige', finish: 'super-matte', profile: 'slab' },
          handles: { material: 'gola', shade: 'brushed-steel' },
          countertop: { material: 'corian', shade: 'greige' },
          backsplash: { material: 'slab', shade: 'beige', finish: 'honed' },
          wallTiles: { material: 'large', shade: 'beige', finish: 'matte' },
          walls: { material: 'limewash', shade: 'greige' },
          floor: { material: 'terrazzo', shade: 'cashmere' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'boucle', shade: 'oatmeal' },
        },
      },
      {
        id: 'light-oak',
        label: 'Light oak',
        colours: ['#D9C6A5', '#F3F2EE', '#F4F3F0', '#A7AAAD'],
        parts: {
          shutters: { material: 'wood-laminate', shade: 'bleached-oak', finish: 'matte', profile: 'slab' },
          accent: { material: 'laminate', shade: 'frosty-white', finish: 'super-matte' },
          handles: { material: 'edge', shade: 'brushed-steel' },
          countertop: { material: 'quartz', shade: 'pure-white', finish: 'honed' },
          backsplash: { material: 'slab', shade: 'pure-white', finish: 'honed' },
          wallTiles: { material: 'large', shade: 'pure-white', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          floor: { material: 'wood', shade: 'bleached-oak', finish: 'planks' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'fabric', shade: 'oatmeal' },
        },
      },
    ],
  },
  {
    id: 'industrial',
    label: 'Industrial',
    blurb: 'Concrete, dark metal, smoked wood and brick textures.',
    prompt: 'industrial: raw concrete and brick textures, dark metal, smoked wood, matte black fittings and warm Edison-style lighting',
    furnitureLook: 'leather and dark metal frames, reclaimed or smoked wood tops',
    palettes: [
      {
        id: 'concrete-black',
        label: 'Concrete & black',
        colours: ['#8E9093', '#232427', '#9D9C99', '#A4532F'],
        parts: {
          shutters: { material: 'laminate', shade: 'stone-grey', finish: 'textured', profile: 'slab' },
          accent: { material: 'glass', shade: 'smoke', finish: 'black' },
          handles: { material: 'bar', shade: 'matte-black' },
          countertop: { material: 'quartz', shade: 'concrete', finish: 'honed' },
          backsplash: { material: 'subway', shade: 'black', finish: 'matte' },
          wallTiles: { material: 'large', shade: 'concrete', finish: 'matte' },
          walls: { material: 'texture', shade: 'stone-grey' },
          featureWall: { material: 'stone', shade: 'red-brick' },
          floor: { material: 'vitrified', shade: 'grey', finish: 'matte' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'leather', shade: 'cognac' },
        },
      },
      {
        id: 'smoked-steel',
        label: 'Smoked oak & steel',
        colours: ['#6E5A47', '#45484C', '#4A4C50', '#C9CBCC'],
        parts: {
          shutters: { material: 'wood-laminate', shade: 'smoked-oak', finish: 'textured', profile: 'slab' },
          accent: { material: 'laminate', shade: 'graphite', finish: 'super-matte' },
          handles: { material: 'bar', shade: 'gunmetal' },
          countertop: { material: 'granite', shade: 'steel-grey', finish: 'leathered' },
          backsplash: { material: 'subway', shade: 'graphite', finish: 'gloss' },
          wallTiles: { material: 'large', shade: 'concrete', finish: 'matte' },
          walls: { material: 'texture', shade: 'light-grey' },
          featureWall: { material: 'stone', shade: 'slate' },
          floor: { material: 'wood', shade: 'smoked-oak', finish: 'planks' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'leather', shade: 'tan' },
        },
      },
    ],
  },
  {
    id: 'scandinavian',
    label: 'Scandinavian',
    blurb: 'Light woods, white and soft pastels, cosy natural textures.',
    prompt: 'Scandinavian: light natural woods, white and soft pastel colours, simple shapes, natural textures, bright and cosy',
    furnitureLook: 'light wood, rounded edges, soft natural fabrics',
    palettes: [
      {
        id: 'birch-white',
        label: 'Birch & white',
        colours: ['#F3F2EE', '#C8A97E', '#BFC1C2', '#A7AAAD'],
        parts: {
          shutters: { material: 'laminate', shade: 'frosty-white', finish: 'matte', profile: 'slab' },
          accent: { material: 'wood-laminate', shade: 'light-oak', finish: 'matte' },
          handles: { material: 'edge', shade: 'brushed-steel' },
          countertop: { material: 'wood', shade: 'light-oak' },
          backsplash: { material: 'subway', shade: 'frosty-white', finish: 'gloss' },
          wallTiles: { material: 'large', shade: 'pure-white', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          featureWall: { material: 'panelling', shade: 'powder-blue' },
          floor: { material: 'wood', shade: 'light-oak', finish: 'planks' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'fabric', shade: 'light-grey' },
        },
      },
      {
        id: 'powder-blue',
        label: 'Powder blue',
        colours: ['#B9CCDA', '#D9C6A5', '#F3F2EE', '#C2A15E'],
        parts: {
          shutters: { material: 'laminate', shade: 'powder-blue', finish: 'matte', profile: 'shaker' },
          accent: { material: 'wood-laminate', shade: 'bleached-oak', finish: 'matte' },
          handles: { material: 'knob', shade: 'brushed-gold' },
          countertop: { material: 'quartz', shade: 'pure-white', finish: 'honed' },
          backsplash: { material: 'zellige', shade: 'frosty-white' },
          wallTiles: { material: 'large', shade: 'pure-white', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          featureWall: { material: 'panelling', shade: 'powder-blue' },
          floor: { material: 'wood', shade: 'bleached-oak', finish: 'planks' },
          ceiling: { material: 'plain' },
          upholstery: { material: 'fabric', shade: 'oatmeal' },
        },
      },
    ],
  },
  {
    id: 'indian',
    label: 'Contemporary Indian',
    blurb: 'Teak and rosewood, jaali details, brass accents, earthy tones.',
    prompt: 'contemporary Indian: warm teak and rosewood, jaali (lattice) details, brass accents and earthy colours, rich but uncluttered',
    furnitureLook: 'solid wood with cane or brass details, earthy handloom fabrics',
    palettes: [
      {
        id: 'teak-brass',
        label: 'Teak & brass',
        colours: ['#A8743F', '#EDE6D6', '#8C6A3A', '#C9A03A'],
        parts: {
          shutters: { material: 'veneer', shade: 'natural-teak', finish: 'satin', profile: 'slab' },
          accent: { material: 'laminate', shade: 'ivory', finish: 'matte' },
          handles: { material: 'bar', shade: 'antique-brass' },
          countertop: { material: 'granite', shade: 'black-galaxy', finish: 'polished' },
          backsplash: { material: 'pattern', shade: 'moroccan' },
          wallTiles: { material: 'large', shade: 'beige', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'ivory', finish: 'matte' },
          featureWall: { material: 'jaali', shade: 'teak' },
          floor: { material: 'marble', shade: 'botticino' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'fabric', shade: 'mustard' },
        },
      },
      {
        id: 'terracotta-cream',
        label: 'Terracotta & cream',
        colours: ['#B9634A', '#EDE6D6', '#D9CDBD', '#8C6A3A'],
        parts: {
          shutters: { material: 'laminate', shade: 'terracotta', finish: 'matte', profile: 'slab' },
          accent: { material: 'laminate', shade: 'ivory', finish: 'matte' },
          handles: { material: 'knob', shade: 'antique-brass' },
          countertop: { material: 'granite', shade: 'kashmir-white', finish: 'polished' },
          backsplash: { material: 'zellige', shade: 'ivory' },
          wallTiles: { material: 'large', shade: 'beige', finish: 'matte' },
          walls: { material: 'emulsion', shade: 'cashmere', finish: 'matte' },
          featureWall: { material: 'jaali', shade: 'gold' },
          floor: { material: 'kota', shade: 'brown' },
          ceiling: { material: 'peripheral' },
          upholstery: { material: 'fabric', shade: 'rust' },
        },
      },
      {
        id: 'rosewood-white',
        label: 'Rosewood & white',
        colours: ['#5A2E24', '#F3F2EE', '#C2A15E', '#2F6B55'],
        parts: {
          shutters: { material: 'wood-laminate', shade: 'rosewood', finish: 'matte', profile: 'slab' },
          accent: { material: 'pu', shade: 'frosty-white', finish: 'satin' },
          handles: { material: 'bar', shade: 'brushed-gold' },
          countertop: { material: 'marble', shade: 'makrana', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'statuario', finish: 'polished' },
          wallTiles: { material: 'large', shade: 'statuario', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'frosty-white', finish: 'matte' },
          featureWall: { material: 'fluted', shade: 'rosewood' },
          floor: { material: 'marble', shade: 'italian-white' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'velvet', shade: 'emerald' },
        },
      },
    ],
  },
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'Shaker fronts, soft colours, brass knobs, timeless marble.',
    prompt: 'classic: shaker and framed fronts, soft timeless colours, brass knobs, marble and warm wood, elegant and balanced',
    furnitureLook: 'traditional shapes, turned legs, button-tufted upholstery',
    palettes: [
      {
        id: 'navy-shaker',
        label: 'Navy shaker',
        colours: ['#24324A', '#F3F2EE', '#C2A15E', '#A8743F'],
        parts: {
          shutters: { material: 'pu', shade: 'navy', finish: 'satin', profile: 'shaker' },
          accent: { material: 'pu', shade: 'frosty-white', finish: 'satin', profile: 'shaker' },
          handles: { material: 'knob', shade: 'brushed-gold' },
          countertop: { material: 'marble', shade: 'carrara', finish: 'polished' },
          backsplash: { material: 'subway', shade: 'frosty-white', finish: 'gloss' },
          wallTiles: { material: 'large', shade: 'statuario', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'ivory', finish: 'eggshell' },
          featureWall: { material: 'panelling', shade: 'frosty-white' },
          floor: { material: 'wood', shade: 'natural-teak', finish: 'herringbone' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'velvet', shade: 'navy' },
        },
      },
      {
        id: 'cream-brass',
        label: 'Cream & brass',
        colours: ['#EDE6D6', '#8C6A3A', '#F1EFEC', '#D9CDBD'],
        parts: {
          shutters: { material: 'pu', shade: 'ivory', finish: 'satin', profile: 'shaker' },
          handles: { material: 'knob', shade: 'antique-brass' },
          countertop: { material: 'marble', shade: 'statuario', finish: 'polished' },
          backsplash: { material: 'slab', shade: 'calacatta', finish: 'polished' },
          wallTiles: { material: 'large', shade: 'calacatta', finish: 'gloss' },
          walls: { material: 'emulsion', shade: 'cashmere', finish: 'eggshell' },
          featureWall: { material: 'panelling', shade: 'ivory' },
          floor: { material: 'marble', shade: 'botticino' },
          ceiling: { material: 'cove' },
          upholstery: { material: 'fabric', shade: 'oatmeal' },
        },
      },
    ],
  },
];

export const findStyle = (id: string | undefined) => DESIGN_STYLES.find((s) => s.id === id);

export const findPalette = (style: DesignStyle, id: string | undefined) => style.palettes.find((p) => p.id === id) ?? style.palettes[0];

/** The family a part belongs to, for grouping in the UI. */
export const partFamily = (elementId: string): StylePart | undefined => FAMILY[elementId];

/**
 * The per-part spec a combination gives this room type: element id → selection.
 * Only parts in `only` are filled when it is given (Standard: the parts staff ticked).
 * Wall cabinets use the accent colour, or the main shutter colour when there is none.
 */
export function styleSelections(palette: StylePalette, room: RoomTypeId, only?: ReadonlySet<string>): Record<string, Selection> {
  const out: Record<string, Selection> = {};
  for (const e of ELEMENTS) {
    if (!appliesTo(e, room) || (only && !only.has(e.id))) continue;
    const family = FAMILY[e.id];
    if (!family) continue;
    const sel = palette.parts[family] ?? (family === 'accent' ? palette.parts.shutters : undefined);
    if (!sel || !e.materials.some((m) => m.id === sel.material)) continue;
    const { profile, ...rest } = sel;
    out[e.id] = e.profiles?.some((p) => p.id === profile) ? { ...rest, profile } : rest;
  }
  return out;
}

// ---------------------------------------------------------------- furniture recommendations

/** What a room usually needs. The style decides how each piece looks. */
export const FURNITURE: Record<RoomTypeId, string[]> = {
  kitchen: ['Modular base and wall cabinets along the existing walls', 'Countertop with an undermount sink', 'Built-in hob and chimney', 'Tall pantry / appliance unit', 'Breakfast counter with 2 bar stools', 'Pendant lights over the counter', 'Under-cabinet LED strip'],
  bedroom: ['Queen bed with an upholstered headboard', 'Two bedside tables', 'Floor-to-ceiling wardrobe', 'Dresser with a mirror', 'Accent chair', 'Area rug under the bed', 'Bedside pendant or wall lights', 'Sheer and blackout curtains'],
  living: ['Three-seater sofa', 'Two accent chairs', 'Coffee table', 'TV unit with a back panel', 'Area rug', 'Floor lamp', 'Side table', 'Curtains', 'Indoor plants'],
  dining: ['Six-seater dining table', 'Dining chairs', 'Pendant light over the table', 'Crockery unit', 'Wall art', 'Area rug'],
  kids: ['Single bed or bunk bed', 'Study table with a chair', 'Wardrobe', 'Open bookshelf', 'Toy storage', 'Play rug', 'Wall decals or art'],
  study: ['Work desk', 'Ergonomic chair', 'Bookshelf', 'Storage unit', 'Desk lamp', 'Pin board or wall shelf'],
  pooja: ['Pooja unit with jaali shutters', 'Back panel with a soft glow', 'Diya and bell shelf', 'Floor seating mat', 'Brass bells'],
  bathroom: ['Wall-hung vanity with a basin', 'Mirror cabinet with lights', 'Glass shower partition', 'Niche shelf', 'Towel rail'],
};

export interface FurnitureIdea {
  name: string;
  /** How it should look in this style and palette. */
  note: string;
}

/** Built-in recommendations (no AI needed): the room's usual pieces. The style's look is shown once, above the list. */
export function localFurniture(room: RoomTypeId): FurnitureIdea[] {
  return FURNITURE[room].map((name) => ({ name, note: '' }));
}

export const MAX_CONCEPTS = 4;
export const MAX_FURNITURE = 10;
export const FURNITURE_NAME_MAX = 80;
