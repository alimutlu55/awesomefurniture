import { piecePreset } from '../furniture/piece-presets';

export const STARTER_WARDROBE_WIDTH = { min: 140, max: 320, step: 5, initial: 240 } as const;
export const STARTER_WARDROBE_SHAPES = ['regular', 'alcove', 'under-stairs'] as const;

export type StarterDesign =
  | { kind: 'wardrobe'; width: number; shape: typeof STARTER_WARDROBE_SHAPES[number] }
  | { kind: 'kitchen' }
  /** A piece from PIECE_PRESETS: a chest of drawers, a sideboard, a TV unit, a shoe cabinet. */
  | { kind: 'piece'; preset: string };

export function starterDesignFromUrl(url: URL): StarterDesign | null {
  const { searchParams: params, hash } = url;
  if (/(?:^#|&)(?:design|spec)=/.test(hash) || params.has('session') || params.has('project') || params.has('view')) return null;
  if (params.get('starter') === 'kitchen') return { kind: 'kitchen' };
  const preset = params.get('preset');
  if (params.get('starter') === 'piece') return preset && piecePreset(preset) ? { kind: 'piece', preset } : null;
  if (params.get('starter') !== 'wardrobe') return null;
  const width = Number(params.get('width'));
  const { min, max, step } = STARTER_WARDROBE_WIDTH;
  const shape = STARTER_WARDROBE_SHAPES.find(id => id === params.get('shape'));
  return shape && width >= min && width <= max && (width - min) % step === 0 ? { kind: 'wardrobe', width, shape } : null;
}

export function starterDesignHref(lang: string, starter: StarterDesign) {
  const params = new URLSearchParams({ lang, starter: starter.kind });
  if (starter.kind === 'wardrobe') {
    params.set('width', String(starter.width));
    params.set('shape', starter.shape);
  }
  if (starter.kind === 'piece') params.set('preset', starter.preset);
  return '/editor/?' + params;
}
