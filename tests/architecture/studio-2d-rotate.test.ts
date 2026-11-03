import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createPlanRotation } from '../../src/presentation/editor/studio-2d-rotate';

function setup() {
  const c = { id: 1, name: 'Wardrobe', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() };
  const checkpoints: string[] = [];
  let blocked = false;
  const rotation = createPlanRotation({ cabinet: () => c, transform: () => ({ width: 800, height: 600, panX: 0, panZ: 0, zoom: 1 }),
    snapshot: () => JSON.stringify(c), checkpoint: s => checkpoints.push(s),
    previewRotation: (_id, angle) => { c.angle = angle; c.x = 2; return true; },
    restorePose: (_id, pose) => Object.assign(c, pose), settleCabinet: () => blocked ? 'Blocked' : null, refresh() {} });
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as Element;
  const event = (x: number, y: number, shift = false) => ({ clientX: x, clientY: y, shiftKey: shift,
    pointerId: 1, button: 0, target: { closest: () => true } }) as unknown as PointerEvent;
  return { c, rotation, checkpoints, svg, event, block: () => { blocked = true; } };
}
test('rotation previews make one undo step at finish, and cancel restores position and turn', () => {
  const { c, rotation, checkpoints, svg, event } = setup();
  rotation.down(event(400, 200), svg);
  rotation.move(event(300, 200), svg); assert.equal(c.angle, 45);
  rotation.move(event(300, 300), svg); assert.equal(c.angle, 90);
  assert.equal(checkpoints.length, 0); rotation.finish(); assert.equal(checkpoints.length, 1);
  c.x = 0;
  rotation.down(event(400, 200), svg); rotation.move(event(300, 300), svg); rotation.finish(true);
  assert.equal(c.angle, 90); assert.equal(c.x, 0); assert.equal(checkpoints.length, 1);
});
test('rotation quantizes to 5 degrees, snaps quarter turns, Shift is free and failed settling restores the start', () => {
  const { c, rotation, checkpoints, svg, event, block } = setup();
  const at = (a: number, shift = false) => event(400 - Math.sin(a * Math.PI / 180) * 100, 300 - Math.cos(a * Math.PI / 180) * 100, shift);
  rotation.down(event(400, 200), svg);
  rotation.move(at(32), svg); assert.equal(c.angle, 30);
  rotation.move(at(86), svg); assert.equal(c.angle, 90);
  rotation.move(at(32, true), svg); assert.ok(Math.abs(c.angle - 32) < .1);
  block(); rotation.finish(); assert.equal(c.angle, 0); assert.equal(c.x, 0); assert.equal(checkpoints.length, 0);
  rotation.quarterTurn(); assert.equal(c.angle, 0); assert.equal(checkpoints.length, 0);
});
