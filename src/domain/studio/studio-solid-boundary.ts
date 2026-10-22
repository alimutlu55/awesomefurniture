import { interpolateBoundary, lowerBoundary, type BoundaryLocation, type BoundaryPoint, type BoundarySection } from '../geometry/boundary';
import { interpolateSolid, sharedProfile, solidEdges, solidPoint, validSections, type SolidPoint } from '../geometry/solid-boundary';
import { ceilingFrame } from './studio-ceiling';
import { ceilingBoundary, splitSurfaceBoundary, wallBoundary, type BoundarySurface } from './studio-boundary';
import { wallLine, type Studio } from './studio';

/** Every rim and return edge of the actual solid, including its wall-side corners. */
export function surfaceSolid(room: Studio, kind: BoundarySurface, id: string) {
  const ceiling = kind === 'ceiling' ? room.ceilings?.find(c => c.id === id) : undefined;
  const wall = room.walls.find(w => w.id === (ceiling?.wall ?? id));
  const line = wall && wallLine(room, wall), frame = ceiling && ceilingFrame(room, ceiling);
  if (!wall || !line || kind === 'ceiling' && !frame) return null;
  const outline = ceiling ? ceilingBoundary(room, ceiling) : wallBoundary(room, wall);
  const sections = (ceiling ?? wall).sections ?? [{ u: 0, outline }, { u: 1, outline }];
  const world = (p: SolidPoint) => {
    if (ceiling && frame) return { ...(ceiling.run === 'along' ? frame.at(p.t, p.u * ceiling.depth)
      : frame.at(frame.face.start + (frame.face.end - frame.face.start) * p.u, p.t)), y: p.y };
    const offset = (p.u - .5) * wall.thickness;
    return { x: line.a.x + line.ux * p.t + line.nx * offset, y: p.y, z: line.a.z + line.uz * p.t + line.nz * offset };
  };
  return { sections, edges: solidEdges(sections), world };
}
export function replaceSurfaceSections(room: Studio, kind: BoundarySurface, id: string, sections: readonly BoundarySection[]): Studio | null {
  if (!validSections(sections)) return null;
  const outline = sections.at(-1)!.outline;
  if (kind === 'wall') return { ...room, template: 'custom', walls: room.walls.map(w => w.id === id ? { ...w, sections, outline } : w) };
  const profile = lowerBoundary(outline), extent = Math.max(...sections.flatMap(s => s.outline.map(p => p.t)));
  return { ...room, template: 'custom', ceilings: room.ceilings?.map(c => c.id === id
    ? { ...c, sections, outline, profile, depth: c.run === 'across' ? extent : c.depth } : c) };
}
export function splitSolidBoundary(room: Studio, kind: BoundarySurface, id: string, at: BoundaryLocation): Studio | null {
  const solid = surfaceSolid(room, kind, id);
  if (!solid || !solidPoint(solid.edges, at) || !Number.isFinite(at.fraction) || at.fraction <= 0 || at.fraction >= 1) return null;
  const part = kind === 'wall' ? room.walls.find(w => w.id === id)! : room.ceilings!.find(c => c.id === id)!;
  if (!at.across && !part.sections) return splitSurfaceBoundary(room, kind, id, at);
  const sections = [...solid.sections];
  if (at.across) {
    const k = at.section ?? 0, a = sections[k], b = sections[k + 1];
    if (!a || !b) return null;
    sections.splice(k + 1, 0, { u: a.u + (b.u - a.u) * at.fraction,
      outline: a.outline.map((p, i) => interpolateBoundary(p, b.outline[i]!, at.fraction)) });
  } else {
    for (let k = 0; k < sections.length; k++) {
      const s = sections[k]!, a = s.outline[at.edge]!, b = s.outline[(at.edge + 1) % s.outline.length]!;
      sections[k] = { ...s, outline: [...s.outline.slice(0, at.edge + 1), interpolateBoundary(a, b, at.fraction), ...s.outline.slice(at.edge + 1)] };
    }
  }
  return replaceSurfaceSections(room, kind, id, sections);
}
export function moveSolidBoundaryPoint(room: Studio, kind: BoundarySurface, id: string, section: number | undefined, index: number, point: BoundaryPoint): Studio | null {
  const solid = surfaceSolid(room, kind, id);
  if (!solid) return null;
  const at = section ?? solid.sections.length - 1;
  if (!solid.sections[at]?.outline[index]) return null;
  const linked = sharedProfile(solid.sections);
  return replaceSurfaceSections(room, kind, id, solid.sections.map((s, k) => k === at || linked
    ? { ...s, outline: s.outline.map((p, j) => j === index ? { t: point.t, y: point.y } : p) } : s));
}
export function solidLocationPoint(room: Studio, kind: BoundarySurface, id: string, at: BoundaryLocation) {
  const solid = surfaceSolid(room, kind, id), p = solid && solidPoint(solid.edges, at);
  return solid && p ? { ...solid.world(p), position: p.t } : null;
}
export { interpolateSolid };
