import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { viewedWall } from '../../src/domain/studio/viewed-wall';
import { wallLine } from '../../src/domain/studio/studio';

const room = rectangleStudio(200, 400);
for (const wall of room.walls) {
  test(`viewing ${wall.id} from inside or outside the room selects that wall`, () => {
    const line = wallLine(room, wall)!;
    const centre = { x: (line.a.x + line.b.x) / 2, z: (line.a.z + line.b.z) / 2 };
    for (const distance of [50, 2000]) {
      const origin = { x: centre.x + line.nx * distance, z: centre.z + line.nz * distance };
      assert.equal(viewedWall(room, origin, { x: -line.nx, z: -line.nz }), wall.id);
    }
  });
}
test('an oblique view uses the wall intersected by its ray, rather than the longest wall', () => {
  assert.equal(viewedWall(room, { x: 80, z: 100 }, { x: -.1, z: -1 }), 'w1');
  assert.equal(viewedWall(room, { x: 0, z: 100 }, { x: 1, z: -.1 }), 'w2');
});
test('panning beyond the room retains the faced wall; a vertical or empty view is safe', () => {
  assert.equal(viewedWall(room, { x: 2000, z: 100 }, { x: 0, z: -1 }), 'w1');
  assert.equal(viewedWall(room, { x: 0, z: 100 }, { x: 0, z: 0 }), undefined);
  assert.equal(viewedWall({ ...room, walls: [] }, { x: 0, z: 0 }, { x: 0, z: -1 }), undefined);
});
test('the view gives the point on the wall straight ahead, so a new piece stands in front of the viewer', async () => {
  const { viewedSpot } = await import('../../src/domain/studio/viewed-wall');
  const wall = room.walls[0]!, line = wallLine(room, wall)!;
  for (const along of [40, line.length / 2, line.length - 40]) {
    const at = { x: line.a.x + line.ux * along, z: line.a.z + line.uz * along };
    const spot = viewedSpot(room, { x: at.x + line.nx * 150, z: at.z + line.nz * 150 }, { x: -line.nx, z: -line.nz })!;
    assert.equal(spot.wall, wall.id);
    assert.ok(Math.abs(spot.along! - along) < 1e-6, `${spot.along} ≠ ${along}`);
  }
  assert.equal(viewedSpot(room, { x: 2000, z: 100 }, { x: 0, z: -1 })?.along, undefined, 'beyond the room: the faced wall, no point');
});
