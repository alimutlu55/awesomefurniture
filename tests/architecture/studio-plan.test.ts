import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { detectRooms, door2DPlan, wall2DPlan, window2DPlan } from '../../src/domain/studio/studio-plan';

test('detectRooms calculates area and centroid for built-in bedroom', () => {
  const bedroom = createStudio('bedroom');
  const rooms = detectRooms(bedroom);
  assert.ok(rooms.length >= 1, 'detects at least one room cycle');
  const r = rooms[0]!;
  assert.equal(r.name, 'Bedroom');
  // Bedroom is 4.0 × 3.5 m room ~ 14.9 m2
  assert.ok(r.areaM2 >= 13 && r.areaM2 <= 16, `area should be ~14-15 m2, was ${r.areaM2}`);
  assert.ok(Number.isFinite(r.centroid.x));
  assert.ok(Number.isFinite(r.centroid.z));
});

test('wall2DPlan produces valid solid polygon for a wall', () => {
  const bedroom = createStudio('bedroom');
  const w = bedroom.walls[0]!;
  const plan = wall2DPlan(bedroom, w);
  assert.ok(plan);
  assert.equal(plan.solid.length, 4);
  assert.equal(plan.id, w.id);
  assert.ok(plan.faceLength > 0);
});

test('door2DPlan and window2DPlan generate accurate geometry', () => {
  const bedroom = createStudio('bedroom');
  const door = bedroom.openings.find(o => o.kind === 'door');
  const win = bedroom.openings.find(o => o.kind === 'window');
  if (door) {
    const dp = door2DPlan(bedroom, door);
    assert.ok(dp);
    assert.equal(dp.width, door.width);
    assert.ok(Number.isFinite(dp.hingePoint.x));
  }
  if (win) {
    const wp = window2DPlan(bedroom, win);
    assert.ok(wp);
    assert.equal(wp.width, win.width);
    assert.ok(Number.isFinite(wp.glassFrom.x));
  }
});
