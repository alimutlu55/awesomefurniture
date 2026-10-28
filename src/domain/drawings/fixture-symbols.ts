import { type Item, type P, line } from './drawing';
import { local } from './plan-symbols';
import type { PlacedPiece } from './room-pieces';

/** Recognisable overall appliance symbols within the true footprint. These describe the model, never a cut-out template. */
export function fixtureSymbols(p: PlacedPiece): Item[] {
  if (p.fixture !== 'sink' && p.fixture !== 'hob') return [];
  const w = p.design.w, d = p.design.d, at = (s: number, t: number) => local(p, s, t);
  const rectangle = (x0: number, z0: number, x1: number, z1: number): Item => ({ kind: 'line', stroke: 'thin', closed: true,
    points: [at(x0, z0), at(x1, z0), at(x1, z1), at(x0, z1)] });
  const ring = (x: number, z: number, radius: number): Item => ({ kind: 'line', stroke: 'thin', closed: true,
    points: Array.from({ length: 32 }, (_, i): P => at(x + radius * Math.cos(i * Math.PI / 16), z + radius * Math.sin(i * Math.PI / 16))) });
  if (p.fixture === 'hob') return [
    ...[-1, 1].flatMap(x => [-1, 1].map(z => ring(x * w * .24, z * d * .25, Math.min(w * .12, d * .18) * (x === z ? 1 : .8)))),
    rectangle(-w * .25, -d * .07, w * .25, d * .07),
  ];
  return [rectangle(-w * .43, -d * .30, w * .43, d * .40), ring(0, d * .25, Math.min(w, d) * .035),
    rectangle(-w * .025, -d * .45, w * .025, -d * .08), line(at(-w * .10, -d * .38), at(w * .10, -d * .38), 'thin')];
}
