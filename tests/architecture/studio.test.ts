import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_TEMPLATES, createStudio } from '../../src/domain/studio/studio-templates';
import { STUDIO_DEFAULTS, studioBounds, wallBox, wallLine, type Studio } from '../../src/domain/studio/studio';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import {
  addOpening, addWall, extendFromCorner, moveCorner, moveOpening, moveWall, removeOpening, removeWall,
  setWallLength, setWallSize, splitWall, translateStudio,
} from '../../src/domain/studio/studio-edit';

/** Built-in studios are added with one entry in studio-templates.ts. These tests walk every entry. */

const interior = (studio: Studio) => {
  // A point surely inside the room: just in front of the middle of the first wall (the wardrobe wall).
  const line = wallLine(studio, studio.walls.find(w => wallLine(studio, w)!.ux > .99 && Math.abs(wallLine(studio, w)!.a.z + STUDIO_DEFAULTS.thickness / 2) < .01)!)!;
  return { x: (line.a.x + line.b.x) / 2 + line.nx * 20, z: (line.a.z + line.b.z) / 2 + line.nz * 20 };
};
const side = (studio: Studio, id: string, p: { x: number; z: number }) => {
  const line = wallLine(studio, studio.walls.find(w => w.id === id)!)!;
  return (p.x - line.a.x) * line.nx + (p.z - line.a.z) * line.nz;
};

for (const t of STUDIO_TEMPLATES) {
  test(`built-in studio · ${t.id}: valid, with the room in front of every wall`, () => {
    const studio = createStudio(t.id);
    assert.deepEqual(studioProblems(studio), [], 'no problems');
    assert.equal(studio.template, t.id);
    assert.ok(t.name.length > 1 && t.description.length > 5, 'has a name and description for the picker');
    assert.match(t.id, /^[a-z-]+$/, 'id is saved in projects');
    // The wardrobe wall runs left to right with its room side at z = 0.
    const box = wallBox(studio, studio.walls.find(w => side(studio, w.id, { x: 0, z: 30 }) > 0 && Math.abs(wallLine(studio, w)!.nz - 1) < 1e-9)!)!;
    assert.equal(box.angle, 0, 'a wardrobe at angle 0 stands parallel to the wardrobe wall');
    assert.ok(Math.abs(box.z + box.thickness / 2) < 1e-9, 'the wall surface is at z = 0, where a wardrobe at the origin puts its back');
    const inside = interior(studio);
    const closed = studio.walls.every(w => studio.walls.filter(x => x.a === w.b || x.b === w.b).length > 1);
    for (const w of studio.walls) if (closed) assert.ok(side(studio, w.id, inside) > 0, `${w.id}: room is in front of it`);
    const fresh = createStudio(t.id);
    assert.notEqual(fresh.corners, studio.corners, 'each placement gets its own copy');
  });
}

test('every new id is unique and the room bounds include the wall thickness', () => {
  const studio = createStudio('bedroom'), b = studioBounds(studio)!;
  assert.deepEqual([b.x0, b.x1], [-212, 212]);
  assert.deepEqual([b.z0, b.z1], [-12, 362]);
  assert.equal(b.height, STUDIO_DEFAULTS.height);
  const more = addWall(studio, 0, 100, 100, 100);
  assert.equal(new Set(more.corners.map(c => c.id)).size, more.corners.length);
  assert.equal(new Set(more.walls.map(w => w.id)).size, more.walls.length);
});

test('moving a corner stretches both walls that meet there and keeps the room closed', () => {
  const studio = createStudio('walk-in');
  const next = moveCorner(studio, 'c2', 150, -6)!;
  assert.equal(next.template, 'custom', 'an edited room is custom');
  assert.equal(Math.round(wallLine(next, next.walls[0]!)!.length), 266, 'the back wall got longer (from x = -116 to 150)');
  assert.equal(wallLine(next, next.walls[1]!)!.a.x, 150, 'the side wall moved with the corner');
  assert.deepEqual(studioProblems(next), []);
});

test('moving a wall keeps its direction; the walls joined to it stretch', () => {
  const studio = createStudio('walk-in');
  const deeper = moveWall(studio, 'w3', -60)!;                        // the front wall, away from the room
  assert.equal(Math.round(wallLine(deeper, deeper.walls[1]!)!.length), 312);
  assert.equal(wallLine(deeper, deeper.walls[2]!)!.nz, -1, 'still faces the room');
  assert.deepEqual(studioProblems(deeper), []);
  assert.equal(deeper.openings[0]!.offset, studio.openings[0]!.offset, 'the door stays where it was along its wall');
});

test('lengths, thickness and height edits, with reasons when they are out of range', () => {
  const studio = createStudio('wall');
  assert.equal(Math.round(wallLine(setWallLength(studio, 'w1', 300)!, setWallLength(studio, 'w1', 300)!.walls[0]!)!.length), 300);
  const fromEnd = setWallLength(studio, 'w1', 300, true)!;
  assert.equal(wallLine(fromEnd, fromEnd.walls[0]!)!.b.x, 200, 'the far end stays put');
  assert.match(studioProblems(setWallLength(studio, 'w1', 10)!).join(), /at least 30 cm/);
  assert.match(studioProblems(setWallSize(studio, 'w1', { height: 90 })!).join(), /height must be/);
  assert.match(studioProblems(setWallSize(studio, 'w1', { thickness: 80 })!).join(), /thickness must be/);
});

test('walls cannot cross, and joined walls cannot fold back onto each other', () => {
  const studio = createStudio('walk-in');
  assert.match(studioProblems(moveCorner(studio, 'c2', -200, 100)!).join(), /cannot cross/, 'pulling a corner through the room');
  assert.match(studioProblems(moveCorner(studio, 'c2', -116, 100)!).join(), /cannot cross/, 'folding the back wall onto the side wall');
});

test('split, extend and remove walls; openings follow the part of the wall they are on', () => {
  const bedroom = createStudio('bedroom');
  const split = splitWall(bedroom, 'w2', 200)!;
  assert.equal(split.walls.length, 5);
  const door = split.openings.find(o => o.kind === 'door')!;
  assert.equal(door.wall, 'w5', 'the door (at 290 cm) is now on the second part');
  assert.equal(door.offset, 90);
  assert.deepEqual(studioProblems(split), []);
  const wall = createStudio('wall');
  const extended = extendFromCorner(wall, 'c2', 200, 250)!;
  const added = extended.walls.at(-1)!;
  assert.equal(added.a, 'c2', 'continues the chain from its end');
  assert.ok(side(extended, added.id, { x: 0, z: 100 }) > 0, 'the new wall faces the same room');
  const removed = removeWall(bedroom, 'w4')!;
  assert.equal(removed.walls.length, 3);
  assert.ok(!removed.openings.some(o => o.wall === 'w4'), 'its window went with it');
  assert.equal(removeWall(createStudio('wall'), 'w1')!.corners.length, 0, 'corners left unattached are removed');
});

test('openings: added where there is room, kept on the wall, never overlapping', () => {
  const studio = createStudio('wall');
  const one = addOpening(studio, 'w1', 'door')!;
  assert.equal(one.openings[0]!.offset, 200, 'in the middle of a free wall');
  const two = addOpening(one, 'w1', 'window')!;
  assert.deepEqual(studioProblems(two), [], 'placed beside the door');
  assert.ok(Math.abs(two.openings[1]!.offset - 200) >= (80 + 120) / 2 + 5);
  assert.equal(moveOpening(one, 'o1', 1000)!.openings[0]!.offset, 400 - 45, 'kept on the wall');
  assert.match(studioProblems(moveOpening(two, 'o2', 200)!).join() || studioProblems({ ...two, openings: [two.openings[0]!, { ...two.openings[1]!, offset: 210 }] }).join(), /cannot overlap/);
  assert.equal(addOpening(setWallLength(studio, 'w1', 60)!, 'w1', 'door'), null, 'no room on a short wall');
  assert.equal(removeOpening(one, 'o1')!.openings.length, 0);
});

test('moving the whole room keeps it a built-in', () => {
  const moved = translateStudio(createStudio('corner'), 50, -20);
  assert.equal(moved.template, 'corner');
  assert.equal(moved.corners[1]!.x, -176 + 50);
});

test('moving a wall leaves doors and windows where they are in the room', () => {
  const studio = createStudio('bedroom');
  const at = (s: Studio, id: string) => { const o = s.openings.find(x => x.id === id)!, line = wallLine(s, s.walls.find(w => w.id === o.wall)!)!; return [line.a.x + line.ux * o.offset, line.a.z + line.uz * o.offset]; };
  const moved = moveWall(studio, 'w1', 40)!;                           // the back wall: the right wall gets shorter from its start
  assert.deepEqual(studioProblems(moved), []);
  assert.deepEqual(at(moved, 'o1'), at(studio, 'o1'), 'the door did not move');
  const short = moveWall(studio, 'w1', 250)!;                          // a 112 cm wall: the door slides just far enough to stay on it
  assert.equal(short.openings[0]!.offset, 45, '40 cm along would put its edge off the wall; 45 keeps the 5 cm margin');
  assert.deepEqual(studioProblems(short), ['This window is wider than its wall. Make it narrower or the wall longer.'], 'the door fits; the 120 cm window on the opposite 112 cm wall does not');
  assert.match(studioProblems(moveWall(studio, 'w1', 280)!).join(), /wider than its wall/, 'an 82 cm wall cannot hold the 80 cm door');
});
