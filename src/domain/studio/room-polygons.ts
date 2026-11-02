import type { Studio, StudioCorner } from './studio';

interface DirectedWall {
  readonly from: StudioCorner;
  readonly to: StudioCorner;
  readonly reverse: number;
}

/** Walk the faces of the planar wall graph rather than enumerating all possible cycles.
 * Each wall has two directed sides. At a junction, the next clockwise side from the
 * incoming wall keeps the same face on the left. Positive winding encloses a room;
 * negative winding is the unbounded exterior and must never get an area label.
 * Directions of stored walls and the order of input corners do not affect the result. */
export function boundedRoomPolygons(studio: Studio): StudioCorner[][] {
  const corners = new Map(studio.corners.map(c => [c.id, c]));
  const sides: DirectedWall[] = [], outgoing = new Map<string, number[]>(), connections = new Set<string>();
  for (const w of studio.walls) {
    const a = corners.get(w.a), b = corners.get(w.b);
    if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) < 1e-6) continue;
    const key = JSON.stringify([w.a, w.b].sort());
    if (connections.has(key)) continue;
    connections.add(key);
    const i = sides.length;
    sides.push({ from: a, to: b, reverse: i + 1 }, { from: b, to: a, reverse: i });
    for (const index of [i, i + 1]) {
      const from = sides[index]!.from.id, list = outgoing.get(from) ?? [];
      list.push(index); outgoing.set(from, list);
    }
  }
  const angle = (index: number) => {
    const { from, to } = sides[index]!;
    return Math.atan2(to.z - from.z, to.x - from.x);
  };
  const positions = new Map<number, number>();
  for (const list of outgoing.values()) {
    list.sort((a, b) => angle(a) - angle(b));
    list.forEach((side, index) => positions.set(side, index));
  }

  const visited = new Set<number>(), polygons: StudioCorner[][] = [];
  sides.forEach((_, start) => {
    if (visited.has(start)) return;
    const points: StudioCorner[] = [];
    let current = start;
    do {
      if (visited.has(current)) return;
      visited.add(current);
      const side = sides[current]!, list = outgoing.get(side.to.id)!;
      points.push(side.from);
      current = list[(positions.get(side.reverse)! - 1 + list.length) % list.length]!;
    } while (current !== start);
    let twiceArea = 0;
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length]!;
      twiceArea += p.x * q.z - q.x * p.z;
    });
    // Bridges can be visited in both directions in the same face; their areas cancel.
    if (points.length >= 3 && twiceArea > 1e-6) polygons.push(points);
  });
  return polygons;
}
