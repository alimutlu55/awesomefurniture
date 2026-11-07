import type { EditorState } from '../projects/editor-scene';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { CommandEffects } from './command-effects';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { toMm } from '../../domain/geometry/millimetres';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { fitting } from '../../domain/wardrobe/fittings';
import { sectionWidths } from '../../domain/wardrobe/shape/wardrobe-shape';

/**
 * Splitting a bay as a carpenter does: a partition goes in under the middle, and the bay's layout stays on both sides.
 * A fitting across the whole bay (a shelf, a rail) becomes one in each half at the same height; a narrower one stays in
 * the half it stands in. The Sections control (layout-commands.ts) keeps every fitting whole on one side instead, so it
 * refuses a bay of full-width shelves; this is the split the engine's "Split the bay" fix makes.
 *
 * Detached first: the split is planned on a copy and checked with the editor's own geometry (every fitting inside its
 * bay, nothing overlapping, under the top) before it is committed as one undo step.
 */

/** Bays a wardrobe may have (as the Sections control allows). */
const MAX_BAYS = 6;
/** Within this, a fitting is as wide as its bay. Centimetres. */
const WHOLE = .05;

export type BaySplitPlan = { readonly ok: true; readonly state: EditorState } | { readonly ok: false; readonly reason: string };

const nameOf = (it: EditorItem) => fitting(it.k)?.name ?? it.k;

/** The bay `state.sel` split in two, or why it cannot be. Never changes `state`. */
export function planBaySplit(state: EditorState): BaySplitPlan {
  const i = state.sel, items = state.secs[i] ?? [];
  if (i < 0 || i >= state.n) return { ok: false, reason: 'Select a bay to split' };
  if (state.n >= MAX_BAYS) return { ok: false, reason: 'A piece has at most ' + MAX_BAYS + ' bays' };
  if (state.dividers.some(d => d.i === i)) return { ok: false, reason: 'Remove the dividers in this bay first, then split it' };
  const widths = sectionWidths(state), bw = widths[i]!, inner = toMm(bw - PANEL), left = Math.floor(inner / 2) / 10, right = (inner - Math.floor(inner / 2)) / 10;
  const halves: [EditorItem[], EditorItem[]] = [[], []], layout = WardrobePlanner.layoutSection(items, bw);
  for (let j = 0; j < items.length; j++) {
    const it = items[j]!, pos = layout[j]!, min = fitting(it.k)?.minWidth ?? 0, pinned = { ...structuredClone(it), y: pos.y0 };
    delete pinned.id;
    if (pos.w >= bw - WHOLE) {
      if (min > Math.min(left, right) + .01) return { ok: false, reason: nameOf(it) + ' needs ' + min + ' cm; each half would be ' + Math.min(left, right) + ' cm' };
      const { x: _x, w: _w, ax: _ax, ...whole } = pinned;
      halves[0].push({ ...whole }); halves[1].push({ ...whole });
      continue;
    }
    const side = pos.x0 + pos.w / 2 < left + PANEL / 2 ? 0 : 1, room = side ? right : left;
    if (pos.w > room + .01) return { ok: false, reason: nameOf(it) + ' is ' + Math.round(pos.w * 10) / 10 + ' cm wide; a half is ' + room + ' cm' };
    const x = side ? Math.max(0, pos.x0 - left - PANEL) : Math.min(pos.x0, left - pos.w);
    halves[side].push({ ...pinned, x: Math.min(x, room - pos.w), w: pos.w });
  }
  const nextWidths = [...widths.slice(0, i), left, right, ...widths.slice(i + 1)];
  const candidate: EditorState = { ...structuredClone(state), n: state.n + 1,
    wt: nextWidths.concat(Array(MAX_BAYS).fill(100)).slice(0, MAX_BAYS),
    secs: [...state.secs.slice(0, i), ...halves, ...state.secs.slice(i + 1)].map(s => structuredClone(s ?? [])).concat([[], [], [], [], [], []]).slice(0, MAX_BAYS),
    dividers: state.dividers.map(d => d.i > i ? { ...structuredClone(d), i: d.i + 1 } : structuredClone(d)),
    sel: i, item: -1, divider: -1, space: null, proposal: null };
  const geometry = createWardrobeGeometry(() => candidate);
  for (let k = 0; k < candidate.n; k++) if (!geometry.sectionLayoutValid(k)) return { ok: false, reason: 'The fittings would not fit the bays once split' };
  if (!candidate.dividers.every((d, k) => geometry.dividerValid(d, k))) return { ok: false, reason: 'The dividers would not fit the bays once split' };
  return { ok: true, state: candidate };
}

export function createBaySplitCommands({ getDesign, effects }: { getDesign: () => EditorState; effects: Required<Pick<CommandEffects, 'checkpoint' | 'changed' | 'report' | 'requestUndo'>> }) {
  /** Splits the selected bay, keeping its layout on both sides; reports why when it cannot. */
  function splitBay(): boolean {
    const plan = planBaySplit(getDesign());
    if ('reason' in plan) { effects.report(plan.reason); return false; }
    effects.checkpoint();
    Object.assign(getDesign(), plan.state);
    effects.changed();
    effects.report('Bay split in two · fittings kept on both sides', { label: 'Undo', fn: effects.requestUndo });
    return true;
  }
  return { splitBay };
}
