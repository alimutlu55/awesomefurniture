import { roomHeight, wallExtent, wallFace, wallLine } from './studio';
import type { Studio } from './studio';
import { isWallUtility } from './wall-utilities';
import { controlPoint, divideSolid, locationPoint, moveSolidControl, ringAt, solidProblems, SOLID_EPS } from '../geometry/profile-solid';
import type { ProfileSolid, SolidLocation, SolidPoint } from '../geometry/profile-solid';
import { divideHorizontalSolid, moveHorizontalSolid } from '../geometry/horizontal-solid';
import { surfacePoint } from '../geometry/solid-surfaces';

export type SolidSelection = { kind: 'wall' | 'ceiling'; id: string };
export type WorldPoint = { x: number; y: number; z: number };
export interface StudioEdge { a: WorldPoint; b: WorldPoint; location: SolidLocation; key: string }
const same = (a: SolidPoint, b: SolidPoint) => Math.hypot(a.t - b.t, a.y - b.y) < SOLID_EPS;

/** The existing profile, closed at the ceiling, or the wall's actual outline including openings. */
export function studioSolid(studio: Studio, selection: SolidSelection) {
  const ceiling = selection.kind === 'ceiling' ? studio.ceilings?.find(c => c.id === selection.id) : undefined;
  const wall = studio.walls.find(w => w.id === (ceiling?.wall ?? selection.id));
  const line = wall && wallLine(studio, wall), face = wall && wallFace(studio, wall);
  if (!wall || !line || !face || selection.kind === 'ceiling' && !ceiling) return null;
  const across = ceiling?.run === 'across', top = ceiling ? roomHeight(studio) : wall.height;
  const extent = wallExtent(studio, wall, line.length), baselineU = across ? .5 : 1;
  const at = (p: SolidPoint, u: number): WorldPoint => {
    const physical = surfacePoint(p, u); p = physical; u = physical.u;
    const s = across ? face.end - u * face.length : p.t;
    const d = ceiling ? wall.thickness / 2 + (across ? p.t : u * ceiling.depth) : (u - .5) * wall.thickness;
    return { x: line.a.x + line.ux * s + line.nx * d, y: p.y, z: line.a.z + line.uz * s + line.nz * d };
  };
  const points: SolidPoint[] = [], loops: number[][] = [], profileIndices: number[] = [];
  const loop = (ps: readonly SolidPoint[], keepRoof = false) => {
    const indices: number[] = [];
    for (const p of ps) {
      const previous = indices.at(-1);
      if (previous !== undefined && same(points[previous]!, p) && !keepRoof) continue;
      indices.push(points.length); points.push({ ...p });
    }
    if (!keepRoof && indices.length > 1 && same(points[indices[0]!]!, points[indices.at(-1)!]!)) { indices.pop(); points.pop(); }
    loops.push(indices); return indices;
  };
  if (ceiling) {
    const ps = ceiling.profile;
    if (ps.length < 2) return null;
    const indices = loop([...ps, { t: ps.at(-1)!.t, y: top }, { t: ps[0]!.t, y: top }], true);
    for (const p of ps) profileIndices.push(indices.find(i => same(points[i]!, p))!);
  } else {
    const openings = studio.openings.filter(o => o.wall === wall.id && !isWallUtility(o.kind));
    const outer: SolidPoint[] = [{ t: extent.start, y: 0 }];
    for (const o of openings.filter(o => o.sill < 1).sort((a, b) => a.offset - b.offset)) {
      const a = o.offset - o.width / 2, b = o.offset + o.width / 2, y = Math.min(top - 1, o.height);
      outer.push({ t: a, y: 0 }, { t: a, y }, { t: b, y }, { t: b, y: 0 });
    }
    outer.push({ t: extent.end, y: 0 }, { t: extent.end, y: top }, { t: extent.start, y: top }); loop(outer);
    for (const o of openings.filter(o => o.sill >= 1)) {
      const a = o.offset - o.width / 2, b = o.offset + o.width / 2;
      loop([{ t: a, y: o.sill }, { t: a, y: o.sill + o.height }, { t: b, y: o.sill + o.height }, { t: b, y: o.sill }]);
    }
  }
  const shape: ProfileSolid = (ceiling ?? wall).shape ?? { loops,
    rings: (across ? [0, .5, 1] : [0, 1]).map(u => ({ u, points: points.map(p => ({ ...p })) })),
    controls: profileIndices.map((point, i) => ({ id: 'p' + i, point, u: baselineU, scope: 'profile' })),
  };
  const axis = across ? { x: line.nx, z: line.nz } : { x: line.ux, z: line.uz };
  const depth = ceiling ? across ? face.length : ceiling.depth : wall.thickness;
  const crossAxis = across ? { x: -line.ux, z: -line.uz } : { x: line.nx, z: line.nz };
  const bounds = shape.rings.flatMap(r => r.points.map(p => p.t + (p.s ?? 0)));
  return { shape, at, axis, crossAxis, depth, baselineU, ceiling, wall, line, face, extent, top,
    minT: Math.min(...bounds), maxT: Math.max(...bounds) };
}

/** Both faces, every vertical/angled/reentrant edge, and every edge through the extrusion. */
export function studioBoundaryEdges(studio: Studio, selection: SolidSelection): StudioEdge[] {
  const model = studioSolid(studio, selection);
  if (!model) return [];
  const { shape, at } = model, edges: StudioEdge[] = [];
  const planes = [...new Set([...shape.rings.map(r => r.u), ...(model.baselineU === .5 ? [.5] : [])])];
  for (const u of planes) {
    const points = ringAt(shape, u);
    shape.loops.forEach((loop, l) => loop.forEach((point, k) => {
      edges.push({ key: `ring:${u}:${l}:${k}`, a: at(points[point]!, u), b: at(points[loop[(k + 1) % loop.length]!]!, u),
        location: { loop: l, edge: k, u, fraction: 0 } });
    }));
  }
  for (let r = 1; r < shape.rings.length; r++) {
    const a = shape.rings[r - 1]!, b = shape.rings[r]!;
    shape.loops.forEach((loop, l) => loop.forEach((point, k) => {
      edges.push({ key: `through:${r}:${point}`, a: at(a.points[point]!, a.u), b: at(b.points[point]!, b.u),
        location: { loop: l, edge: k, u: a.u, fraction: b.u, through: true } });
    }));
  }
  return edges.filter(e => Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y, e.a.z - e.b.z) > SOLID_EPS);
}

export function boundaryPosition(studio: Studio, selection: SolidSelection, location: SolidLocation) {
  const model = studioSolid(studio, selection);
  if (!model || model.shape.loops[location.loop]?.[location.edge] === undefined) return null;
  return model.at(locationPoint(model.shape, location), location.u);
}
function store(studio: Studio, selection: SolidSelection, shape: ProfileSolid): Studio {
  if (selection.kind === 'wall') return { ...studio, template: 'custom', walls: studio.walls.map(w => w.id === selection.id ? { ...w, shape } : w) };
  return { ...studio, template: 'custom', ceilings: studio.ceilings?.map(c => {
    if (c.id !== selection.id) return c;
    // Original height fields continue to address the same original controls.
    const profile = c.profile.map((p, k) => {
      const control = shape.controls.find(h => h.id === 'p' + k), at = control ? controlPoint(shape, control) : p;
      return { t: at.t, y: at.y };
    });
    return { ...c, shape, profile, ...(c.run === 'across' ? { depth: Math.max(...shape.rings.flatMap(r => r.points.map(p => p.t))) } : {}) };
  }) };
}
export function divideStudioBoundary(studio: Studio, selection: SolidSelection, location: SolidLocation): Studio | null {
  const model = studioSolid(studio, selection), shape = model && (location.through
    ? divideHorizontalSolid(model.shape, location) : divideSolid(model.shape, location));
  return shape ? store(studio, selection, shape) : null;
}
export function moveStudioControl(studio: Studio, selection: SolidSelection, id: string, t: number, y: number): Studio | null {
  const model = studioSolid(studio, selection), shape = model && moveSolidControl(model.shape, id, t, y);
  return shape ? store(studio, selection, shape) : null;
}
export function moveStudioHorizontal(studio: Studio, selection: SolidSelection, id: string, s: number, d: number): Studio | null {
  const model = studioSolid(studio, selection), shape = model && moveHorizontalSolid(model.shape, id, s, d);
  return shape ? store(studio, selection, shape) : null;
}
export function studioSolidProblems(studio: Studio, selection: SolidSelection): string[] {
  const model = studioSolid(studio, selection);
  if (!model) return ['The shape has no supporting wall.'];
  const { ceiling, extent, face, top } = model;
  return solidProblems(model.shape, {
    minT: ceiling ? ceiling.run === 'along' ? face.start : 0 : extent.start,
    maxT: ceiling ? ceiling.run === 'along' ? face.end : 2000 : extent.end,
    minY: ceiling ? 40 : 0, maxY: top,
  });
}
