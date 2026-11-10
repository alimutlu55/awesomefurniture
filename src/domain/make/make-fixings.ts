import type { Board } from '../drawings/cabinet-boards';
import { hardware } from '../hardware/hardware-registry';
import type { FixingSpec } from '../hardware/hardware-types';
import type { Fitting, Hole } from './make-joints';
import { thinAxis } from './make-measures';

/**
 * The screws that hold hardware on. A hinge, a mounting plate, a handle, a rail support, a leg or a wall bracket is
 * bought as one thing, but it is held by screws that are often not in its box: two through each ear of a hinge cup,
 * two Euro screws in each plate, two machine screws behind each handle. Each hardware entry says which in its
 * `fixings` (hardware registry), so here they are counted and written down with nothing copied: every fitting of a
 * kind that names fixings gets its screws, in the step that fits it, and on the buy list.
 *
 * A connector or a fastener is its own fixing, a fixing that is not a screw (a shelf pin) is the hardware itself, and
 * a fixing with a purpose (a runner's, the cargo mechanism's) is set out by Make one by one with its holes
 * (make-hardware.ts, drawer-installation.ts): none of those is counted again here.
 */

/** Whether one of an entry's fixings is a screw this module counts. */
const counted = (x: FixingSpec) => x.fastenerKind === 'screw' && !x.purpose;

/** The length of a screw from its size as sold ("3.5 × 16", "Euro 6.3 × 11.5", "M4 × 25"), millimetres. */
export const screwLength = (size: string): number | null => { const m = /×\s*(\d+(?:\.\d+)?)/.exec(size); return m ? Number(m[1]) : null; };
/** Machine screws for a handle through a front `thick` mm: the shortest stock length with at least 5 mm of thread in
 * the handle. */
const MACHINE_LENGTHS = [20, 22, 25, 30, 35, 40, 45, 50] as const;
export const throughScrew = (thick: number) => 'M4 × ' + (MACHINE_LENGTHS.find(l => l >= thick + 5) ?? Math.ceil((thick + 5) / 5) * 5);

/** Hardware a board's own thickness has no say in: what goes into the wall. */
const intoWall = (f: FixingSpec) => f.target === 'wall';

/** The fixings one fitting needs: which of its entry's apply to it, and how many. */
type Need = { size: string; qty: number; wall: boolean; target?: FixingSpec['target'] };
function fixingsOf(f: Fitting, boards: readonly Board[], holes: readonly Hole[], index: number): Need[] {
  const entry = hardware(f.kind);
  if (!entry || entry.category === 'connector' || entry.category === 'fixing' && f.kind !== 'applianceKit' || f.cargo || f.size?.includes('cargo')) return [];
  if (f.kind === 'hinge') {
    // A hinge clamped to glass has no cup and no screws in the door.
    return holes.some(h => h.of === index && h.kind === 'cup') ? entry.fixings.filter(x => counted(x) && !intoWall(x)).map(x => ({ size: x.size, qty: x.qtyPerUnit, wall: false, target: x.target })) : [];
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
  return entry.fixings.filter(counted).map(x => ({ size: x.size, qty: x.qtyPerUnit, wall: intoWall(x), target: x.target }));
}

/** Whether a board is the kind a fixing says it goes into. */
function suits(b: Board, target: FixingSpec['target'] | undefined): boolean {
  const thin = thinAxis(b), front = b.stock === 'door' || b.stock === 'front';
  if (target === 'door' || target === 'front') return front;
  if (target === 'side' || target === 'partition') return !front && thin === 'x';
  if (target === 'base' || target === 'top' || target === 'shelf') return !front && thin === 'y';
  return true;
}

/**
 * The screws for every fitting in `fittings` that needs them, as fittings to add after them: each names the fitting it
 * holds (`of`) and that fitting's board, and stands where it does.
 */
export function fixingScrews(boards: readonly Board[], fittings: readonly Fitting[], holes: readonly Hole[]): Fitting[] {
  const out: Fitting[] = [];
  fittings.forEach((f, index) => {
    for (const x of fixingsOf(f, boards, holes, index)) {
      // Into the board of the hardware's that the fixing names: the door for a hinge, an upright for a lift's arms.
      const host = f.boards.find(b => boards[b] && suits(boards[b]!, x.target)) ?? f.boards.find(b => boards[b]) ?? null, axis = host === null ? f.axis : ({ x: 0, y: 1, z: 2 } as const)[thinAxis(boards[host]!)];
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
