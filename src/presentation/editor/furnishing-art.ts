import type { FurnishingKey } from '../../domain/studio/furnishings/furnishing-kinds';

/** The Studio's drawing colours: plaster, floor boards, linen, wood, the line. */
const C = { wallTop: '#efe9df', wall: '#e2d9cb', wallSide: '#d3c8b7', floor: '#eadfcd', line: '#9c8d76', linen: '#f6f2ea', fabric: '#d9cdb8',
  fabricDark: '#c7b89f', wood: '#c9a273', woodDark: '#a8835a', woodTop: '#d8b88d', rug: '#c9b9a0', rugEdge: '#b3a184' };

/** An isometric drawing: `x` to the right along the wall, `z` out of the wall towards you, `y` up. Units are drawing units. */
const O = { x: 22, y: 75 }, K = { cx: .87 * 1.15, cy: .5 * 1.15, up: 1.15 };
const pt = (x: number, y: number, z: number) => `${(O.x + (x + z) * K.cx).toFixed(1)} ${(O.y + (z - x) * K.cy - y * K.up).toFixed(1)}`;
const poly = (fill: string, ...p: [number, number, number][]) => `<path d="M${p.map(q => pt(...q)).join('L')}Z" fill="${fill}" stroke="${C.line}" stroke-width=".5" stroke-linejoin="round"/>`;
/** A box from (x, y, z) of size w (along x), h (up), d (along z): the faces the eye sees, its top, its front (towards you)
 * and its left end. The eye looks from the front left, so boxes further right are drawn first. */
function box(x: number, y: number, z: number, w: number, h: number, d: number, top: string, front: string, side: string) {
  return poly(side, [x, y, z], [x, y, z + d], [x, y + h, z + d], [x, y + h, z])
    + poly(top, [x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d])
    + poly(front, [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]);
}
/** The back wall and the floor in front of it. */
const ROOM = poly(C.floor, [-6, 0, 0], [62, 0, 0], [62, 0, 46], [-6, 0, 46]) + poly(C.wall, [-6, 0, 0], [62, 0, 0], [62, 30, 0], [-6, 30, 0]);

const bed = (w: number) => box(0, 0, 0, w, 22, 3, C.fabricDark, C.fabric, C.fabricDark)
  + box(0, 0, 3, w, 7, 38, C.woodTop, C.wood, C.woodDark) + box(.8, 7, 3.5, w - 1.6, 4, 37, C.linen, C.linen, '#e4ddd0')
  + box(.4, 9, 15, w - .8, 3, 26, C.fabric, C.fabricDark, C.fabricDark)
  + (w > 20 ? box(w / 2 + 1, 11, 4.5, w / 2 - 3, 2.6, 7, '#fff', C.linen, '#e9e3d8') + box(2, 11, 4.5, w / 2 - 3, 2.6, 7, '#fff', C.linen, '#e9e3d8')
    : box(2, 11, 4.5, w - 4, 2.6, 7, '#fff', C.linen, '#e9e3d8'));
const bedside = (x: number) => box(x, 0, 0, 9, 11, 8, C.woodTop, C.wood, C.woodDark) + `<path d="M${pt(x + 1, 7, 8)}L${pt(x + 8, 7, 8)}" stroke="${C.woodDark}" stroke-width=".7"/>`;
const desk = () => [[38, 1], [5, 1], [38, 11], [5, 11]].map(([x, z]) => box(x!, 0, z!, 1.4, 15, 1.4, C.woodDark, C.woodDark, C.woodDark)).join('')
  + box(4, 15, 0, 36, 2, 13, C.woodTop, C.wood, C.woodDark)
  + box(16, 8, 9, 11, 2, 10, C.fabric, C.fabricDark, C.fabricDark) + box(16, 10, 17, 11, 12, 2, C.fabric, C.fabricDark, C.fabricDark);
const armchair = () => box(34, 0, 4, 4, 16, 22, C.fabric, C.fabricDark, C.fabricDark) + box(18, 9, 4, 16, 16, 5, C.fabric, C.fabricDark, C.fabricDark)
  + box(18, 0, 4, 16, 9, 22, C.linen, C.fabric, C.fabricDark) + box(14, 0, 4, 4, 16, 22, C.fabric, C.fabricDark, C.fabricDark);
const rug = (w: number, d: number, x = 26 - w / 2, z = 23 - d / 2) => poly(C.rugEdge, [x, .2, z], [x + w, .2, z], [x + w, .2, z + d], [x, .2, z + d])
  + poly(C.rug, [x + 2, .4, z + 2], [x + w - 2, .4, z + 2], [x + w - 2, .4, z + d - 2], [x + 2, .4, z + d - 2]);

/** Each kind's catalogue card, by its registry key: a new kind in furnishing-kinds.ts does not compile until it has one. */
const CARDS: { readonly [K in FurnishingKey]: string } = {
  bed: ROOM + bedside(36) + bed(30),
  bedside: ROOM + bedside(32) + bedside(12),
  desk: ROOM + desk(),
  armchair: ROOM + armchair(),
  rug: ROOM + rug(42, 30),
};

/** The card for the Add item catalogue. */
export function furnishingCardArt(kind: string): string {
  return `<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true">${(CARDS as Record<string, string>)[kind] ?? ''}</svg>`;
}

/** A type's picture for the Type panel: the bed seen in the room at its width, or the rug at its size. */
export function furnishingTypeArt(kind: string, size: { width: number; depth: number }, label: string): string {
  const scale = kind === 'bed' ? 20 / 140 : kind === 'rug' ? 20 / 160 : 0;
  const body = kind === 'bed' ? ROOM + bed(Math.max(14, size.width * scale)) : kind === 'rug' ? ROOM + rug(Math.min(52, size.width * scale * 1.4), Math.min(42, size.depth * scale * .9))
    : (CARDS as Record<string, string>)[kind] ?? '';
  return `<svg class="fixture-art" viewBox="0 0 146 110" role="img" aria-label="${label}">${body}</svg>`;
}
