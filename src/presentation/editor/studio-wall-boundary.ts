import { boundaryPoint } from '../../domain/geometry/boundary';
import { ceilingBoundary, moveSurfaceBoundaryPoint, wallBoundary } from '../../domain/studio/studio-boundary';
import { wallFace, wallLine, type Studio, type StudioWall } from '../../domain/studio/studio';
import { createBoundaryCursor } from './boundary-cursor';
import type { RoomHandle, RoomMeasure } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format.js';

export function isBoundaryPoint(room: Studio, h: RoomHandle): boolean {
  const ceiling = h.kind === 'ceiling' ? room.ceilings?.find(c => c.id === h.id) : null;
  return h.kind === 'wall-point' || !!ceiling && (!!ceiling.outline || h.index! >= ceiling.profile.length);
}

export function wallRuler(studio: Studio, w: StudioWall): RoomMeasure | null {
  const line = wallLine(studio, w), face = wallFace(studio, w);
  if (!line || !face || face.length < 1) return null;
  const o = { x: line.nx * 4, z: line.nz * 4 }, y = w.height + 12;
  return { a: { x: face.from.x + o.x, y, z: face.from.z + o.z }, b: { x: face.to.x + o.x, y, z: face.to.z + o.z },
    text: measureNumber(Math.round(face.length * 10) / 10) + unitSuffix() };
}

function pointsFor(room: Studio, h: RoomHandle) {
  return h.kind === 'wall-point' ? wallBoundary(room, room.walls.find(w => w.id === h.id)!)
    : ceilingBoundary(room, room.ceilings!.find(c => c.id === h.id)!);
}
export function boundaryPointDrag(original: Studio, last: Studio, h: RoomHandle, d: { s: number; y: number }) {
  const p = pointsFor(original, h)[h.index!]!, now = pointsFor(last, h)[h.index!]!;
  return (fraction: number) => moveSurfaceBoundaryPoint(original, h.kind === 'wall-point' ? 'wall' : 'ceiling', h.id, h.index!,
    { t: now.t + (p.t + d.s - now.t) * fraction, y: now.y + (p.y + d.y - now.y) * fraction });
}
export function nudgeBoundaryPoint(room: Studio, h: RoomHandle, across: number, deep: number) {
  const p = pointsFor(room, h)[h.index!]!;
  return moveSurfaceBoundaryPoint(room, h.kind === 'wall-point' ? 'wall' : 'ceiling', h.id, h.index!, { t: p.t + across, y: p.y + deep });
}

export function createWallBoundaryEditing(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  const cursor = createBoundaryCursor(screen);
  function geometry(room: Studio, w: StudioWall) {
    const line = wallLine(room, w)!;
    const world = (p: { t: number; y: number }) => ({ x: line.a.x + line.ux * p.t + line.nx * w.thickness / 2,
      z: line.a.z + line.uz * p.t + line.nz * w.thickness / 2, y: p.y });
    return { points: wallBoundary(room, w), line, world };
  }
  return {
    begin: cursor.begin, cancel: cursor.cancel,
    clear: cursor.clear,
    handles(room: Studio, w: StudioWall): RoomHandle[] {
      const { points, line, world } = geometry(room, w), chosen = cursor.location(w.id);
      const at = chosen && points[chosen.edge] ? chosen : { edge: 2, fraction: .5 };
      const out: RoomHandle[] = points.map((p, index) => ({ key: 'wall-point:' + w.id + ':' + index, kind: 'wall-point', id: w.id, index,
        ...world(p), label: 'Wall boundary point ' + (index + 1) + '. Drag to reshape the wall', ux: line.ux, uz: line.uz }));
      const p = boundaryPoint(points, at);
      if (p) out.push({ key: 'wall-split:' + w.id, kind: 'wall-split', id: w.id, index: at.edge, boundary: at, position: p.t,
        ...world(p), label: 'Add a wall shape point here. Drag around the boundary to choose where; tap to divide' });
      return out;
    },
    move(room: Studio, h: RoomHandle, dx: number, dy: number) {
      const w = room.walls.find(w => w.id === h.id);
      if (!w) return;
      const g = geometry(room, w), origin = screen(h);
      cursor.move(h.id, g.points, g.world, { x: origin.x + dx, y: origin.y + dy }, h.boundary);
    },
    nudge(room: Studio, h: RoomHandle, amount: number) {
      const w = room.walls.find(w => w.id === h.id);
      if (w) cursor.nudge(h.id, wallBoundary(room, w), h.boundary!, amount);
    },
  };
}
