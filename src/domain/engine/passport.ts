import { hardware } from '../hardware/hardware-registry';
import type { HardwareCategory } from '../hardware/hardware-types';
import { type CutLayout, STOCK, cutLayout } from '../make/make-cut-layout';
import type { MakePart } from '../make/make-parts';
import type { BuildModel } from './build-model';
import type { LoadCheck } from './physics/structure';

/**
 * The design passport: the numbers a workshop quotes a piece by, read from the build model. Everything here is
 * counted from the parts Make builds (boards, holes, hardware) or worked out from them (sheets, weight, time), so the
 * passport, the cutting list and the drawings always agree.
 */

/** Minutes to fit one of each kind of hardware, for one person who has done it before (estimates; drilling not included). */
export const FIT_MINUTES: Readonly<Record<HardwareCategory, number>> = {
  connector: 1.5, fixing: .3, support: .5, hinge: 4, runner: 10, handle: 3, rail: 5, leg: 1, bracket: 3, lift: 20, mechanism: 25,
  plinth: 1, track: 30, lighting: 15,
};
/** Minutes to handle, place and square up one board. */
export const BOARD_MINUTES = 2;

export interface HardwareLine { readonly key: string; readonly name: string; readonly size: string | undefined; readonly qty: number; readonly unit: string }

export interface Passport {
  readonly pieces: number;
  /** Different parts (identical boards counted once) and all boards. */
  readonly parts: number;
  readonly boards: number;
  readonly sheets: number;
  /** Share of the stock sheets that ends up in parts, 0 to 1. */
  readonly yield: number;
  readonly edgeBandingM: number;
  readonly holes: number;
  readonly hardware: readonly HardwareLine[];
  readonly hardwareCount: number;
  /** Empty weight of the boards, and what is planned to be kept inside, kilograms. */
  readonly kg: number;
  readonly contentsKg: number;
  readonly assemblyMinutes: number;
  /** The part working hardest, if anything carries a load. */
  readonly hardest: LoadCheck | null;
  readonly layout: CutLayout;
}

/** Every part of every piece, numbered once across the scene, for one cut layout. */
export function allParts(model: BuildModel): MakePart[] {
  let n = 0;
  return model.pieces.flatMap(p => p.make.parts.map(part => ({ ...part, n: ++n })));
}

/** One line per hardware item and size across the scene. */
export function hardwareLines(model: BuildModel): HardwareLine[] {
  const lines = new Map<string, HardwareLine>();
  for (const p of model.pieces) for (const b of p.make.buy) {
    const entry = hardware(b.kind), key = b.kind + '|' + (b.size ?? ''), line = lines.get(key);
    lines.set(key, { key: b.kind, name: entry?.name ?? b.kind, size: b.size, unit: entry?.unit ?? 'pc', qty: (line?.qty ?? 0) + b.qty });
  }
  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.size ?? '').localeCompare(b.size ?? ''));
}

/** Minutes to put the pieces together: every board placed, every hardware item fitted. */
export function assemblyMinutes(model: BuildModel): number {
  let minutes = 0;
  for (const p of model.pieces) {
    minutes += p.make.boards.length * BOARD_MINUTES;
    for (const f of p.make.fittings) minutes += FIT_MINUTES[hardware(f.kind)?.category ?? 'fixing'];
  }
  return Math.round(minutes);
}

export function passport(model: BuildModel): Passport {
  const parts = allParts(model), layout = cutLayout(parts), lines = hardwareLines(model);
  const partArea = parts.reduce((s, p) => s + p.boards.length * p.cut.length * p.cut.width * 100, 0);
  const sheetArea = layout.sheets.length * STOCK.length * STOCK.width;
  const loads = model.pieces.flatMap(p => p.loads);
  return {
    pieces: model.pieces.length, parts: parts.length, boards: parts.reduce((s, p) => s + p.boards.length, 0),
    sheets: layout.sheets.length, yield: sheetArea ? partArea / sheetArea : 0,
    edgeBandingM: Math.round(layout.band.reduce((s, b) => s + b.metres, 0) * 10) / 10,
    holes: model.pieces.reduce((s, p) => s + p.make.holes.length, 0),
    hardware: lines, hardwareCount: lines.reduce((s, l) => s + l.qty, 0),
    kg: model.pieces.reduce((s, p) => s + p.kg, 0),
    contentsKg: model.pieces.reduce((s, p) => s + p.contents.reduce((t, c) => t + c.kg, 0), 0),
    assemblyMinutes: assemblyMinutes(model),
    hardest: loads.reduce<LoadCheck | null>((a, l) => !a || l.utilisation > a.utilisation ? l : a, null),
    layout,
  };
}
