import { SHELF_POSSESSIONS } from './possessions';
import { FITTINGS, MENU_KINDS, fitting } from './fittings';
import { PURPOSES } from './purposes';
/** Catalogue tables kept for existing callers. They are derived from the registries; edit
 * fittings.ts, purposes.ts or possessions.ts, never these. */
/** @type {Record<import('./fittings').FittingKind, {n:string,h:number,p:number,k:string,mn:number,mx:number,w:number,d:number,purpose:import('./purposes').Purpose}>} */
export const MODS = /** @type {any} */ (Object.fromEntries(FITTINGS.map(f => [f.key, { n: f.name, h: f.height, p: f.price, k: f.code, mn: f.min, mx: f.max, w: f.minWidth, d: f.minDepth, purpose: f.purpose }])));
/** @type {Record<import('./purposes').Purpose, string>} */
export const PURPOSE = /** @type {any} */ (Object.fromEntries(PURPOSES.map(p => [p.key, p.label])));
export const purposeName = it => PURPOSE[it.purpose] || it.purpose || PURPOSE[MODS[it.k].purpose];
export const compatiblePurposes = k => { const f = fitting(k); return f ? [...f.purposes, ...(f.holdsShelfPossessions ? SHELF_POSSESSIONS.map(p => p.key) : [])] : []; };
export const itemName = it => { const f = fitting(it.k); return it.front ? (f?.frontName ?? 'Front-facing short hang') : (f?.itemName ?? f?.name ?? it.k); };
export const FIN = { Oak: ['#b99a75', 1], White: ['#eeeeea', .9], Walnut: ['#6b4a33', 1.3], Graphite: ['#3a3d42', 1.1], Sage: ['#8fa68c', 1] };
export const r1 = x => Math.round(x * 10) / 10;
export const ADD_ORDER = MENU_KINDS;
export const PANEL = 1.8, PLINTH = 8;
