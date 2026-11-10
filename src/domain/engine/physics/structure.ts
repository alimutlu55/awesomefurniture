import type { Board } from '../../drawings/cabinet-boards';
import { clearSpan } from '../../drawings/manufacturing-rules/shelf-span';
import { hardware } from '../../hardware/hardware-registry';
import type { HardwareEntry } from '../../hardware/hardware-types';
import { type MakePiece, decorOf } from '../../make/make-parts';
import { PANEL } from '../../wardrobe/catalog.js';
import type { Content } from './contents';
import { boardMass, substrateOf } from './substrate';

/**
 * Load checks: how hard each part that carries something is working, as a share of its limit (1 is the limit). They
 * read the board list and hardware of a piece as Make builds it and what is kept in it (contents.ts).
 *
 * - Shelf sag: a shelf as a beam resting on its two supports, under its own weight and an even load of what stands on it.
 *   Mid-span deflection 5·p·L⁴ / (32·E·t³) per unit of depth, times the substrate's creep for a load that stays for years,
 *   against a limit of span / 200. The span table in carcass.ts (decision D2) stays the blocking rule for how long a
 *   shelf may be; this check says whether what is put on it bends it.
 * - Rail span: a hanging rail or lift no wider than its hardware's `maxSpanMm` without a centre support.
 * - Lift and runner load: what is kept, plus the box, against the hardware's `ratedLoadKg`.
 * - Hinge load: a door's weight shared by its hinges, against each hinge's `loadKg`.
 */

export type LoadCheckKind = 'shelf-sag' | 'rail-span' | 'lift-load' | 'runner-load' | 'hinge-load';

export interface LoadCheck {
  readonly kind: LoadCheckKind;
  /** The board it is about (a shelf, a door), or the fitting (bay and item). */
  readonly board?: number | undefined;
  readonly bay?: number | undefined;
  readonly item?: number | undefined;
  /** measured / limit: 1 is at the limit. */
  readonly utilisation: number;
  readonly measured: number;
  readonly limit: number;
  readonly unit: 'mm' | 'kg';
  /** The weight involved, kilograms. */
  readonly kg: number;
}

const G = 9.81;
/** Allowed long-term sag of a shelf, as a share of its clear span. */
export const SAG_LIMIT = 1 / 200;
/** What a drawer's own box and front add to what is in it, kilograms. */
export const DRAWER_SELF_KG = 3;

/** A hardware's longest span without a centre support (mm), for boards of the carcass's thickness. */
function maxSpanMm(entry: HardwareEntry): number | undefined {
  const span = entry.rules.maxSpanMm;
  // One test a line, so the looser typecheck of the editor's JavaScript (which now reaches the engine through Make's
  // gate) narrows each case too.
  if (typeof span === 'number') return span;
  if (span === undefined) return undefined;
  return span[Math.round(PANEL * 10)] ?? Math.max(...Object.values(span));
}

/** How much a shelf bends, millimetres, under `kg` spread over it: long-term, at mid-span. */
export function shelfSag(b: Board, spanCm: number, kg: number, decorId: string): number {
  const s = substrateOf(decorId, b.cut.thickness), L = spanCm * 10, t = b.cut.thickness * 10, depth = (b.z1 - b.z0) * 10;
  if (L <= 0 || t <= 0 || depth <= 0) return 0;
  const pressure = kg * G / (L * depth) + s.densityKgM3 * G * t / 1e9;
  return 5 * pressure * L ** 4 / (32 * s.bendingModulusMpa * t ** 3) * s.creep;
}

/** A board's own weight, kilograms. */
export const weightOf = (b: Board, decorId: string) => boardMass(substrateOf(decorId, b.cut.thickness), b.cut.length * b.cut.width * b.cut.thickness);

function shelfChecks(make: MakePiece, contents: readonly Content[]): LoadCheck[] {
  const byBoard = new Map<number, number>();
  for (const c of contents) if (c.carried.kind === 'boards') for (const s of c.carried.shares) byBoard.set(s.board, (byBoard.get(s.board) ?? 0) + s.kg);
  const out: LoadCheck[] = [];
  for (const [board, kg] of byBoard) {
    const b = make.boards[board];
    if (!b || b.name !== 'Shelf' || kg <= 0) continue;
    const span = clearSpan(b, make.boards), sag = shelfSag(b, span, kg, decorOf(b, make.piece.design)), limit = span * 10 * SAG_LIMIT;
    out.push({ kind: 'shelf-sag', board, utilisation: sag / limit, measured: sag, limit, unit: 'mm', kg });
  }
  return out;
}

function fittingChecks(contents: readonly Content[]): LoadCheck[] {
  const out: LoadCheck[] = [];
  for (const c of contents) {
    const entry = c.carried.kind === 'boards' ? undefined : c.carried.hardware ? hardware(c.carried.hardware) : undefined;
    if (!entry) continue;
    const at = { bay: c.bay, item: c.item };
    if (c.carried.kind === 'rail') {
      const max = maxSpanMm(entry), span = c.carried.spanCm * 10;
      if (max) out.push({ kind: 'rail-span', ...at, utilisation: span / max, measured: span, limit: max, unit: 'mm', kg: c.kg });
      if (entry.rules.ratedLoadKg) out.push({ kind: 'lift-load', ...at, utilisation: c.kg / entry.rules.ratedLoadKg, measured: c.kg, limit: entry.rules.ratedLoadKg, unit: 'kg', kg: c.kg });
    } else if (entry.rules.ratedLoadKg) {
      const kg = c.kg + DRAWER_SELF_KG;
      out.push({ kind: 'runner-load', ...at, utilisation: kg / entry.rules.ratedLoadKg, measured: kg, limit: entry.rules.ratedLoadKg, unit: 'kg', kg });
    }
  }
  return out;
}

function hingeChecks(make: MakePiece): LoadCheck[] {
  const hinge = hardware('hinge'), out: LoadCheck[] = [];
  if (!hinge) return out;
  const variant = (size: string | undefined) => hinge.variants?.find(v => v.key === size) ?? hinge.variants?.find(v => v.key === hinge.defaultVariant);
  make.boards.forEach((b, board) => {
    if (b.stock !== 'door') return;
    const hinges = make.fittings.filter(f => f.kind === 'hinge' && f.boards.includes(board));
    const rating = hinges.reduce((s, f) => s + (variant(f.size)?.loadKg ?? 0), 0);
    if (!hinges.length || rating <= 0) return;
    const kg = weightOf(b, decorOf(b, make.piece.design));
    out.push({ kind: 'hinge-load', board, utilisation: kg / rating, measured: kg, limit: rating, unit: 'kg', kg });
  });
  return out;
}

/** Every load check of a piece. */
export function loadChecks(make: MakePiece, contents: readonly Content[]): LoadCheck[] {
  return [...shelfChecks(make, contents), ...fittingChecks(contents), ...hingeChecks(make)];
}
