import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { addCeiling } from '../../src/domain/studio/studio-ceiling';
import { alignTo } from '../../src/domain/geometry/alignment';
import { depthTargets, heightTargets, liftTargets, openingTargets } from '../../src/presentation/editor/studio-align';

/** Openings and ceiling shapes line up with their neighbours while dragged, through the shared rule. */

test('an opening can share a centre, an edge, a sill or a top with another on its wall', () => {
  const room = createStudio('bedroom'), [a, b] = room.openings.filter((o, _, all) => all.some(x => x !== o && x.wall === o.wall));
  if (!a || !b) return;
  const { along, up } = openingTargets(room, a);
  assert.ok(along.some(t => Math.abs(t.v - b.offset) < .1), 'centre');
  assert.ok(along.some(t => Math.abs(t.v - (b.offset - b.width / 2 + a.width / 2)) < .1), 'left edge');
  assert.ok(up.some(t => Math.abs(t.v - b.sill) < .1), 'sill');
  assert.equal(alignTo(b.offset + 2, along, null, 5)?.v, Math.round(b.offset * 10) / 10);
  assert.equal(alignTo(b.offset + 20, along, null, 5)?.v === Math.round(b.offset * 10) / 10, false, 'out of reach');
});

test('a ceiling shape offers the depths and heights of the other shapes in the room', () => {
  let room = createStudio('bedroom');
  const wall = room.walls[0]!.id;
  room = addCeiling(room, wall, 'box')!;
  room = addCeiling(room, wall, 'box')!;
  const [first, second] = room.ceilings!;
  assert.ok(depthTargets(room, second!).some(t => Math.abs(t.v - first!.depth) < .1));
  assert.ok(heightTargets(room, second!).length > 0);
  assert.ok(liftTargets(second!, heightTargets(room, second!)).length > 0);
});
