import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_TEMPLATES, createStudio } from '../../src/domain/studio/studio-templates';
import { roomHeight, wallFace, type Studio } from '../../src/domain/studio/studio';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { moveWall, removeWall, splitWall } from '../../src/domain/studio/studio-edit';
import {
  CEILING_SHAPES, addCeiling, ceilingAt, flipCeiling, moveCeilingPoint, profileAt, reachAt, removeCeiling, setCeilingDepth,
} from '../../src/domain/studio/studio-ceiling';
import { ceilingTop, sectionsUnder } from '../../src/domain/studio/studio-fit';
import { wallSpot } from '../../src/domain/studio/studio-placement';
import { maxHeight, shapeProblems } from '../../src/domain/wardrobe/shape/wardrobe-shape';

/** Ceilings that come down into a room (stairs, landings, sloped roofs, boxes), and wardrobes fitted under
 * them. Ceiling shapes are a registry (CEILING_SHAPES): these tests walk every entry on every wall. */

const ceiling = (s: Studio) => s.ceilings!.at(-1)!;

for (const shape of CEILING_SHAPES) {
  test(`ceiling shape · ${shape.id}: valid on every wall of every built-in room, and lower than the room`, () => {
    assert.ok(shape.name.length > 2 && shape.description.length > 10, 'has a name and a description for the choices');
    assert.match(shape.id, /^[a-z-]+$/, 'id is saved in projects');
    for (const t of STUDIO_TEMPLATES) {
      const room = createStudio(t.id);
      for (const w of room.walls) {
        const next = addCeiling(room, w.id, shape.id);
        if (wallFace(room, room.walls.find(x => x.id === w.id)!)!.length < 60) continue;
        assert.ok(next, `${t.id}/${w.id}: added`);
        assert.deepEqual(studioProblems(next), [], `${t.id}/${w.id}: buildable`);
        assert.equal(next.template, 'custom');
        assert.ok(Math.min(...ceiling(next).profile.map(p => p.y)) < roomHeight(next), `${t.id}/${w.id}: comes down`);
      }
    }
  });
}

test('the under-stairs room is the photographed space: full height at the door, a landing, a flight down to 105 cm', () => {
  const room = createStudio('under-stairs');
  assert.deepEqual(studioProblems(room), []);
  assert.equal(ceilingAt(room, { x: -150, z: 50 }), 260, 'by the door');
  assert.equal(ceilingAt(room, { x: -50, z: 50 }), 205, 'under the landing');
  assert.equal(ceilingAt(room, { x: 180, z: 50 }), 105, 'at the far end');
  const mid = ceilingAt(room, { x: 60, z: 50 });
  assert.ok(mid > 105 && mid < 205, 'under the flight: between the two');
});

test('a profile is read with slopes between points and the lower side at a step', () => {
  const ps = [{ t: 0, y: 200 }, { t: 100, y: 100 }, { t: 100, y: 60 }, { t: 150, y: 60 }];
  assert.equal(profileAt(ps, 50), 150);
  assert.equal(profileAt(ps, 100), 60, 'at the step, the lower side');
  assert.equal(profileAt(ps, 200), null, 'outside it');
});

test('points move in order, a meeting point makes a step, and every edit keeps the room valid or says why', () => {
  const room = addCeiling(createStudio('bedroom'), 'w1', 'landing')!, id = ceiling(room).id, ps = ceiling(room).profile;
  const past = moveCeilingPoint(room, id, 1, ps[3]!.t + 50, ps[1]!.y)!;
  assert.equal(ceiling(past).profile[1]!.t, ps[2]!.t, 'stops at its neighbour');
  assert.deepEqual(studioProblems(past), [], 'meeting the neighbour is a step');
  assert.match(studioProblems(moveCeilingPoint(room, id, 0, ps[0]!.t, 20)!)[0]!, /at least 40 cm/);
  assert.match(studioProblems(moveCeilingPoint(room, id, 0, ps[0]!.t, 300)!)[0]!, /higher than the room/);
  assert.equal(ceiling(setCeilingDepth(room, id, 80)!).depth, 80);
  const flipped = ceiling(flipCeiling(room, id)!).profile;
  assert.deepEqual(flipped.map(p => p.y), [...ps].reverse().map(p => p.y), 'the stair rises the other way');
  assert.equal(flipped[0]!.t, ps[0]!.t, 'over the same stretch of wall');
  assert.equal(removeCeiling(room, id)!.ceilings!.length, 0);
  const slope = addCeiling(createStudio('bedroom'), 'w1', 'slope')!, deeper = ceiling(setCeilingDepth(slope, ceiling(slope).id, 200)!);
  assert.equal(deeper.profile.at(-1)!.t, 200, 'a sloped roof stretches to its new depth');
  assert.equal(flipCeiling(slope, ceiling(slope).id), null, 'a sloped roof always slopes down to its own wall');
});

test('ceilings stay where they are in the room while walls move, split or go', () => {
  const room = addCeiling(createStudio('bedroom'), 'w1', 'box')!, box = ceiling(room);
  // Moving the side wall in shortens the box's wall; the box keeps its place in the room.
  const moved = moveWall(room, 'w2', 30)!;
  assert.deepEqual(ceiling(moved).profile, box.profile, 'still over the same stretch');
  assert.deepEqual(studioProblems(moved), []);
  const split = splitWall(room, 'w1', 100)!;
  assert.notEqual(ceiling(split).wall, 'w1', 'goes with the part it is over: the second, past 100 cm');
  assert.deepEqual(studioProblems(split), []);
  assert.equal(removeWall(room, 'w1')!.ceilings!.length, 0, 'goes with its wall');
  assert.equal('ceilings' in moveWall(createStudio('bedroom'), 'w2', 30)!, false, 'a room without ceilings gets no list');
});

test('how far the room reaches in front of a wall, for depths that span the room', () => {
  const room = createStudio('bedroom');
  assert.equal(Math.round(reachAt(room, 'w1', 200)!), 350, 'to the opposite wall');
  assert.equal(reachAt(createStudio('wall'), 'w1', 200), null, 'nothing opposite');
});

test('a wardrobe under a ceiling takes its shape: stepped, sloped, and filled up to the ceiling elsewhere', () => {
  const room = createStudio('under-stairs');
  const full = ceilingTop(room, { x: 0, z: 30, angle: 0, w: 380, d: 60 });
  assert.ok(full && 'shape' in full);
  assert.equal(full.shape.template, 'room');
  assert.deepEqual(shapeProblems(full.shape, 380), [], 'buildable');
  assert.equal(maxHeight(full.shape), 260, 'fills to the ceiling by the door');
  assert.equal(Math.min(...full.shape.top.map(p => p.y)), 105, 'and down to the soffit at the far end');
  assert.ok(full.shape.top.some((p, k, all) => k > 0 && all[k - 1]!.x === p.x), 'a step under the landing');
  // Every position along the wall gives a buildable top that stays under the ceiling.
  for (let x = -140; x <= 140; x += 20) {
    const fit = ceilingTop(room, { x, z: 30, angle: 0, w: 100, d: 60 });
    assert.ok(fit && 'shape' in fit, 'at ' + x);
    assert.deepEqual(shapeProblems(fit.shape, 100), [], 'buildable at ' + x);
    for (let s = 1; s < 100; s += 3) {
      const top = fit.shape.top, k = top.findIndex((p, i) => i > 0 && p.x >= s), a = top[k - 1]!, b = top[k]!;
      const y = b.x - a.x < 1e-6 ? Math.max(a.y, b.y) : a.y + (b.y - a.y) * (s - a.x) / (b.x - a.x);
      assert.ok(y <= ceilingAt(room, { x: x - 50 + s, z: 30 }) + .6, `under the ceiling at ${x - 50 + s}`);
    }
  }
  assert.equal(ceilingTop(createStudio('bedroom'), { x: 0, z: 30, angle: 0, w: 200, d: 60 }), null, 'no ceiling comes down: unchanged');
  const low = moveCeilingPoint(room, 'k1', 3, 386, 41)!;
  const tooLow = ceilingTop(moveCeilingPoint(low, 'k1', 2, 326, 41)!, { x: 165, z: 30, angle: 0, y: 10, w: 40, d: 60 });
  assert.ok(tooLow && 'problem' in tooLow, 'too low for a wardrobe hung 10 cm up: says so');
});

test('a wardrobe filling the wall under the stairs is divided where the ceiling steps and bends', () => {
  const fit = ceilingTop(createStudio('under-stairs'), { x: 0, z: 30, angle: 0, w: 380, d: 60 })!;
  assert.ok('shape' in fit);
  const { n, wt } = sectionsUnder(fit.shape, 380, 6);
  assert.equal(n, 4, 'a tall column, under the landing, under the flight, the low end');
  assert.equal(wt.length, 6);
});

test('a wall\'s free stretch for a new wardrobe: clear of doors and the wardrobes already there', () => {
  const room = createStudio('walk-in');
  const empty = wallSpot(room, 'w1', [], { min: 80, max: 400, depth: 60 })!;
  assert.equal(empty.w, 220, 'the whole inside of the wall');
  assert.equal(empty.pose.angle, 0);
  assert.equal(empty.pose.z, 30, 'flush against it');
  const beside = wallSpot(room, 'w1', [{ x: -60, z: 30, angle: 0, w: 100, d: 60 }], { min: 80, max: 400, depth: 60 })!;
  assert.equal(beside.w, 120, 'the rest of the wall');
  assert.equal(wallSpot(room, 'w1', [{ x: 0, z: 30, angle: 0, w: 200, d: 60 }], { min: 80, max: 400, depth: 60 }), null, 'no room left');
  assert.equal(wallSpot(room, 'w3', [], { min: 80, max: 400, depth: 60 }), null, 'a door in the middle leaves no stretch of 80 cm');
  const bedroom = createStudio('bedroom'), side = wallSpot(bedroom, 'w2', [], { min: 80, max: 400, depth: 60 })!;
  assert.ok(side.w < 350 - 80 && side.w >= 80, 'stops short of the door and its casing: ' + side.w);
  assert.equal(wallSpot(createStudio('under-stairs'), 'w1', [], { min: 80, max: 400, depth: 60 })!.w, 380);
});
