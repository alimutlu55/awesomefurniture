import { interpolateBoundary, lowerBoundary, type BoundaryLocation, type BoundaryPoint, type BoundarySection } from '../geometry/boundary';
import { interpolateSolid, solidEdges, solidPoint, validSections, type SolidPoint } from '../geometry/solid-boundary';
import { ceilingFrame } from './studio-ceiling';
import { ceilingBoundary, controlledBoundary, splitSurfaceBoundary, wallBoundary, type BoundarySurface } from './studio-boundary';
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
  const located = solid && solidPoint(solid.edges, at);
  if (!solid || !located || !Number.isFinite(at.fraction) || at.fraction < 0 || at.fraction > 1) return null;
  const part = kind === 'wall' ? room.walls.find(w => w.id === id)! : room.ceilings!.find(c => c.id === id)!;
  const corner = at.across || at.fraction === 0 || at.fraction === 1;
  if (!corner && !part.sections) return splitSurfaceBoundary(room, kind, id, at);
  const sections = part.sections ? [...solid.sections] : solid.sections.map(s => ({ ...s, outline: controlledBoundary(room, kind, id) }));
  if (corner) {
    const index = (at.edge + (!at.across && at.fraction === 1 ? 1 : 0)) % sections[0]!.outline.length;
    const u = located.u, point = sections.at(-1)!.outline[index]!;
    const ordinary = kind === 'ceiling' && room.ceilings!.find(c => c.id === id)!.run === 'across' ? .5 : 1;
    if (point.control === u || point.control === undefined && u === ordinary) return null;
    // Reuse this one logical corner at the chosen location. No new profile vertex or depth ring.
    const outline = sections.at(-1)!.outline.map((p, k) => k === index ? { ...p, control: u } : p);
    if (!part.sections) return kind === 'wall'
      ? { ...room, template: 'custom', walls: room.walls.map(w => w.id === id ? { ...w, outline } : w) }
      : { ...room, template: 'custom', ceilings: room.ceilings?.map(c => c.id === id ? { ...c, outline, profile: lowerBoundary(outline) } : c) };
    return replaceSurfaceSections(room, kind, id, sections.map(s => ({ ...s,
      outline: s.outline.map((p, k) => k === index ? { ...p, control: u } : p) })));
  } else {
    for (let k = 0; k < sections.length; k++) {
      const s = sections[k]!, a = s.outline[at.edge]!, b = s.outline[(at.edge + 1) % s.outline.length]!;
      const control = solid.sections[at.section ?? sections.length - 1]!.u;
      sections[k] = { ...s, outline: [...s.outline.slice(0, at.edge + 1), { ...interpolateBoundary(a, b, at.fraction), control }, ...s.outline.slice(at.edge + 1)] };
    }
  }
  return replaceSurfaceSections(room, kind, id, sections);
}
export function moveSolidBoundaryPoint(room: Studio, kind: BoundarySurface, id: string, section: number | undefined, index: number, point: BoundaryPoint): Studio | null {
  const solid = surfaceSolid(room, kind, id);
  if (!solid) return null;
  const at = section ?? solid.sections.length - 1;
  if (!solid.sections[at]?.outline[index]) return null;
  const from = solid.sections[at]!.outline[index]!;
  return replaceSurfaceSections(room, kind, id, solid.sections.map(s => ({ ...s,
    outline: s.outline.map((p, j) => j === index ? { ...p, t: p.t + point.t - from.t, y: p.y + point.y - from.y } : p) })));
}
export function solidLocationPoint(room: Studio, kind: BoundarySurface, id: string, at: BoundaryLocation) {
  const solid = surfaceSolid(room, kind, id), p = solid && solidPoint(solid.edges, at);
  return solid && p ? { ...solid.world(p), position: p.t } : null;
}
export { interpolateSolid };
