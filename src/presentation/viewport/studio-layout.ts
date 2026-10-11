import { studioBounds, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioCorner, StudioWall } from '../../domain/studio/studio';

/** Each connected wall component gets its own floor. Closed rings can run in either direction. */
export function studioFloorPolygons(studio: Studio): { x: number; z: number }[][] {
  const remaining = new Set(studio.walls.filter(w => wallLine(studio, w))), polygons: { x: number; z: number }[][] = [];
  while (remaining.size) {
    const seed = remaining.values().next().value as StudioWall;
    const component: StudioWall[] = [], pending = [seed];
    remaining.delete(seed);
    while (pending.length) {
      const w = pending.pop()!;
      component.push(w);
      for (const other of remaining) if ([w.a, w.b].includes(other.a) || [w.a, w.b].includes(other.b)) {
        remaining.delete(other); pending.push(other);
      }
    }
    const corners = studio.corners.filter(c => component.some(w => w.a === c.id || w.b === c.id));
    const ring: StudioCorner[] = [], visited = new Set<StudioWall>();
    let at = seed.a;
    if (corners.every(c => component.filter(w => w.a === c.id || w.b === c.id).length === 2)) {
      while (visited.size < component.length) {
        const w = component.find(w => !visited.has(w) && (w.a === at || w.b === at));
        if (!w) break;
        ring.push(corners.find(c => c.id === at)!); visited.add(w); at = w.a === at ? w.b : w.a;
      }
    }
    if (ring.length >= 3 && visited.size === component.length && at === seed.a) polygons.push(ring);
    else {
      // Open walls get enough standing space on their room side, including rotated layouts.
      const points = component.flatMap(w => {
        const line = wallLine(studio, w)!;
        return [line.a, line.b].flatMap(p => [p, { x: p.x + line.nx * 260, z: p.z + line.nz * 260 }]);
      });
      const x0 = Math.min(...points.map(p => p.x)) - 40, x1 = Math.max(...points.map(p => p.x)) + 40;
      const z0 = Math.min(...points.map(p => p.z)) - 40, z1 = Math.max(...points.map(p => p.z)) + 40;
      polygons.push([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
    }
  }
  return polygons;
}

interface SceneBounds { x: number; z: number; w: number; d: number; h: number }
/** Room framing is opt-in: normal wardrobe framing and collision bounds remain unchanged. */
export function studioCameraBounds(studio: Studio | undefined, cabinets: SceneBounds): SceneBounds {
  const b = studio && studioBounds(studio);
  if (!b) return cabinets;
  const x0 = Math.min(b.x0, cabinets.x - cabinets.w / 2), x1 = Math.max(b.x1, cabinets.x + cabinets.w / 2);
  const z0 = Math.min(b.z0, cabinets.z - cabinets.d / 2), z1 = Math.max(b.z1, cabinets.z + cabinets.d / 2);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.max(b.height, cabinets.h) };
}
