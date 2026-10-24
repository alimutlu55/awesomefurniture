import type { Boxing, FixtureKey } from '../../domain/studio/fixtures/fixture-kinds';

/** The Studio's drawing colours: the wall's plaster faces, a boxing's lighter board, white ceramic, the frame. */
const C = { wall: '#d3c8b7', wallTop: '#efe9df', wallSide: '#e2d9cb', box: '#ebe4d8', line: '#9c8d76', ceramic: '#fff', frame: '#8d7d65', metal: '#8d7d65', wood: '#c9a273' };
const svg = (body: string, label: string, viewBox = '0 0 120 86') =>
  `<svg class="fixture-art" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>`;
const FLOOR = `<path d="M4 80H116" stroke="${C.line}" stroke-width="1.4"/>`;

/** Boxing tops in the section drawings: 2.5 drawing units a centimetre would be too small, so heights are to scale
 * against a 250 cm room and depths are drawn generously. */
const TOP: Record<Boxing, number> = { none: 80, low: 55, half: 45, full: 6 };
const wall = (thick = false) => `<rect x="6" y="6" width="${thick ? 16 : 10}" height="74" fill="${C.wall}"/>`;
const boxing = (top: number) => `<rect x="16" y="${top}" width="12" height="${80 - top}" fill="${C.box}" stroke="${C.line}" stroke-width=".8"/>`;
const frame = (x: number) => `<rect x="${x}" y="47" width="8" height="32" fill="none" stroke="${C.frame}" stroke-width=".8" stroke-dasharray="2 1.6"/>`;
const plate = (x: number, y: number, flat = false) => flat
  ? `<rect x="${x - 4}" y="${y - 1.6}" width="8" height="1.6" fill="${C.metal}"/>` : `<rect x="${x}" y="${y}" width="2.2" height="8" rx=".4" fill="${C.metal}"/>`;
const seat = (x: number) => `<path d="M${x} 61.2h36.5" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>`;
const floorBowl = (x: number) => `<path d="M${x} 62h34q5 0 4 4q-2 6-12 8l-3 6h-19z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9" stroke-linejoin="round"/>` + seat(x);
const hungBowl = (x: number) => `<path d="M${x} 62h34q5 0 4 4q-2 8-16 10h-22z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9" stroke-linejoin="round"/>` + seat(x);

/** How a toilet is fitted, drawn in section: the wall on the left, any boxing in front of it, the bowl and its flush plate. */
export function setupArt(type: string, box: Boxing, label: string): string {
  if (type === 'close-coupled') {
    const cistern = `<rect x="17" y="38" width="11" height="23" rx="2" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9"/><path d="M20 38h5" stroke="${C.metal}" stroke-width="1.6"/>`;
    return svg(wall() + FLOOR + cistern + floorBowl(18), label);
  }
  if (box === 'none') return svg(wall(true) + frame(12) + FLOOR + hungBowl(22) + plate(22, 46), label);
  const face = 28, top = TOP[box];
  const bowl = type === 'back-to-wall' ? floorBowl(face) : hungBowl(face);
  return svg(wall() + FLOOR + boxing(top) + frame(18) + bowl + (box === 'low' ? plate(22, top, true) : plate(face, 46)), label);
}

const trap = `<path d="M36 66v7q0 3 3 3h0q3 0 3-3v-3M39 76v-1" fill="none" stroke="${C.metal}" stroke-width="1.6"/><path d="M42 71h-26" stroke="${C.metal}" stroke-width="1.6"/>`;
const deckTap = (x: number, y: number) => `<path d="M${x} ${y}v-9q0-3 3-3h8v2.5" fill="none" stroke="${C.metal}" stroke-width="2" stroke-linecap="round"/>`;
const wallTap = `<path d="M16 39h18v2.5" fill="none" stroke="${C.metal}" stroke-width="2" stroke-linecap="round"/><rect x="16" y="35" width="2" height="9" fill="${C.metal}"/>`;
const basinBowl = (y: number) => `<path d="M16 ${y}h42q3 0 2 3q-3 9-16 10h-28z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9" stroke-linejoin="round"/>`;

/** A basin's type in section against its wall: on the wall with its trap, on a pedestal, in a vanity unit, or a bowl on a worktop. */
export function basinArt(type: string, tap: 'deck' | 'wall', label: string): string {
  const t = (y: number) => tap === 'wall' ? wallTap : deckTap(24, y);
  if (type === 'pedestal') return svg(wall() + FLOOR + `<path d="M26 62h12l-2 18h-8z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9"/>` + basinBowl(52) + t(52), label);
  if (type === 'vanity') {
    return svg(wall() + FLOOR + `<rect x="16" y="56" width="42" height="18" rx="1" fill="${C.wood}"/><path d="M57 60v10" stroke="${C.metal}" stroke-width="1.4"/>`
      + `<path d="M16 50h44q2 0 2 2v4h-46z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9"/>` + t(50), label);
  }
  if (type === 'countertop') {
    return svg(wall() + FLOOR + `<rect x="16" y="56" width="44" height="3" fill="${C.wood}"/><rect x="16" y="59" width="42" height="15" rx="1" fill="${C.wood}" opacity=".85"/>`
      + `<path d="M28 56q-1-9 2-9h20q3 0 2 9z" fill="${C.ceramic}" stroke="${C.line}" stroke-width=".9"/>` + (tap === 'wall' ? wallTap : deckTap(25, 56).replace('v-9', 'v-15')), label);
  }
  return svg(wall() + FLOOR + basinBowl(52) + trap + t(52), label);
}

/** Catalogue cards, in the Add item style of the room's parts: a wall seen from the front corner, with the fixture against it. */
const WALL = '<path d="M14 26 104 14 132 30 42 44Z" fill="#efe9df"/><path d="M42 44v56l90-14V30Z" fill="#e2d9cb"/><path d="M14 26v56l28 18V44Z" fill="#d3c8b7"/>';
/** Each kind's card, by its registry key: a new kind in fixture-kinds.ts does not compile until it has one. */
const CARDS: { readonly [K in FixtureKey]: string } = {
  toilet: `<path d="M64 41 108 35v39l-44 6Z" fill="${C.box}"/><path d="M64 41 108 35 112 37.5 68 43.5Z" fill="#f5f1ea"/><path d="M108 35v39l4 2.5V37.5Z" fill="#d9cfbf"/>`
    + `<path d="M80 52.5 92 50.8v7.6l-12 1.7Z" fill="${C.metal}"/><path d="M86 51.7v7.6" stroke="#b9ab95" stroke-width=".8"/>`
    + `<path d="M75 74q-1 12 13 16 13 3 18-6 2-5 0-9Z" fill="#fbfaf7" stroke="#b9ab95"/><ellipse cx="90" cy="74" rx="16" ry="6.5" transform="rotate(-8 90 74)" fill="#fff" stroke="#b9ab95"/>`,
  basin: `<path d="M66 70 114 63 122 68 74 75Z" fill="#fff" stroke="#b9ab95"/><path d="M74 75 122 68v5l-48 7Z" fill="#f1eee8" stroke="#b9ab95"/>`
    + `<ellipse cx="94" cy="69.5" rx="15" ry="3.6" transform="rotate(-8 94 69.5)" fill="#ece8e1"/><path d="M91 64v-6l7-1" fill="none" stroke="${C.metal}" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M75 80 121 73v9l-46 7Z" fill="${C.wood}"/><path d="M75 89v-9" stroke="#b08a5c"/>`,
};
export function fixtureCardArt(kind: string): string {
  return `<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true">${WALL}${(CARDS as Record<string, string>)[kind] ?? ''}</svg>`;
}
