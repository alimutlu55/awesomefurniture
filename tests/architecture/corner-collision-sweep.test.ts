import test from 'node:test';
import assert from 'node:assert/strict';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { cornerReturnJoints } from '../../src/domain/kitchen/corner-widths';
import { cornerJointFindings } from '../../src/domain/drawings/corner-joints';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorCabinet } from '../../src/application/projects/editor-scene';

const layout = (z = 100): EditorCabinet[] => [
  { id: 1, name: 'Blind', x: 0, z: 0, y: 0, angle: 0,
    state: { ...createEditorState(), ...createKitchenDesign('base', 'corner'), w: 102 } },
  { id: 2, name: 'Return', x: 22, z, y: 0, angle: 270,
    state: { ...createEditorState(), ...createKitchenDesign('base', 'cargo') } },
];

test('short and large pointer jumps stop at the same full corner allowance in either hand and at any room angle', () => {
  for (const frontThickness of [1.8, 1.9, 2.2]) for (const mirror of [-1, 1]) for (const turn of [0, 37, 90, 180, 270]) {
    const angle = turn * Math.PI / 180;
    const transform = (x: number, z: number) => ({ x: 123 + Math.cos(angle) * mirror * x + Math.sin(angle) * z,
      z: -87 - Math.sin(angle) * mirror * x + Math.cos(angle) * z });
    const boxes = layout().map(p => ({ ...p, ...transform(p.x, p.z), angle: mirror * p.angle + turn,
      state: { ...p.state, frontThickness } }));
    const before = structuredClone(boxes), moving = boxes[1]!, geometry = createCabinetGeometry(() => boxes);
    for (const target of [46.2, -100, -1000]) {
      const result = { ...moving, ...geometry.safeCabinetTranslation(moving, { ...transform(22, target), y: 0 }) };
      const joint = cornerReturnJoints(result, [boxes[0]!, result])[0]!;
      assert.ok(joint && Math.abs(joint.bodyGap - 4) < .001, `gap ${joint?.bodyGap}, turn ${turn}, hand ${mirror}`);
      assert.equal(geometry.cabinetCollides(result), false);
      assert.deepEqual(cornerJointFindings(placePieces({ pieces: [boxes[0]!, result].map(p => ({ ...p, design: p.state })) })), []);
    }
    assert.deepEqual(boxes, before, 'geometry checks never mutate the saved input');
  }
});

test('a lateral jump cannot pass through a corner even when its destination is clear', () => {
  for (const side of [-1, 1]) {
    const boxes = layout(46.2), moving = boxes[1]!;
    moving.x = side * 100;
    const geometry = createCabinetGeometry(() => boxes), target = { x: -side * 100, z: moving.z, y: 0 };
    assert.equal(geometry.cabinetCollides({ ...moving, ...target }), false, 'far destination alone is clear');
    const result = geometry.safeCabinetTranslation(moving, target);
    assert.ok(side * result.x > 51, 'the move must stop on its original side of the cabinet');
    assert.equal(geometry.cabinetCollides({ ...moving, ...result }), false, 'derived stock at the stopped pose is also checked');
  }
});

test('an existing bad corner can be moved out but cannot be pushed further through the other cabinet', () => {
  const boxes = layout(47), moving = boxes[1]!, geometry = createCabinetGeometry(() => boxes);
  assert.equal(geometry.cabinetCollides(moving), true);
  assert.equal(geometry.safeCabinetTranslation(moving, { x: 22, z: 46.5, y: 0 }).z, 47);
  const result = geometry.safeCabinetTranslation(moving, { x: 22, z: 48, y: 0 });
  assert.equal(result.z, 48);
  assert.equal(geometry.cabinetCollides({ ...moving, ...result }), false);
});

test('numeric positions and drag previews enforce the same corner stop; invalid direct drops are refused', () => {
  for (const preview of [false, true]) {
    const scene = { wardrobes: layout(), activeWardrobe: 2, nextWardrobeId: 3 }, messages: string[] = [];
    let checkpoints = 0;
    const commands = createSceneCommands(() => scene, { checkpoint: () => { checkpoints++; }, report: m => messages.push(m) });
    if (preview) commands.previewTranslation(2, { x: 22, y: 0, z: -100 });
    else assert.equal(commands.setCabinetPose('z', -100), true);
    assert.ok(Math.abs(scene.wardrobes[1]!.z - 48) < .001);
    assert.equal(commands.settleCabinet(2), null);
    assert.equal(checkpoints, preview ? 0 : 1);
    assert.deepEqual(messages, []);
    scene.wardrobes[1]!.z = 46.2;
    assert.match(commands.settleCabinet(2)!, /overlaps/);
  }
});

test('parallel and vertically separate runs retain free movement', () => {
  for (const change of [{ angle: 0, x: 200 }, { y: 200 }]) {
    const boxes = layout(), moving = boxes[1]!; Object.assign(moving, change);
    const geometry = createCabinetGeometry(() => boxes), target = { x: moving.x, y: moving.y, z: -100 };
    assert.deepEqual(geometry.safeCabinetTranslation(moving, target), target);
    assert.equal(geometry.cabinetCollides({ ...moving, ...target }), false);
  }
});

test('a vertical jump cannot pass through the corner strip when both endpoint heights are clear', () => {
  const boxes = layout(46.2), moving = boxes[1]!; moving.y = 200;
  const geometry = createCabinetGeometry(() => boxes);
  const result = geometry.safeCabinetTranslation(moving, { x: moving.x, z: moving.z, y: -200 });
  assert.ok(result.y > 80, 'the strip must stop the descending cabinet near the top, before it can pass through');
  assert.equal(geometry.cabinetCollides({ ...moving, ...result }), false);
});

test('an open L keeps both configured strips instead of sliding one leg through their joint square', () => {
  for (const cornerStrip of [4, 5.3]) {
    const boxes = layout(200), moving = boxes[1]!;
    boxes[0]!.state.w = 60; boxes[0]!.state.cornerStrip = cornerStrip;
    moving.state.w = 60; moving.state.cornerStrip = cornerStrip; moving.x = 60.8 + cornerStrip;
    const geometry = createCabinetGeometry(() => boxes);
    const result = { ...moving, ...geometry.safeCabinetTranslation(moving, { x: moving.x, y: 0, z: -100 }) };
    assert.ok(Math.abs(result.z - 60.8 - cornerStrip) < .001);
    assert.equal(geometry.cabinetCollides(result), false);
    for (const joint of cornerReturnJoints(result, [boxes[0]!, result]))
      assert.ok(Math.abs(joint.bodyGap - joint.requiredGap) < .001);
  }
});
