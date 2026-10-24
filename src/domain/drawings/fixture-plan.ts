/**
 * Fixtures and the construction behind them on the plan: each toilet or basin's footprint with its name and its centre
 * line (what the plumber sets the waste and supply out from), and each boxing or pillar standing on the floor, hatched
 * where the plan's cut passes through it, outlined where it is lower. Whole millimetres, as the rest of the plan.
 */
import type { Studio } from '../studio/studio';
import { wall, wallLine } from '../studio/studio';
import { fixtureKind } from '../studio/fixtures/fixture-kinds';
import { fixturePlace } from '../studio/fixtures/fixture-place';
import { standsOnFloor } from '../studio/fixtures/fixture-setup';
import { type Item, line, note } from './drawing';
import { plan } from './plan-symbols';

/** The height a plan is cut at: a boxing taller than this is cut through, as the walls are. Centimetres. */
const CUT = 100;

export function fixturePlan(studio: Studio | undefined): Item[] {
  if (!studio) return [];
  const out: Item[] = [];
  for (const c of studio.ceilings ?? []) {
    const w = wall(studio, c.wall), l = w && wallLine(studio, w);
    if (!w || !l || c.run !== 'along' || !standsOnFloor(c)) continue;
    const ts = c.outline!.map(p => p.t), from = Math.min(...ts), to = Math.max(...ts), face = w.thickness / 2;
    const at = (t: number, d: number) => plan(l.a.x + l.ux * t + l.nx * (face + d), l.a.z + l.uz * t + l.nz * (face + d));
    const cut = Math.max(...c.outline!.map(p => p.y)) >= CUT;
    out.push({ kind: 'line', stroke: cut ? 'cut' : 'outline', closed: true, fill: cut ? 'hatch' : undefined,
      points: [at(from, 0), at(to, 0), at(to, c.depth), at(from, c.depth)] });
  }
  for (const f of studio.fixtures ?? []) {
    const p = fixturePlace(studio, f);
    if (!p) continue;
    const at = (s: number, d: number) => { const q = p.at(f.offset + s, d); return plan(q.x, q.z); };
    const half = f.width / 2, back = p.back, front = back + f.depth;
    out.push({ kind: 'line', stroke: 'outline', closed: true, points: [at(-half, back), at(half, back), at(half, front), at(-half, front)] });
    out.push(line(at(0, 0), at(0, front + 8), 'centre'));
    const deg = Math.atan2(-p.line.uz, p.line.ux) * 180 / Math.PI, readable = deg > 90.01 ? deg - 180 : deg <= -90 ? deg + 180 : deg;
    out.push(note(at(0, (back + front) / 2), fixtureKind(f.kind)?.name ?? '', 'middle', readable));
  }
  return out;
}

/** Where along a wall the fixtures' centre lines are, for its setting-out dimensions. Centimetres from corner a. */
export const fixtureCentres = (studio: Studio, wallId: string) => (studio.fixtures ?? []).filter(f => f.wall === wallId).map(f => f.offset);
