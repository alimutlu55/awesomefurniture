import { wallFace, wallLine, type Studio } from '../../domain/studio/studio';
import { door2DPlan } from '../../domain/studio/studio-plan';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { slideFixture } from '../../domain/studio/fixtures/fixture-setup';
import { moveOpening } from '../../domain/studio/studio-edit';
import type { Point2D } from './studio-2d-canvas';

export interface WallAsset { kind: 'opening' | 'fixture'; id: string }
const distanceToSegment = (p: Point2D, a: Point2D, b: Point2D) => {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};

/** A finger may land anywhere inside a door swing, or within 22 px of a wall asset's footprint. */
export function nearbyWallAsset(studio: Studio, point: Point2D, zoom: number): WallAsset | null {
  const hits: { asset: WallAsset; distance: number }[] = [];
  for (const o of studio.openings) {
    const w = studio.walls.find(w => w.id === o.wall), line = w && wallLine(studio, w);
    if (!w || !line) continue;
    const at = (s: number) => ({ x: line.a.x + line.ux * s + line.nx * w.thickness / 2, z: line.a.z + line.uz * s + line.nz * w.thickness / 2 });
    let distance = distanceToSegment(point, at(o.offset - o.width / 2), at(o.offset + o.width / 2));
    const door = o.kind === 'door' ? door2DPlan(studio, o) : null;
    if (door) {
      const dx = point.x - door.hingePoint.x, dz = point.z - door.hingePoint.z;
      const ux = (door.closedPoint.x - door.hingePoint.x) / door.radius, uz = (door.closedPoint.z - door.hingePoint.z) / door.radius;
      const fx = (door.openPoint.x - door.hingePoint.x) / door.radius, fz = (door.openPoint.z - door.hingePoint.z) / door.radius;
      if (dx * ux + dz * uz >= 0 && dx * fx + dz * fz >= 0 && Math.hypot(dx, dz) <= door.radius) distance = 0;
      distance = Math.min(distance, distanceToSegment(point, door.hingePoint, door.openPoint));
    }
    hits.push({ asset: { kind: 'opening', id: o.id }, distance: distance * zoom });
  }
  for (const f of studio.fixtures ?? []) {
    const place = fixturePlace(studio, f); if (!place) continue;
    const c = place.solid, a = c.angle * Math.PI / 180, dx = point.x - c.x, dz = point.z - c.z;
    const x = Math.abs(dx * Math.cos(a) - dz * Math.sin(a)), z = Math.abs(dx * Math.sin(a) + dz * Math.cos(a));
    const distance = Math.hypot(Math.max(0, x - c.state.w / 2), Math.max(0, z - c.state.d / 2)) * zoom;
    hits.push({ asset: { kind: 'fixture', id: f.id }, distance });
  }
  return hits.filter(h => h.distance <= 22).sort((a, b) => a.distance - b.distance)[0]?.asset ?? null;
}

/** Preserve direct furniture/visible corner hits, while allowing a finger to miss a thin window or utility. */
export function pickWallAsset(studio: Studio | null, point: Point2D, zoom: number, target: Element): WallAsset | null {
  for (const [attribute, kind] of [['data-opening-id', 'opening'], ['data-fixture-id', 'fixture']] as const) {
    const el = target.closest(`[${attribute}]`);
    if (el) return { kind, id: el.getAttribute(attribute)! };
  }
  if (!studio || target.closest('[data-cabinet-id]')) return null;
  const corner = target.closest('[data-corner-id]');
  const c = corner && studio.corners.find(c => c.id === corner.getAttribute('data-corner-id'));
  if (c && Math.hypot(c.x - point.x, c.z - point.z) * zoom <= 10) return null;
  return nearbyWallAsset(studio, point, zoom);
}

/** Slide by the pointer's travel, not its absolute position: grabbing an edge never recentres the item. */
export function slideWallAsset(studio: Studio, original: Studio, asset: WallAsset, from: Point2D, to: Point2D): Studio | null {
  const item = asset.kind === 'opening' ? original.openings.find(o => o.id === asset.id) : original.fixtures?.find(f => f.id === asset.id);
  const wall = item && original.walls.find(w => w.id === item.wall), line = wall && wallLine(original, wall);
  if (!item || !wall || !line) return null;
  const offset = item.offset + (to.x - from.x) * line.ux + (to.z - from.z) * line.uz;
  if (asset.kind === 'opening') return moveOpening(studio, asset.id, Math.round(offset));
  const face = wallFace(original, wall); if (!face) return null;
  return slideFixture(studio, asset.id, Math.max(face.start + item.width / 2, Math.min(face.end - item.width / 2, Math.round(offset))));
}
