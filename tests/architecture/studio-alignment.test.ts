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

test('a wall moved lines its faces up with the faces of the other parallel walls', async () => {
  const { wallTargets } = await import('../../src/presentation/editor/studio-drag');
  const { wallLine } = await import('../../src/domain/studio/studio');
  const room = createStudio('bedroom');
  let checked = 0;
  for (const w of room.walls) {
    const line = wallLine(room, w)!, targets = wallTargets(room, w);
    for (const o of room.walls) {
      const ol = wallLine(room, o)!;
      if (o.id === w.id || Math.abs(ol.ux * line.uz - ol.uz * line.ux) > 1e-3) continue;
      const p = (ol.a.x - line.a.x) * line.nx + (ol.a.z - line.a.z) * line.nz;
      if (Math.abs(p) < .05) continue;
      assert.ok(targets.some(t => t.label === 'Flush with wall' && Math.abs(t.v - (p + (o.thickness - w.thickness) / 2)) < 1e-6 || Math.abs(t.v - (p - (o.thickness - w.thickness) / 2)) < 1e-6), `${w.id} lines up with ${o.id}`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'the bedroom has parallel walls');
});
