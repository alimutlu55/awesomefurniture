/**
 * Where a fixture is in the room. Its back stands against its wall, or against the deepest shape standing in
 * front of the wall where it is (a boxing, a pillar, the low end of a staircase), so it is never stored: a deeper
 * boxing brings the toilet forward with it. Plain data in scene centimetres.
 */
import { wall, wallFace, wallLine } from '../studio';
import type { Studio, StudioCeiling, StudioFixture } from '../studio';
import { profileAt } from '../studio-ceiling';
import { ceilingLowerProfile } from '../surface-boundary';
import type { Obstacle } from '../studio-obstacles';
import { fixtureType } from './fixture-kinds';

type Outline = readonly { readonly t: number; readonly y: number }[];

/** Where its solid starts and stops above the floor. */
export function fixtureExtent(f: StudioFixture) {
  return fixtureType(f.kind, f.type)?.extent(f) ?? { bottom: 0, top: f.height };
}
/** The height at which its back meets what is behind it: the middle of its solid. */
const contact = (f: StudioFixture) => { const e = fixtureExtent(f); return (e.bottom + e.top) / 2; };

function inside(outline: Outline, t: number, y: number) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a.y > y) !== (b.y > y) && t < (b.t - a.t) * (y - a.y) / (b.y - a.y) + a.t) hit = !hit;
  }
  return hit;
}
/** The furthest a closed outline reaches along `t` at height `y`, or null where it does not reach that high. */
function reachAt(outline: Outline, y: number): number | null {
  let out: number | null = null;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a.y > y) === (b.y > y)) continue;
    const t = a.t + (b.t - a.t) * (y - a.y) / (b.y - a.y);
    out = out === null ? t : Math.max(out, t);
  }
  return out;
}

/** How far a shape along a wall stands out from the wall's face at `s` along it and `y` above the floor, seen
 * from the front and from the side; null where it is not there. */
export function shapeDepthAt(c: StudioCeiling, s: number, y: number): number | null {
  if (c.run !== 'along') return null;
  const front = c.outline ? inside(c.outline, s, y) : (profileAt(ceilingLowerProfile(c), s) ?? Infinity) <= y;
  if (!front) return null;
  return c.section ? reachAt(c.section, y) : c.depth;
}

/** The deepest shape in front of a wall over the stretch [from, to] along it, at height `y`: the shape and its
 * depth from the wall's face, or depth 0 and no shape where nothing stands there. */
export function behindAt(studio: Studio, wallId: string, from: number, to: number, y: number) {
  let best: { depth: number; shape?: StudioCeiling } = { depth: 0 };
  const samples = to - from > 4 ? [from + 1, (from + to) / 2, to - 1] : [(from + to) / 2];
  for (const c of studio.ceilings ?? []) {
    if (c.wall !== wallId) continue;
    for (const s of samples) {
      const d = shapeDepthAt(c, s, y);
      if (d !== null && d > best.depth + 1e-6) best = { depth: d, shape: c };
    }
  }
  return best;
}
/** The shape a fixture stands against, if any. */
export const boxingBehind = (studio: Studio, f: StudioFixture) =>
  behindAt(studio, f.wall, f.offset - f.width / 2, f.offset + f.width / 2, contact(f)).shape;

/** A fixture placed in the room: its wall, how far its back stands from the wall's face (`back`), and its solid. */
export function fixturePlace(studio: Studio, f: StudioFixture) {
  const w = wall(studio, f.wall), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
  if (!w || !line || !face) return null;
  const extent = fixtureExtent(f);
  const back = behindAt(studio, f.wall, f.offset - f.width / 2, f.offset + f.width / 2, (extent.bottom + extent.top) / 2).depth;
  /** The floor point `s` along the wall and `d` out from its room face. */
  const at = (s: number, d: number) => ({ x: line.a.x + line.ux * s + line.nx * (w.thickness / 2 + d), z: line.a.z + line.uz * s + line.nz * (w.thickness / 2 + d) });
  const centre = at(f.offset, back + f.depth / 2);
  const solid: Obstacle = { id: 'fixture:' + f.id, x: centre.x, y: extent.bottom, z: centre.z, angle: line.angle,
    state: { w: f.width, d: f.depth, h: extent.top - extent.bottom } };
  return { wall: w, line, face, back, extent, at, solid };
}

/** Every fixture's solid, which wardrobes and other furniture stop at. */
export function fixtureObstacles(studio: Studio | undefined): Obstacle[] {
  return (studio?.fixtures ?? []).flatMap(f => { const p = fixturePlace(studio!, f); return p ? [p.solid] : []; });
}
