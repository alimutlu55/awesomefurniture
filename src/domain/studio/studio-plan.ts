import { corner, wallExtent, wallFace, wallLine, type Studio, type StudioOpening, type StudioWall } from './studio';
import { studioTemplate } from './studio-templates';

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

/** Identifies room cycles from walls and calculates floor area in square meters. */
export function detectRooms(studio: Studio): readonly DetectedRoom[] {
  if (studio.walls.length < 3) return [];
  const adjacency = new Map<string, string[]>();
  for (const c of studio.corners) adjacency.set(c.id, []);
  for (const w of studio.walls) {
    adjacency.get(w.a)?.push(w.b);
    adjacency.get(w.b)?.push(w.a);
  }
  const cycles: string[][] = [];
  const visited = new Set<string>();

  function findCycle(curr: string, start: string, path: string[]) {
    if (path.length >= 3 && curr === start) {
      cycles.push([...path]);
      return;
    }
    if (path.includes(curr)) return;
    const nextPath = [...path, curr];
    for (const neighbor of adjacency.get(curr) ?? []) {
      if (neighbor === start && path.length >= 3) {
        findCycle(neighbor, start, nextPath);
      } else if (!nextPath.includes(neighbor) && !visited.has(neighbor)) {
        findCycle(neighbor, start, nextPath);
      }
    }
  }

  for (const c of studio.corners) {
    if ((adjacency.get(c.id)?.length ?? 0) >= 2) {
      findCycle(c.id, c.id, []);
      visited.add(c.id);
    }
  }

  const rooms: DetectedRoom[] = [];
  const seenPolyKeys = new Set<string>();

  for (const cycle of cycles) {
    const key = [...cycle].sort().join(':');
    if (seenPolyKeys.has(key)) continue;
    seenPolyKeys.add(key);

    const pts = cycle.map(id => corner(studio, id)).filter((p): p is import('./studio').StudioCorner => p !== undefined);
    if (pts.length < 3) continue;

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
