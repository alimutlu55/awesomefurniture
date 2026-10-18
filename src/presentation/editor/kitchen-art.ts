import { KITCHEN_PRESETS } from '../../domain/kitchen/kitchen-design';
import { kitchenUnit, WORKTOP } from '../../domain/kitchen/kitchen-units';
import { fitting } from '../../domain/wardrobe/fittings';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';

type Preset = { readonly unit: typeof KITCHEN_PRESETS[number]['unit']; readonly parts: readonly (readonly [string, number])[]; readonly size?: { readonly w?: number; readonly h?: number } };
const W = 146, H = 110, FLOOR = 104;

/** Front view of a kitchen preset, drawn from its unit and parts and scaled to fill the card: what the Cabinets add
 * panel shows. A wall unit hangs in the middle of the card; floor units stand at its foot. */
export function kitchenPresetArt(preset: Preset, className = 'product-art kitchen-art'): string {
  const def = kitchenUnit(preset.unit), own = { w: preset.size?.w ?? def.w, h: preset.size?.h ?? def.h };
  // A sink or hob placed on its own: a slice of worktop with the fixture on it, no cabinet.
  if (def.fixture) {
    const fw = 100, fx = (W - fw) / 2, ty = 70, slab = `<rect x="${fx - 10}" y="${ty}" width="${fw + 20}" height="9" fill="#d9d4cb" stroke="#8d7d65" stroke-width=".8"/>`;
    const sink = `<rect x="${fx + 8}" y="${ty - 2}" width="${fw - 16}" height="2.4" fill="#c4c8cc" stroke="#8d7d65" stroke-width=".7"/><rect x="${fx + 14}" y="${ty - 1}" width="${fw - 28}" height="1.6" fill="#7d8389"/>`
      + `<path d="M${W / 2 - 3} ${ty - 2}v-26h9v5" fill="none" stroke="#8a8f96" stroke-width="2.4" stroke-linecap="round"/>`;
    const burners = [.3, .7].map(bx => `<circle cx="${fx + fw * bx}" cy="${ty - 1}" r="5" fill="none" stroke="#5d636a" stroke-width="1.2"/>`).join('');
    const hobArt = `<rect x="${fx + 6}" y="${ty - 3}" width="${fw - 12}" height="3" fill="#1b1e22"/>${burners}`;
    return `<svg class="${className}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${slab}${def.fixture === 'sink' ? sink : hobArt}</svg>`;
  }
  const unit = { ...def, ...own }, tall = unit.h + (unit.worktop ? WORKTOP.thickness : 0);
  const S = Math.min(96 / tall, 110 / unit.w), w = unit.w * S, x = (W - w) / 2;
  const top = unit.elevation ? (H - unit.h * S) / 2 : FLOOR - unit.h * S, bottom = top + unit.h * S;
  const base = unit.elevation > 0 ? 0 : PLINTH, inside = unit.h - base - 2 * PANEL, total = preset.parts.reduce((s, [, share]) => s + share, 0);
  const out: string[] = [];
  // The carcass, the plinth (or a wall unit's light rail) and the worktop.
  out.push(`<rect x="${x}" y="${top}" width="${w}" height="${unit.h * S}" rx="1" fill="#efe9df" stroke="#8d7d65" stroke-width="1"/>`);
  if (unit.worktop) out.push(`<rect x="${x - 2}" y="${top - WORKTOP.thickness * S}" width="${w + 4}" height="${WORKTOP.thickness * S}" fill="#d9d4cb" stroke="#8d7d65" stroke-width=".8"/>`);
  // The plinth under a floor unit; a wall unit's bottom is its lower edge.
  const railY = bottom - base * S;
  if (base) out.push(`<rect x="${x + (unit.plinth ? 3 : 0)}" y="${railY}" width="${w - (unit.plinth ? 6 : 0)}" height="${base * S}" fill="#cbbfac"/>`);
  // An empty unit shows its open inside; a filled one its fronts from the floor up, in proportion to their parts.
  if (!preset.parts.length) out.push(`<rect x="${x + 2}" y="${top + 2}" width="${w - 4}" height="${railY - top - 3}" fill="#ddd2c2"/>`);
  let y = railY;
  for (const [kind, share] of preset.parts) {
    const h = inside * share / total * S, def = fitting(kind);
    y -= h;
    // An oven shows its own glass; every other front matches the unit.
    const appliance = kind === 'oven' || kind === 'microwave' || kind === 'hood';
    out.push(`<rect x="${x + 1.5}" y="${y + .6}" width="${w - 3}" height="${h - 1.2}" rx=".8" fill="${appliance ? '#3a3e44' : '#fbf8f3'}" stroke="#8d7d65" stroke-width=".7"/>`);
    // A pull: across drawers and flaps, up a door.
    const drawer = def?.traits.includes('pullout') || kind === 'hob' || kind === 'flap';
    out.push(drawer ? `<path d="M${x + w / 2 - 7} ${y + Math.min(5, h / 2)}h14" stroke="#8a8f96" stroke-width="1.4" stroke-linecap="round"/>`
      : `<path d="M${x + w - 6} ${y + h / 2 - 4}v8" stroke="#8a8f96" stroke-width="1.4" stroke-linecap="round"/>`);
    if (w > 30 && (kind === 'cupboard' || kind === 'sink') && unit.w > 62) out.push(`<path d="M${x + w / 2} ${y + 1}v${h - 2}" stroke="#8d7d65" stroke-width=".7"/>`);
  }
  // What sits in the worktop: a tap over a sink, a hob's glass.
  const worktopTop = top - WORKTOP.thickness * S;
  if (preset.parts.some(part => part[0] === 'sink')) out.push(`<path d="M${W / 2 - 2} ${worktopTop}v-${Math.min(worktopTop - 2, 12)}h8v4" fill="none" stroke="#8a8f96" stroke-width="1.6" stroke-linecap="round"/>`);
  if (preset.parts.some(part => part[0] === 'hob')) out.push(`<rect x="${x + 3}" y="${worktopTop - 1.2}" width="${w - 6}" height="1.4" fill="#1b1e22"/>`);
  return `<svg class="${className}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out.join('')}</svg>`;
}

/** A kitchen fitting's front for its Add item card: the fitting alone, at its default height in a base unit's
 * width, scaled to the card. Drawn from the fittings registry; the oven shows its glass and a sink or hob what
 * sits in the worktop above it. */
export function kitchenFittingArt(kind: string): string {
  const def = fitting(kind);
  if (!def) return '';
  const S = Math.min(80 / def.height, 1.6), w = 60 * S, h = Math.max(14, def.height * S), x = (W - w) / 2, y = Math.max(16, (H - h) / 2 + 6);
  const out: string[] = [];
  const front = (fy: number, fh: number, fill = '#fbf8f3') => out.push(`<rect x="${x}" y="${fy}" width="${w}" height="${fh}" rx="1.5" fill="${fill}" stroke="#8d7d65" stroke-width="1"/>`);
  const bar = (x0: number, y0: number, dx: number, dy: number) => out.push(`<path d="M${x0} ${y0}l${dx} ${dy}" stroke="#8a8f96" stroke-width="2" stroke-linecap="round"/>`);
  if (kind === 'niche') {
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e3d9ca" stroke="#8d7d65" stroke-width="1"/>`);
    for (let n = 0; n < 3; n++) out.push(`<rect x="${x + 6 + n * (w - 12) / 3}" y="${y + h - 16}" width="${(w - 12) / 3 - 4}" height="14" rx="3" fill="${['#e9e4da', '#c9b79c', '#9fb2a6'][n]}"/>`);
  } else if (kind === 'oven') {
    front(y, h, '#b9bdc2');
    out.push(`<rect x="${x + 4}" y="${y + h * .25}" width="${w - 8}" height="${h * .65}" rx="1" fill="#1b1e22"/><rect x="${x + 4}" y="${y + 3}" width="${w - 8}" height="${h * .14}" fill="#2a2e33"/>`);
    bar(x + 10, y + h * .2, w - 20, 0);
  } else if (kind === 'hood') {
    front(y, h, '#b9bdc2');
    out.push(`<rect x="${x + 6}" y="${y + h * .55}" width="${w - 12}" height="${h * .25}" fill="#2a2e33"/>`);
  } else if (kind === 'dishwasher') {
    front(y, h);
    bar(x + 12, y + 7, w - 24, 0);
    out.push(`<rect x="${x + w - 18}" y="${y + 11}" width="12" height="3" rx="1" fill="#cbbfac"/>`);
  } else if (kind === 'microwave') {
    front(y, h, '#b9bdc2');
    out.push(`<rect x="${x + 4}" y="${y + 4}" width="${w * .62}" height="${h - 8}" rx="1" fill="#1b1e22"/><rect x="${x + w * .62 + 8}" y="${y + 6}" width="${w * .38 - 14}" height="${h - 12}" rx="1" fill="#2a2e33"/>`);
    bar(x + w * .62 + 5, y + 8, 0, h - 16);
  } else if (kind === 'fridge') {
    const split = y + h * .62;
    front(y, split - y); front(split, y + h - split);
    bar(x + w - 6, split - 18, 0, 12); bar(x + w - 6, split + 6, 0, 12);
  } else if (def.traits.includes('pullout') || kind === 'hob' || kind === 'flap') {
    front(y, h);
    bar(x + w / 2 - 12, kind === 'flap' ? y + h - 6 : y + Math.min(8, h / 2), 24, 0);
  } else {
    // Doors: two leaves across a wide unit.
    front(y, h);
    bar(x + w - 7, y + 8, 0, Math.min(18, h / 3));
  }
  // What sits in the worktop above it.
  if (kind === 'sink') out.push(`<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="4" fill="#d9d4cb"/><path d="M${W / 2} ${y - 5}v-12h10v5" fill="none" stroke="#8a8f96" stroke-width="2.2" stroke-linecap="round"/>`);
  if (kind === 'hob') out.push(`<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="4" fill="#d9d4cb"/><rect x="${x + 4}" y="${y - 7}" width="${w - 8}" height="2.5" fill="#1b1e22"/>`);
  return `<svg class="product-art kitchen-art" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out.join('')}</svg>`;
}
