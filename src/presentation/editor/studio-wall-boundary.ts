import { boundaryPoint } from '../../domain/geometry/boundary';
import { ceilingBoundary, moveSurfaceBoundaryPoint, wallBoundary } from '../../domain/studio/studio-boundary';
import { wallFace, wallLine, type Studio, type StudioWall } from '../../domain/studio/studio';
import type { RoomHandle, RoomMeasure } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format.js';
import { moveSolidBoundaryPoint, solidLocationPoint, surfaceSolid } from '../../domain/studio/studio-solid-boundary';
import { createSolidBoundaryCursor } from './solid-boundary-cursor';
import { innerSurfaceHandles } from './studio-solid-handles';

export function isBoundaryPoint(room: Studio, h: RoomHandle): boolean {
  const ceiling = h.kind === 'ceiling' ? room.ceilings?.find(c => c.id === h.id) : null;
  return h.kind === 'wall-point' || !!ceiling && (!!ceiling.outline || !!ceiling.sections || h.section !== undefined || h.index! >= ceiling.profile.length);
}

export function wallRuler(studio: Studio, w: StudioWall): RoomMeasure | null {
  const line = wallLine(studio, w), face = wallFace(studio, w);
  if (!line || !face || face.length < 1) return null;
  const o = { x: line.nx * 4, z: line.nz * 4 }, y = w.height + 12;
  return { a: { x: face.from.x + o.x, y, z: face.from.z + o.z }, b: { x: face.to.x + o.x, y, z: face.to.z + o.z },
    text: measureNumber(Math.round(face.length * 10) / 10) + unitSuffix() };
}

function pointsFor(room: Studio, h: RoomHandle) {
  const kind = h.kind === 'wall-point' ? 'wall' : 'ceiling', part = kind === 'wall'
    ? room.walls.find(w => w.id === h.id) : room.ceilings?.find(c => c.id === h.id);
  if (h.section !== undefined || part?.sections) {
    const sections = surfaceSolid(room, kind, h.id)!.sections;
    return sections[h.section ?? sections.length - 1]!.outline;
  }
  return h.kind === 'wall-point' ? wallBoundary(room, room.walls.find(w => w.id === h.id)!)
    : ceilingBoundary(room, room.ceilings!.find(c => c.id === h.id)!);
}
export function boundaryPointDrag(original: Studio, last: Studio, h: RoomHandle, d: { s: number; y: number }) {
  const p = pointsFor(original, h)[h.index!]!, now = pointsFor(last, h)[h.index!]!;
  return (fraction: number) => writePoint(original, h, { t: now.t + (p.t + d.s - now.t) * fraction, y: now.y + (p.y + d.y - now.y) * fraction });
}
function writePoint(room: Studio, h: RoomHandle, point: { t: number; y: number }) {
  const kind = h.kind === 'wall-point' ? 'wall' : 'ceiling', part = kind === 'wall'
    ? room.walls.find(w => w.id === h.id)! : room.ceilings!.find(c => c.id === h.id)!;
  return part.sections || h.section !== undefined ? moveSolidBoundaryPoint(room, kind, h.id, h.section, h.index!, point)
    : moveSurfaceBoundaryPoint(room, kind, h.id, h.index!, point);
}
export function nudgeBoundaryPoint(room: Studio, h: RoomHandle, across: number, deep: number) {
  const p = pointsFor(room, h)[h.index!]!;
  return writePoint(room, h, { t: p.t + across, y: p.y + deep });
}

export function createWallBoundaryEditing(screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) {
  const cursor = createSolidBoundaryCursor(screen);
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
      const sections = surfaceSolid(room, 'wall', w.id)!.sections;
      const at = chosen && points[chosen.edge] && (chosen.section === undefined || sections[chosen.section]) ? chosen : { edge: 2, fraction: .5 };
      const out: RoomHandle[] = (w.outline || w.sections ? points : []).map((p, index) => ({ key: 'wall-point:' + w.id + ':' + index, kind: 'wall-point', id: w.id, index,
        ...world(p), label: 'Wall boundary point ' + (index + 1) + '. Drag to reshape the wall', ux: line.ux, uz: line.uz }));
      const p = boundaryPoint(points, at);
      const located = solidLocationPoint(room, 'wall', w.id, at);
      if (p && located) out.push({ key: 'wall-split:' + w.id, kind: 'wall-split', id: w.id, index: at.edge, boundary: at,
        ...located, label: 'Add a wall shape point here. Drag around any 3D edge, including inner corners; tap to divide' });
      out.push(...innerSurfaceHandles(room, 'wall', w.id));
      return out;
    },
    move(room: Studio, h: RoomHandle, dx: number, dy: number) {
      const w = room.walls.find(w => w.id === h.id);
      if (!w) return;
      const g = surfaceSolid(room, 'wall', w.id)!, origin = screen(h);
      cursor.move(h.id, g.edges, g.world, { x: origin.x + dx, y: origin.y + dy }, h.boundary);
    },
    nudge(room: Studio, h: RoomHandle, amount: number) {
      const w = room.walls.find(w => w.id === h.id);
      const g = w && surfaceSolid(room, 'wall', w.id);
      if (g) cursor.nudge(h.id, g.edges, g.world, h.boundary!, amount);
    },
  };
}
