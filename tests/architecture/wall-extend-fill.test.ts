import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addWall } from '../../src/domain/studio/studio-edit';
import { extendToFit } from '../../src/domain/studio/studio-extend';
import { wallLine } from '../../src/domain/studio/studio';

/** The + at a free wall end fills a gap shorter than the default wall instead of refusing. */
test('extending into a narrow gap joins the free end ahead', () => {
  let room: any = { template: 'custom', corners: [], walls: [], openings: [] };
  room = addWall(room, 0, 0, 0, 200);
  room = addWall(room, 0, 234, 0, 434);
  const end = room.corners.find((c: any) => c.z === 200)!;
  // Anything crossing the other wall is refused, as the editor's validation would.
  const fits = (next: any) => (wallLine(next, next.walls.at(-1)!)?.length ?? 0) <= 60;
  const next = extendToFit(room, end.id, fits)!;
  assert.equal(next.walls.length, 3);
  assert.equal(next.corners.length, 4);
  assert.equal(wallLine(next, next.walls.at(-1)!)!.length, 34);
});
