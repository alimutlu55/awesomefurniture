import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createProject } from '../../src/domain/project/project';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { planInstallationLayout } from '../../src/domain/kitchen/installation-layout';
import type { EditorScene } from '../../src/application/projects/editor-scene';

const unit = (id: number, x: number, z = 0, angle = 0, preset = 'base') => ({ id, name: 'Cabinet ' + id, x, y: 0, z, angle,
  state: { ...createEditorState(), ...createKitchenDesign('base', preset) } });
const sceneOf = (wardrobes: ReturnType<typeof unit>[], activeWardrobe = 1): EditorScene => ({ wardrobes, activeWardrobe, nextWardrobeId: 10 });
const poses = (scene: EditorScene) => scene.wardrobes.map(p => [p.id, p.x, p.y, p.z, p.angle]);
const corner = () => {
  const blind = unit(1, 0, 0, 0, 'corner'); blind.state.w = 102;
  return sceneOf([blind, unit(2, 22, 49.8, 270, 'cargo'), unit(3, 22, 94.8, 270)], 2);
};

test('construction size fields reject missing stock clearance instead of shifting another cabinet/run', () => {
  const model = createEditorModel(corner()), initial = model.snapshot(), before = poses(model.scene); let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => { checkpoints++; } });
  assert.equal(commands.setKitchenConstruction('cornerStrip', 5), false);
  assert.equal(model.snapshot(), initial); assert.equal(checkpoints, 0);
  model.select(1);
  assert.equal(commands.setKitchenConstruction('frontThickness', 1.9), false);
  assert.deepEqual(poses(model.scene), before); assert.equal(checkpoints, 0);
  model.select(2);
  assert.equal(commands.setKitchenConstruction('cornerStrip', 3.5), true);
  assert.deepEqual(poses(model.scene), before); assert.equal(checkpoints, 1);
});

test('width, depth and height resizing affect only the selected cabinet', () => {
  for (const [axis, value] of [['w', 61], ['d', 59], ['h', 87]] as const) {
    const model = createEditorModel(sceneOf([unit(1, 0), unit(2, 180)])), before = structuredClone(model.scene.wardrobes[1]);
    assert.equal(createSceneCommands(() => model.scene).setCabinetSize(axis, value), true);
    assert.deepEqual(model.scene.wardrobes[1], before, axis + ' must not modify the other cabinet');
  }
});

test('a cabinet constrained on both sides cannot grow by moving either neighbour', () => {
  const model = createEditorModel(sceneOf([unit(1, -61.8), unit(2, 0), unit(3, 61.8)], 2)), before = model.snapshot();
  assert.equal(createSceneCommands(() => model.scene).setCabinetSize('w', 60.1), false);
  assert.equal(model.snapshot(), before);
  assert.equal(createSceneCommands(() => model.scene).setCabinetSize('w', 59.9), true);
  assert.equal(model.scene.wardrobes[0]!.x, -61.8); assert.equal(model.scene.wardrobes[2]!.x, 61.8);
});

test('opening or rendering a saved layout never relocates cabinets to repair installation gaps', () => {
  const source = corner(); source.wardrobes[1]!.z = 46.5; source.wardrobes[2]!.z = 91.5;
  const before = poses(source), model = createEditorModel(source);
  assert.deepEqual(poses(model.scene), before);
  const project = sceneToProject(createProject('fixed-positions', 'Fixed positions'), model.scene);
  const reopened = projectToScene(project)!;
  assert.deepEqual(poses(reopened), before);
  assert.deepEqual(poses(createEditorModel(reopened).scene), before);
});

test('the installation planner preserves furniture positions unless repositioning was explicitly requested', () => {
  const source = corner(); source.wardrobes[1]!.z = 46.5;
  const planned = planInstallationLayout(source.wardrobes);
  assert.deepEqual(poses({ ...source, wardrobes: planned.boxes }), poses(source));
});
