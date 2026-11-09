import type { Board } from '../drawings/cabinet-boards';
import { hardware } from '../hardware/hardware-registry';
import type { FixingSpec } from '../hardware/hardware-types';
import type { Fitting, FittingKind, Hole } from './make-joints';
import { thinAxis } from './make-measures';

/**
 * The screws that hold hardware on. A hinge, a mounting plate, a handle, a rail support, a leg or a wall bracket is
 * bought as one thing, but it is held by screws that are often not in its box: two through each ear of a hinge cup,
 * two Euro screws in each plate, two machine screws behind each handle. Each hardware entry says which in its
 * `fixings` (hardware registry), so here they are counted and written down with nothing copied: every fitting of a
 * kind that names fixings gets its screws, in the step that fits it, and on the buy list.
 *
 * Connectors (their own fixings are themselves), runners and the cargo mechanism (whose screws Make sets out one by
 * one, with their holes) are left as they are.
 */

/** Hardware whose screws are set out with it already (make-hardware.ts, drawer-installation.ts), or that is a fastener. */
const OWN: ReadonlySet<FittingKind> = new Set(['confirmat', 'dowel', 'cam', 'bolt', 'screw', 'nail', 'pin', 'runner', 'drawerLock']);

/** The length of a screw from its size as sold ("3.5 × 16", "Euro 6.3 × 11.5", "M4 × 25"), millimetres. */
export const screwLength = (size: string): number | null => { const m = /×\s*(\d+(?:\.\d+)?)/.exec(size); return m ? Number(m[1]) : null; };
/** Machine screws for a handle through a front `thick` mm: the shortest stock length with at least 5 mm of thread in
 * the handle. */
const MACHINE_LENGTHS = [20, 22, 25, 30, 35, 40, 45, 50] as const;
export const throughScrew = (thick: number) => 'M4 × ' + (MACHINE_LENGTHS.find(l => l >= thick + 5) ?? Math.ceil((thick + 5) / 5) * 5);

/** Hardware a board's own thickness has no say in: what goes into the wall. */
const intoWall = (f: FixingSpec) => f.target === 'wall';

/** The fixings one fitting needs: which of its entry's apply to it, and how many. */
function fixingsOf(f: Fitting, boards: readonly Board[], holes: readonly Hole[], index: number): { size: string; qty: number; wall: boolean }[] {
  if (OWN.has(f.kind) || f.cargo || f.size?.includes('cargo')) return [];
  const entry = hardware(f.kind);
  if (!entry) return [];
  if (f.kind === 'hinge') {
    // A hinge clamped to glass has no cup and no screws in the door.
    return holes.some(h => h.of === index && h.kind === 'cup') ? entry.fixings.filter(x => !intoWall(x)).map(x => ({ size: x.size, qty: x.qtyPerUnit, wall: false })) : [];
  }
  if (f.kind === 'handle') {
    // One screw for every hole drilled for it: through the front (a machine screw as long as the front needs), or
    // from behind for a pull on the edge. A pull with no holes (a profile, a handle on glass) has no screws.
    const mine = holes.filter(h => h.of === index && h.kind === 'handle');
    if (!mine.length) return [];
    const through = mine[0]!.depth === 0, board = boards[mine[0]!.board]!;
    const back = entry.fixings.find(x => x.pilotHole && x.pilotHole.depthMm > 0);
    return [{ size: through ? throughScrew(Number((board.cut.thickness * 10).toPrecision(6))) : back?.size ?? '3.5 × 15', qty: mine.length, wall: false }];
  }
  return entry.fixings.map(x => ({ size: x.size, qty: x.qtyPerUnit, wall: intoWall(x) }));
}

/**
 * The screws for every fitting in `fittings` that needs them, as fittings to add after them: each names the fitting it
 * holds (`of`) and that fitting's board, and stands where it does.
 */
export function fixingScrews(boards: readonly Board[], fittings: readonly Fitting[], holes: readonly Hole[]): Fitting[] {
  const out: Fitting[] = [];
  fittings.forEach((f, index) => {
    for (const x of fixingsOf(f, boards, holes, index)) {
      // Into the board the hardware sits on: the door for a hinge, the upright for its plate.
      const host = f.boards.find(b => boards[b]) ?? null, axis = host === null ? f.axis : ({ x: 0, y: 1, z: 2 } as const)[thinAxis(boards[host]!)];
      for (let n = 0; n < x.qty; n++) out.push({ kind: 'screw', at: f.at, axis, boards: x.wall || host === null ? [] : [host], size: x.size, purpose: x.wall ? 'wall-fixing' : 'fixing', of: index });
    }
  });
  return out;
}

/**
 * How far a fixing screw goes into the board it holds its hardware on, against how thick that board is. A wood screw
 * must stay inside the board (the hardware's own flange, at least 1.5 mm, is under its head); a machine screw goes
 * right through and needs thread left over for the handle. Millimetres; null when it fits.
 */
export const FLANGE = 1.5, MIN_COVER = 1, MIN_THREAD = 5;
export function fixingMisfit(size: string, thick: number): { readonly kind: 'through' | 'short'; readonly by: number } | null {
  const length = screwLength(size);
  if (length === null) return null;
  if (size.startsWith('M')) return length - thick < MIN_THREAD ? { kind: 'short', by: Number((MIN_THREAD - (length - thick)).toPrecision(6)) } : null;
  const over = length - FLANGE - (thick - MIN_COVER);
  return over > 1e-9 ? { kind: 'through', by: Number(over.toPrecision(6)) } : null;
}
