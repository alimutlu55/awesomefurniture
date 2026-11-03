import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { wallLine } from '../../src/domain/studio/studio';
import { detectRooms, door2DPlan, removeStudioCorner, stepStudioWall, wall2DPlan, window2DPlan } from '../../src/domain/studio/studio-plan';

test('detectRooms calculates area and centroid for built-in bedroom', () => {
  const bedroom = createStudio('bedroom');
  const rooms = detectRooms(bedroom);
  assert.ok(rooms.length >= 1, 'detects at least one room cycle');
  const r = rooms[0]!;
  assert.equal(r.name, 'Room');
  // Room is 4.0 × 3.5 m room ~ 14.9 m2
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

test('stepStudioWall and removeStudioCorner modify room topology cleanly', () => {
  const bedroom = createStudio('bedroom');
  const w = bedroom.walls[0]!;
  const initialWallsCount = bedroom.walls.length;
  const initialCornersCount = bedroom.corners.length;

  const stepped = stepStudioWall(bedroom, w.id, 50, 0.5);
  assert.ok(stepped, 'stepping a wall succeeds');
  assert.ok(stepped.walls.length > initialWallsCount, 'adds wall segments for step and riser');
  assert.ok(stepped.corners.length > initialCornersCount, 'adds corners for step');

  // Removing a corner merges adjacent walls
  const addedCorner = stepped.corners[stepped.corners.length - 1]!;
  const merged = removeStudioCorner(stepped, addedCorner.id);
  assert.ok(merged, 'removing corner succeeds');
  assert.equal(merged.corners.length, stepped.corners.length - 1);
});

test('steps start at the chosen position, including outside the middle 20–80% of a wall', () => {
  const studio = createStudio('wall');
  const wall = studio.walls[0]!;
  const line = wallLine(studio, wall)!;
  for (const fraction of [0.1, 0.35, 0.9]) {
    const stepped = stepStudioWall(studio, wall.id, 50, fraction);
    assert.ok(stepped);
    const start = stepped.corners[studio.corners.length]!;
    assert.equal(start.x, Math.round(line.a.x + line.ux * line.length * fraction));
    assert.equal(start.z, Math.round(line.a.z + line.uz * line.length * fraction));
  }
});

test('steps reject positions too close to an endpoint instead of moving the chosen position', () => {
  const studio = createStudio('wall');
  const wall = studio.walls[0]!;
  for (const fraction of [0, 0.01, 0.99, 1, NaN, Infinity]) {
    assert.equal(stepStudioWall(studio, wall.id, 50, fraction), null);
  }
});
