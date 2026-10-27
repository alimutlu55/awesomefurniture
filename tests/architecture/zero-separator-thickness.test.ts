import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { automaticInstallationParts } from '../../src/domain/kitchen/automatic-installation';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import type { EditorScene } from '../../src/application/projects/editor-scene';

const unit = (id: number, x = 0) => ({ id, name: 'Cabinet', x, y: 0, z: 0, angle: 0,
  state: { ...createEditorState(), ...createKitchenDesign('base') } });
const modelOf = (wardrobes = [unit(1)]) => createEditorModel({ wardrobes, activeWardrobe: 1, nextWardrobeId: 10 } satisfies EditorScene);
const positions = (s: EditorScene) => s.wardrobes.map(p => [p.id, p.x, p.y, p.z, p.angle]);

test('zero disables automatic panes and creates no zero-sized stock; re-enabling restores real boards without moving furniture', () => {
  const model = modelOf(), command = createSceneCommands(() => model.scene), before = positions(model.scene);
  assert.equal(automaticInstallationParts(model.scene.wardrobes).length, 2);
  assert.equal(command.setKitchenConstruction('endPanelThickness', 0), true);
  assert.equal(model.activeCabinet().state.endPanelThickness, 0);
  assert.equal(automaticInstallationParts(model.scene.wardrobes).length, 0);
  const input = { pieces: model.scene.wardrobes.map(p => ({ ...p, design: p.state })) };
  assert.equal(placePieces(input).filter(p => p.id < 0).length, 0);
  assert.deepEqual(validateForManufacture(input).findings.filter(f => f.severity === 'critical'), []);
  assert.equal(command.setKitchenConstruction('endPanelThickness', 1.8), true);
  assert.equal(automaticInstallationParts(model.scene.wardrobes).length, 2);
  assert.deepEqual(positions(model.scene), before);
});

test('zero survives validated save, reopen and retained-side intent', () => {
  const model = modelOf(); createSceneCommands(() => model.scene).setKitchenConstruction('endPanelThickness', 0);
  const project = sceneToProject(createProject('no-pane', 'No pane'), model.scene);
  const reopened = projectToScene(deserializeProject(serializeProject(project)))!;
  assert.equal(reopened.wardrobes[0]!.state.endPanelThickness, 0);
  assert.deepEqual(reopened.wardrobes[0]!.state.endPanelSides, [-1, 1]);
  assert.equal(automaticInstallationParts(reopened.wardrobes).length, 0);
});

test('disabling one cabinet does not move it or erase the neighbouring cabinet separator', () => {
  const model = modelOf([unit(1), unit(2, 61.8)]), before = positions(model.scene), neighbour = structuredClone(model.scene.wardrobes[1]);
  assert.equal(createSceneCommands(() => model.scene).setKitchenConstruction('endPanelThickness', 0), true);
  assert.deepEqual(positions(model.scene), before); assert.deepEqual(model.scene.wardrobes[1], neighbour);
  assert.ok(automaticInstallationParts(model.scene.wardrobes).every(p => p.ownerId === 2));
});

test('an explicitly requested new pane still uses actual stock when automatic panes are disabled', () => {
  const model = modelOf(); const command = createSceneCommands(() => model.scene);
  command.setKitchenConstruction('endPanelThickness', 0);
  const pane = command.addKitchenUnit('end-panel', { beside: true })!;
  assert.ok(pane); assert.equal(pane.state.w, 1.8);
});
