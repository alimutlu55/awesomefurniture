import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createEditorState } from '../../src/application/projects/editor-state';
import { planInstallationLayout } from '../../src/domain/kitchen/installation-layout';
import { automaticInstallationParts } from '../../src/domain/kitchen/automatic-installation';
import { reconcileInstallation } from '../../src/application/projects/installation-reconciliation';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { createEditorModel } from '../../src/application/projects/editor-model';
import type { EditorScene } from '../../src/application/projects/editor-scene';

const unit = (id: number, x: number, z = 0, angle = 0, preset = 'base') => ({ id, name: 'Unit ' + id, x, y: 0, z, angle,
  state: { ...createEditorState(), ...createKitchenDesign('base', preset) } });
// Repositioning is tested only as an explicitly requested domain planning operation.
const reposition = (boxes: ReturnType<typeof unit>[], obstacles: Parameters<typeof planInstallationLayout>[1] = []) => planInstallationLayout(boxes, obstacles, true);
const sceneOf = (wardrobes: ReturnType<typeof unit>[]): EditorScene => ({ wardrobes, activeWardrobe: 2, nextWardrobeId: 10 });
const corner = () => {
  const a = unit(1, 0, 0, 0, 'corner'); a.state.w = 102;
  return [a, unit(2, 22, 46.5, 270, 'cargo'), unit(3, 22, 91.5, 270)];
};
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} should be ${expected}`);

test('full strips reserve adjoining finished fronts, moving the complete return run at arbitrary rotations', () => {
  for (const angle of [0, 17, 90, 180, 270]) {
    const rad = angle * Math.PI / 180;
    const input = corner().map(p => ({ ...p, x: p.x * Math.cos(rad) + p.z * Math.sin(rad), z: -p.x * Math.sin(rad) + p.z * Math.cos(rad), angle: p.angle + angle }));
    const before = structuredClone(input), plan = reposition(input);
    assert.equal(plan.valid, true);
    const a = plan.boxes[1]!, b = plan.boxes[2]!;
    near(Math.hypot(a.x - before[1]!.x, a.z - before[1]!.z), 3.3);
    near(b.x - a.x, before[2]!.x - before[1]!.x); near(b.z - a.z, before[2]!.z - before[1]!.z);
    assert.deepEqual(input, before, 'planner is detached');
    assert.deepEqual(plan.boxes.map(p => p.state), before.map(p => p.state), 'module widths and construction stay intact');
    assert.deepEqual(reposition(plan.boxes).boxes, plan.boxes, 'idempotent');
    const check = validateForManufacture({ pieces: plan.boxes.map(p => ({ ...p, design: p.state })) });
    assert.equal(check.findings.some(f => f.id.startsWith('clash:')), false, JSON.stringify(check.findings));
  }
});

test('custom strip and front thickness are exact, and a supported sink follows the shifted run', () => {
  const boxes = corner(); boxes[1]!.state.cornerStrip = 5; boxes[0]!.state.frontThickness = 2.2;
  const sink = { ...unit(4, 22, 91.5, 270), state: { ...createEditorState(), ...createKitchenDesign('sink-top') }, y: 90 };
  const plan = reposition([...boxes, sink]);
  near(plan.boxes[1]!.z - boxes[1]!.z, 4.7);
  near(plan.boxes[3]!.z - sink.z, 4.7);
  near(plan.boxes[3]!.y, sink.y);
});

test('facing 18 mm panes become one physical 18 mm board, including drawing stock', () => {
  for (const gap of [1.8, 2, 3.6]) {
    const input = [unit(1, 0), unit(2, 60 + gap), unit(3, 120 + gap)];
    const plan = reposition(input), boxes = plan.boxes;
    near(boxes[1]!.x, 60 + (gap === 3.6 ? 1.8 : gap));
    near(boxes[2]!.x - boxes[1]!.x, 60);
    const parts = automaticInstallationParts(boxes);
    assert.equal(parts.length, 3, 'two outside ends and one shared separator');
    assert.equal(parts.filter(p => p.x > 30 && p.x < 33).length, 1);
    assert.equal(createCabinetGeometry(() => boxes).cabinetCollides(boxes[0]!), false);
    const pieces = placePieces({ pieces: boxes.map(p => ({ ...p, design: p.state })) });
    assert.equal(pieces.filter(p => p.id < 0).flatMap(p => pieceBoards(p, pieces)).length, 3, 'one cut board per actual pane');
    assert.deepEqual(reposition(boxes).boxes, boxes);
  }
});

test('a 1 mm intentional joint beside a shared pane remains adjustable without jumping', () => {
  const boxes = [unit(1, 0), unit(2, 61.9)];
  const collision = createCabinetGeometry(() => boxes);
  const target = collision.safeCabinetTranslation(boxes[1]!, { x: 61.8, y: 0, z: 0 });
  near(target.x, 61.8);
  near(reposition(boxes).boxes[1]!.x, 61.9);
});

test('coincident explicit separator stock merges to 18 mm without moving the adjoining run', () => {
  const left = unit(1, 0), right = unit(4, 61.8), next = unit(5, 121.8);
  const pane = (id: number, x: number) => ({ ...unit(id, x), state: { ...createEditorState(), ...createKitchenDesign('end-panel') } });
  const a = pane(2, 30.9), b = pane(3, 30.9), scene = sceneOf([left, a, b, right, next]); scene.activeWardrobe = 3;
  assert.equal(reconcileInstallation(scene), true);
  assert.equal(scene.wardrobes.filter(p => p.state.unit === 'end-panel').length, 1);
  near(right.x, 61.8); near(next.x, 121.8); assert.equal(scene.activeWardrobe, 2);
  const model = createEditorModel(scene), snapshot = model.snapshot();
  model.scene.wardrobes[1]!.x += .1; model.restore(snapshot); assert.equal(model.snapshot(), snapshot);
  const selected = createSceneCommands(() => scene).addKitchenUnit('end-panel', { beside: true });
  assert.equal(selected?.id, 2); assert.equal(scene.wardrobes.length, 4, 'adding to an existing separator reuses it');
});

test('strip reflow blocked by a wall is atomic and reports a useful construction error', () => {
  const boxes = corner(), scene = sceneOf(boxes);
  scene.studio = { template: 'custom', corners: [{ id: 'a', x: -100, z: 122 }, { id: 'b', x: 100, z: 122 }],
    walls: [{ id: 'end', a: 'a', b: 'b', thickness: 12, height: 270 }], openings: [] };
  const before = structuredClone(scene);
  assert.equal(reconcileInstallation(scene), false); assert.deepEqual(scene, before);
  let checkpoints = 0, message = '';
  const commands = createSceneCommands(() => scene, { checkpoint: () => { checkpoints++; }, report: m => { message = m; } });
  assert.equal(commands.setKitchenConstruction('cornerStrip', 5), false);
  assert.equal(checkpoints, 0); assert.deepEqual(scene, before); assert.match(message, /room|fit|reserve/i);
});

test('changing strip width never moves a run and rejects growth without clearance', () => {
  const scene = sceneOf(reposition(corner()).boxes); assert.equal(reconcileInstallation(scene), true);
  const positions = scene.wardrobes.map(p => [p.x, p.y, p.z, p.angle]); let checkpoints = 0;
  const command = createSceneCommands(() => scene, { checkpoint: () => { checkpoints++; } });
  assert.equal(command.setKitchenConstruction('cornerStrip', 5), false);
  assert.equal(checkpoints, 0);
  assert.equal(command.setKitchenConstruction('cornerStrip', 3.5), true);
  assert.deepEqual(scene.wardrobes.map(p => [p.x, p.y, p.z, p.angle]), positions);
  near(scene.wardrobes[1]!.state.w, 30); assert.equal(checkpoints, 1);
});


test('large configured strips and 50 mm fronts remain detected after the exact reflow', () => {
  for (const width of [4, 10, 20]) {
    const boxes = corner(); boxes[1]!.state.cornerStrip = width; boxes[0]!.state.frontThickness = 5;
    const plan = reposition(boxes);
    assert.equal(plan.valid, true);
    const strip = automaticInstallationParts(plan.boxes).find(p => p.state.unit === 'filler' && p.ownerId === 2);
    assert.ok(strip, 'the configured strip must remain present'); near(strip.state.w, width);
    near(plan.boxes[1]!.z - boxes[1]!.z, width + 5 - 2.5);
    assert.deepEqual(reposition(plan.boxes).boxes, plan.boxes);
  }
});

test('floor run reflow preserves upper/appliance alignment; an isolated upper move leaves the floor row', () => {
  const boxes = corner(), upper = { ...unit(4, 22, 91.5, 270), y: 140 };
  const planned = reposition([...boxes, upper]);
  near(planned.boxes[3]!.z - upper.z, 3.3);
  const cabinet = unit(1, 0), wallUnit = { ...unit(2, 0), y: 140 };
  const wall = { id: 'wall', x: -35, y: 100, z: 0, angle: 0, state: { w: 10, h: 170, d: 200 } };
  const result = reposition([cabinet, wallUnit], [wall]);
  assert.equal(result.valid, true); near(result.boxes[0]!.x, 0); near(result.boxes[1]!.x, 1.8);
});

test('a chain of explicit separator duplicates redirects selection to the surviving board', () => {
  const pane = (id: number, x: number) => ({ ...unit(id, x), state: { ...createEditorState(), ...createKitchenDesign('end-panel') } });
  const scene = sceneOf([pane(3, 0), pane(4, 0), pane(2, 0)]); scene.activeWardrobe = 4;
  assert.equal(reconcileInstallation(scene), true);
  assert.equal(scene.wardrobes.length, 1); assert.equal(scene.activeWardrobe, scene.wardrobes[0]!.id);
});
