import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Studio } from '../../src/domain/studio/studio';
import { detectRooms } from '../../src/domain/studio/studio-plan';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { renderRooms } from '../../src/presentation/editor/studio-2d-canvas';

/** Screenshot reproduction: a small room partitioned off the top-right of a larger room.
 * Coordinates are centimetres on wall centre lines, matching the existing area convention. */
function partitionedRoom(): Studio {
  const positions = [[0, 0], [457.1, 0], [632.7, 0], [632.7, 166], [632.7, 370.4], [0, 370.4], [457.1, 166]];
  const corners = positions.map(([x, z], i) => ({ id: `c${i}`, x: x!, z: z! }));
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [6, 3]];
  return { template: 'custom', corners, openings: [], walls: edges.map(([a, b], i) => ({
    id: `w${i}`, a: `c${a}`, b: `c${b}`, height: 260, thickness: 12,
  })) };
}

test('screenshot regression: two enclosed rooms, without a third room for their combined perimeter', () => {
  const room = partitionedRoom(), before = JSON.stringify(room), detected = detectRooms(room);
  assert.deepEqual(detected.map(r => r.areaM2).sort((a, b) => a - b), [2.9, 20.5]);
  assert.equal((renderRooms(room).match(/sp2d-room-fill/g) ?? []).length, 2, 'one floor fill per enclosed room');
  assert.equal(JSON.stringify(room), before, 'room detection is read-only');
});

test('room detection is independent of wall directions and input order', () => {
  const room = partitionedRoom();
  const reversed = { ...room, corners: [...room.corners].reverse(), walls: [...room.walls].reverse()
    .map((w, i) => i % 2 ? { ...w, a: w.b, b: w.a } : w) };
  assert.deepEqual(detectRooms(reversed).map(r => r.areaM2).sort((a, b) => a - b), [2.9, 20.5]);
});

test('an open partition and disconnected walls do not create extra rooms', () => {
  const room = partitionedRoom();
  assert.equal(detectRooms({ ...room, walls: room.walls.filter(w => w.id !== 'w7') }).length, 1);
  assert.deepEqual(detectRooms({ ...room, walls: room.walls.slice(0, 5) }), []);
});

test('simple rectangles, triangles and disconnected enclosed rooms each appear once', () => {
  const room = rectangleStudio(400, 350), other = rectangleStudio(200, 200);
  assert.equal(detectRooms(room).length, 1);
  const together: Studio = { ...room,
    corners: [...room.corners, ...other.corners.map(c => ({ ...c, id: `other-${c.id}`, x: c.x + 1000 }))],
    walls: [...room.walls, ...other.walls.map(w => ({ ...w, id: `other-${w.id}`, a: `other-${w.a}`, b: `other-${w.b}` }))],
  };
  assert.equal(detectRooms(together).length, 2);
  const triangle: Studio = { template: 'custom', openings: [],
    corners: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 400, z: 0 }, { id: 'c', x: 0, z: 300 }],
    walls: [['a', 'b'], ['b', 'c'], ['c', 'a']].map(([a, b], i) => ({ id: `w${i}`, a: a!, b: b!, height: 260, thickness: 12 })),
  };
  assert.deepEqual(detectRooms(triangle).map(r => r.areaM2), [6]);
});

test('a sloped partition produces two triangular rooms instead of a third outer rectangle', () => {
  const room = rectangleStudio(400, 300);
  const partition = { ...room.walls[0]!, id: 'diagonal', a: room.corners[0]!.id, b: room.corners[2]!.id };
  const rooms = detectRooms({ ...room, walls: [...room.walls, partition] });
  assert.equal(rooms.length, 2);
  assert.ok(rooms.every(r => r.polygon.length === 3));
  assert.equal(rooms[0]!.areaM2, rooms[1]!.areaM2);
});

test('many shared partitions return only individual cells, without enumerating composite room loops', () => {
  const count = 6, corners = [], walls = [];
  for (let z = 0; z <= count; z++) for (let x = 0; x <= count; x++) {
    const id = `${x},${z}`;
    corners.push({ id, x: x * 300, z: z * 300 });
    for (const [nx, nz] of [[x + 1, z], [x, z + 1]] as const) {
      if (nx > count || nz > count) continue;
      walls.push({ id: `w${walls.length}`, a: id, b: `${nx},${nz}`, height: 260, thickness: 12 });
    }
  }
  const rooms = detectRooms({ template: 'custom', corners, walls, openings: [] });
  assert.equal(rooms.length, count * count);
  assert.ok(rooms.every(r => r.areaM2 === 9));
  assert.equal(new Set(rooms.map(r => `${r.centroid.x},${r.centroid.z}`)).size, count * count);
});
