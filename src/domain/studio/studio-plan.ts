import { STUDIO_LIMITS, corner, cornerDegree, nextId, wall, wallExtent, wallFace, wallLine, type Studio, type StudioCorner, type StudioOpening, type StudioWall } from './studio';
import { studioTemplate } from './studio-templates';
import { boundedRoomPolygons } from './room-polygons';

export interface Point2D { readonly x: number; readonly z: number; }

export interface DetectedRoom {
  readonly name: string;
  readonly areaM2: number;
  readonly centroid: Point2D;
  readonly polygon: readonly Point2D[];
}

export interface Wall2DPlan {
  readonly id: string;
  readonly solid: readonly Point2D[];
  readonly faceFrom: Point2D;
  readonly faceTo: Point2D;
  readonly faceLength: number;
  readonly thickness: number;
  readonly angle: number;
}

export interface Door2DPlan {
  readonly id: string;
  readonly wallId: string;
  readonly width: number;
  readonly hingePoint: Point2D;
  readonly closedPoint: Point2D;
  readonly openPoint: Point2D;
  readonly arcStartAngle: number;
  readonly arcEndAngle: number;
  readonly radius: number;
  readonly swingDir: 1 | -1;
}

export interface Window2DPlan {
  readonly id: string;
  readonly wallId: string;
  readonly width: number;
  readonly outerFrom: Point2D;
  readonly outerTo: Point2D;
  readonly innerFrom: Point2D;
  readonly innerTo: Point2D;
  readonly glassFrom: Point2D;
  readonly glassTo: Point2D;
}

/** Polygon points for a wall's 2D footprint, inside face and orientation. */
export function wall2DPlan(studio: Studio, w: StudioWall): Wall2DPlan | null {
  const line = wallLine(studio, w), face = wallFace(studio, w);
  if (!line || !face) return null;
  const { start, end } = wallExtent(studio, w, line.length);
  const half = w.thickness / 2;
  const at = (t: number, s: number): Point2D => ({
    x: Math.round((line.a.x + line.ux * t + line.nx * s) * 10) / 10,
    z: Math.round((line.a.z + line.uz * t + line.nz * s) * 10) / 10,
  });
  const solid: Point2D[] = [
    at(start, half),
    at(end, half),
    at(end, -half),
    at(start, -half),
  ];
  return {
    id: w.id,
    solid,
    faceFrom: face.from,
    faceTo: face.to,
    faceLength: face.length,
    thickness: w.thickness,
    angle: line.angle,
  };
}

/** Door leaf and swing arc geometry for technical 2D representation. */
export function door2DPlan(studio: Studio, o: StudioOpening): Door2DPlan | null {
  const w = studio.walls.find(x => x.id === o.wall);
  const line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const hingeLeft = (o.hinge ?? 'left') === 'left';
  const swingIn = (o.swing ?? 'in') === 'in';
  const half = w.thickness / 2;
  const offset = o.offset;
  const halfW = o.width / 2;
  const alongHinge = hingeLeft ? offset - halfW : offset + halfW;
  const alongOpposite = hingeLeft ? offset + halfW : offset - halfW;
  const roomSign = swingIn ? 1 : -1;
  const hx = line.a.x + line.ux * alongHinge + line.nx * half;
  const hz = line.a.z + line.uz * alongHinge + line.nz * half;
  const cx = line.a.x + line.ux * alongOpposite + line.nx * half;
  const cz = line.a.z + line.uz * alongOpposite + line.nz * half;
  const ox = hx + line.nx * roomSign * o.width;
  const oz = hz + line.nz * roomSign * o.width;
  const startAng = Math.atan2(cz - hz, cx - hx);
  const endAng = Math.atan2(oz - hz, ox - hx);
  return {
    id: o.id,
    wallId: o.wall,
    width: o.width,
    hingePoint: { x: hx, z: hz },
    closedPoint: { x: cx, z: cz },
    openPoint: { x: ox, z: oz },
    arcStartAngle: startAng,
    arcEndAngle: endAng,
    radius: o.width,
    swingDir: hingeLeft ? (swingIn ? 1 : -1) : (swingIn ? -1 : 1),
  };
}

/** Window frame and triple-glazing lines for 2D architectural display. */
export function window2DPlan(studio: Studio, o: StudioOpening): Window2DPlan | null {
  const w = studio.walls.find(x => x.id === o.wall);
  const line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const half = w.thickness / 2;
  const a = o.offset - o.width / 2, b = o.offset + o.width / 2;
  const pt = (t: number, s: number): Point2D => ({
    x: Math.round((line.a.x + line.ux * t + line.nx * s) * 10) / 10,
    z: Math.round((line.a.z + line.uz * t + line.nz * s) * 10) / 10,
  });
  return {
    id: o.id,
    wallId: o.wall,
    width: o.width,
    innerFrom: pt(a, half),
    innerTo: pt(b, half),
    outerFrom: pt(a, -half),
    outerTo: pt(b, -half),
    glassFrom: pt(a, 0),
    glassTo: pt(b, 0),
  };
}

/** Calculates one area label per enclosed face of the wall graph, excluding the exterior perimeter. */
export function detectRooms(studio: Studio): readonly DetectedRoom[] {
  const rooms: DetectedRoom[] = [];
  for (const pts of boundedRoomPolygons(studio)) {
    let signedArea = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      signedArea += p.x * q.z - q.x * p.z;
    }
    const areaCm2 = Math.abs(signedArea) / 2;
    if (areaCm2 < 1000) continue; // smaller than 0.1 m2
    const areaM2 = Math.round((areaCm2 / 10000) * 10) / 10;

    let cx = 0, cz = 0;
    const factor = signedArea * 3;
    if (Math.abs(factor) > 1e-4) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
        const cross = p.x * q.z - q.x * p.z;
        cx += (p.x + q.x) * cross;
        cz += (p.z + q.z) * cross;
      }
      cx /= factor;
      cz /= factor;
    } else {
      cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
      cz = pts.reduce((sum, p) => sum + p.z, 0) / pts.length;
    }

    const tName = studio.template !== 'custom' ? studioTemplate(studio.template)?.name : undefined;
    const name = tName ?? 'Room';
    rooms.push({
      name,
      areaM2,
      centroid: { x: Math.round(cx * 10) / 10, z: Math.round(cz * 10) / 10 },
      polygon: pts,
    });
  }

  return rooms;
}

const custom = (studio: Studio, changes: Partial<Studio>): Studio => ({
  ...studio,
  ...changes,
  template: 'custom',
});

/** Splits a wall into an architectural step with a riser, creating an alcove/recess or L-step. */
export function stepStudioWall(studio: Studio, wallId: string, depth = 50, fraction = 0.5): Studio | null {
  const w = wall(studio, wallId);
  const line = w && wallLine(studio, w);
  if (!w || !line || line.length < 80) return null;

  const d = line.length * fraction;
  const min = STUDIO_LIMITS.minWallLength;
  if (!Number.isFinite(d) || d < min || line.length - d < min) return null;

  const p1 = { x: Math.round(line.a.x + line.ux * d), z: Math.round(line.a.z + line.uz * d) };
  const p2 = { x: Math.round(p1.x + line.nx * depth), z: Math.round(p1.z + line.nz * depth) };

  const next = studio.walls.find(o => o.id !== w.id && (o.a === w.b || o.b === w.b));
  const nl = next && wallLine(studio, next);
  const isPerp = nl && Math.abs(line.ux * nl.ux + line.uz * nl.uz) < 0.3;

  if (isPerp || cornerDegree(studio, w.b) === 1) {
    const bNew = { x: Math.round(line.b.x + line.nx * depth), z: Math.round(line.b.z + line.nz * depth) };
    const c1: StudioCorner = { id: nextId('c', studio.corners), x: p1.x, z: p1.z };
    const c2: StudioCorner = { id: nextId('c', [...studio.corners, c1]), x: p2.x, z: p2.z };

    const wall1: StudioWall = { ...w, id: nextId('w', studio.walls), a: w.a, b: c1.id };
    const wallRiser: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1]), a: c1.id, b: c2.id };
    const wall2: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1, wallRiser]), a: c2.id, b: w.b };

    const corners = studio.corners.map(c => c.id === w.b ? { ...c, x: bNew.x, z: bNew.z } : c).concat([c1, c2]);
    const walls = studio.walls.filter(x => x.id !== w.id).concat([wall1, wallRiser, wall2]);
    return custom(studio, { corners, walls });
  }

  if (line.length - d < 2 * min) return null;
  const stepRun = Math.min(80, line.length - d - min);
  const p3 = { x: Math.round(p2.x + line.ux * stepRun), z: Math.round(p2.z + line.uz * stepRun) };
  const p4 = { x: Math.round(p1.x + line.ux * stepRun), z: Math.round(p1.z + line.uz * stepRun) };

  const c1: StudioCorner = { id: nextId('c', studio.corners), x: p1.x, z: p1.z };
  const c2: StudioCorner = { id: nextId('c', [...studio.corners, c1]), x: p2.x, z: p2.z };
  const c3: StudioCorner = { id: nextId('c', [...studio.corners, c1, c2]), x: p3.x, z: p3.z };
  const c4: StudioCorner = { id: nextId('c', [...studio.corners, c1, c2, c3]), x: p4.x, z: p4.z };

  const wall1: StudioWall = { ...w, id: nextId('w', studio.walls), a: w.a, b: c1.id };
  const wall2: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1]), a: c1.id, b: c2.id };
  const wall3: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1, wall2]), a: c2.id, b: c3.id };
  const wall4: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1, wall2, wall3]), a: c3.id, b: c4.id };
  const wall5: StudioWall = { ...w, id: nextId('w', [...studio.walls, wall1, wall2, wall3, wall4]), a: c4.id, b: w.b };

  return custom(studio, {
    corners: [...studio.corners, c1, c2, c3, c4],
    walls: studio.walls.filter(x => x.id !== w.id).concat([wall1, wall2, wall3, wall4, wall5]),
  });
}

/** Removes a corner where two walls meet, merging them into one direct wall. */
export function removeStudioCorner(studio: Studio, cornerId: string): Studio | null {
  const c = corner(studio, cornerId);
  if (!c || studio.corners.length <= 3) return null;
  const connected = studio.walls.filter(w => w.a === cornerId || w.b === cornerId);
  const w1 = connected[0], w2 = connected[1];
  if (connected.length === 2 && w1 && w2) {
    const otherA = w1.a === cornerId ? w1.b : w1.a;
    const otherB = w2.a === cornerId ? w2.b : w2.a;
    if (otherA === otherB) return null;
    const mergedWall: StudioWall = {
      ...w1,
      id: nextId('w', studio.walls),
      a: otherA,
      b: otherB,
      thickness: w1.thickness,
      height: w1.height,
    };
    return custom(studio, {
      corners: studio.corners.filter(x => x.id !== cornerId),
      walls: studio.walls.filter(w => w.id !== w1.id && w.id !== w2.id).concat([mergedWall]),
    });
  }
  return null;
}
