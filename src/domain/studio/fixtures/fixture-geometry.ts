import type { Studio } from '../studio';
import { wallLine } from '../studio';
import type { FixtureAnchor, FixtureEnclosure, FixturePose, StudioFixture } from './fixture';
import type { Obstacle } from '../studio-obstacles';
import { fixtureDefinition } from './fixture-catalog';

export function localPose(p: FixturePose, x: number, y: number, z: number): FixturePose {
  const a = p.angle * Math.PI / 180;
  return { x: p.x + x * Math.cos(a) + z * Math.sin(a), y: p.y + y,
    z: p.z - x * Math.sin(a) + z * Math.cos(a), angle: p.angle };
}
/** The only attachment-to-world transform. Resolves support chains defensively. */
export function anchorPose(studio: Studio, anchor: FixtureAnchor, depth: number, seen = new Set<string>()): FixturePose | null {
  if (anchor.kind === 'floor') return anchor;
  if (anchor.kind === 'wall') {
    const wall = studio.walls.find(w => w.id === anchor.wall), line = wall && wallLine(studio, wall);
    if (!wall || !line) return null;
    const out = wall.thickness / 2 + anchor.gap + depth / 2;
    return { x: line.a.x + line.ux * anchor.offset + line.nx * out, y: anchor.y,
      z: line.a.z + line.uz * anchor.offset + line.nz * out, angle: line.angle };
  }
  const id = anchor.kind === 'enclosure' ? anchor.enclosure : anchor.fixture;
  if (seen.has(id)) return null;
  const visited = new Set(seen).add(id);
  if (anchor.kind === 'enclosure') {
    const e = studio.enclosures?.find(e => e.id === id), pose = e && anchorPose(studio, e.anchor, e.d, visited);
    return e && pose ? localPose(pose, anchor.offset, anchor.y, (e.d + depth) / 2) : null;
  }
  const f = studio.fixtures?.find(f => f.id === id), pose = f && anchorPose(studio, f.anchor, f.d, visited);
  return f && pose ? localPose(pose, anchor.x, f.h + anchor.lift, anchor.z) : null;
}
export const fixturePose = (s: Studio, f: StudioFixture) => anchorPose(s, f.anchor, f.d, new Set([f.id]));
export const enclosurePose = (s: Studio, e: FixtureEnclosure) => anchorPose(s, e.anchor, e.d);
/** A floor item's back can be flush with a wall without being attached to it. */
export function fixtureWall(s: Studio, f: StudioFixture): { wall: string; offset: number } | null {
  const p = fixturePose(s, f);
  if (!p) return null;
  const back = localPose(p, 0, 0, -f.d / 2);
  for (const wall of s.walls) {
    const line = wallLine(s, wall);
    if (!line || Math.cos((p.angle - line.angle) * Math.PI / 180) < .999) continue;
    const x = back.x - line.a.x, z = back.z - line.a.z, offset = x * line.ux + z * line.uz;
    if (Math.abs(x * line.nx + z * line.nz - wall.thickness / 2) < 2 && offset >= 0 && offset <= line.length) return { wall: wall.id, offset };
  }
  return null;
}
const box = (id: string, pose: FixturePose, w: number, h: number, d: number): Obstacle => ({ id, ...pose, state: { w, h, d } });

/** Physical volumes. Small fittings use compound shapes to avoid filling their usable empty space. */
export function fixtureSolids(studio: Studio | undefined): Obstacle[] {
  if (!studio) return [];
  const out = (studio.enclosures ?? []).flatMap(e => {
    const p = enclosurePose(studio, e);
    return p ? [box('enclosure:' + e.id, p, e.w, e.h, e.d)] : [];
  });
  for (const f of studio.fixtures ?? []) {
    const p = fixturePose(studio, f), def = fixtureDefinition(f.kind);
    if (!p || !def || (def.shape === 'tray' && f.variant === 'flush')) continue;
    const id = 'fixture:' + f.id;
    if (def.shape === 'faucet' && f.variant === 'deck') {
      out.push(box(id, localPose(p, 0, 0, -f.d / 2 + f.w / 2), f.w, f.h, f.w));
      out.push(box(id, localPose(p, 0, f.h * .85 - 1.3, 0), Math.min(f.w, 3), 2.6, f.d));
    } else if (def.shape === 'toilet' && f.variant === 'close-coupled') {
      const bowl = Math.min(40, f.h * .54);
      out.push(box(id, localPose(p, 0, 0, f.d * .12), f.w, bowl, f.d * .73));
      out.push(box(id, localPose(p, 0, bowl, -f.d * .38), f.w * .92, f.h - bowl, f.d * .24));
    } else if (def.shape === 'shower') {
      out.push(box(id, localPose(p, 0, 0, -f.d / 2 + 3), f.w, 10, 6));
      out.push(box(id, localPose(p, 0, 10, -f.d / 2 + 3), 4, f.h - 10, 4));
      out.push(box(id, localPose(p, 0, f.h - 3, 0), f.w, 3, f.d));
    } else out.push(box(id, p, f.w, f.h, f.d));
  }
  return out;
}

export function fixtureBounds(studio: Studio | undefined) {
  const solids = studio ? [...studio.enclosures ?? [], ...studio.fixtures ?? []].flatMap(f => {
    const p = 'kind' in f ? fixturePose(studio, f) : enclosurePose(studio, f);
    return p ? [box(f.id, p, f.w, f.h, f.d)] : [];
  }) : [];
  if (!solids.length) return null;
  const extents = solids.map(s => {
    const a = s.angle * Math.PI / 180, c = Math.abs(Math.cos(a)), n = Math.abs(Math.sin(a));
    return { ...s, dx: (s.state.w * c + s.state.d * n) / 2, dz: (s.state.w * n + s.state.d * c) / 2 };
  });
  return { x0: Math.min(...extents.map(s => s.x - s.dx)), x1: Math.max(...extents.map(s => s.x + s.dx)),
    z0: Math.min(...extents.map(s => s.z - s.dz)), z1: Math.max(...extents.map(s => s.z + s.dz)),
    height: Math.max(...extents.map(s => s.y + s.state.h)) };
}
