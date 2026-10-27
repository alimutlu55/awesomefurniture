import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { automaticInstallationParts } from '../../src/domain/kitchen/automatic-installation';
import { rememberEndPanels } from '../../src/domain/kitchen/end-panels';
import { reconcileInstallation } from '../../src/application/projects/installation-reconciliation';
import { createProject } from '../../src/domain/project/project';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { planLevelRows } from '../../src/domain/drawings/plan-levels';
import type { EditorScene } from '../../src/application/projects/editor-scene';

const cabinet = (id: number, x: number, unit: 'base' | 'tall' | 'upper' | 'end-panel' = 'base', extra = {}) => ({
  id, name: 'Cabinet ' + id, x, y: 0, z: 29, angle: 0,
  state: { ...createEditorState(), ...createKitchenDesign(unit), secs: [[], [], [], [], [], []], ...extra },
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const sceneOf = (wardrobes: ReturnType<typeof cabinet>[]): EditorScene => ({ wardrobes, activeWardrobe: wardrobes[0]!.id, nextWardrobeId: 100 });
const inputOf = (s: EditorScene) => ({ ...(s.studio ? { studio: s.studio } : {}), pieces: s.wardrobes.map(p => ({ ...p, design: p.state })) });

function stackedJoint() {
  const floor = cabinet(1, -30), tall = cabinet(2, 31.8, 'tall', { h: 164 });
  const shallow = { ...cabinet(3, -30, 'upper', { w: 60, h: 117.4, d: 35 }), y: 152.6, z: 17.5 };
  const lower = { ...cabinet(4, 31.8, 'upper', { w: 60, h: 50.9, d: 58 }), y: 164 };
  const upper = { ...cabinet(5, 31.8, 'upper', { w: 60, h: 55, d: 58 }), y: 214.9 };
  return sceneOf([floor, tall, shallow, lower, upper]);
}

test('the shallow/tall/stacked junction becomes one continuous 18 mm separator with exact stock clearance', () => {
  const scene = stackedJoint(), before = structuredClone(scene.wardrobes);
  assert.equal(reconcileInstallation(scene), true);
  const part = automaticInstallationParts(scene.wardrobes).find(p => 'sources' in p && p.sources.some(q => q.ownerId === 3 && q.side === 1))!;
  assert.ok(part && 'sources' in part);
  near(part.state.w, 1.8); near(part.state.h, 270); near(part.state.d, 58); near(part.x, .9);
  near(scene.wardrobes.find(p => p.id === 3)!.x, -30);
  near(scene.wardrobes.find(p => p.id === 4)!.x, 31.8);
  assert.deepEqual(scene.wardrobes.map(p => [p.state.w, p.state.h, p.state.d, p.state.fin]), before.map(p => [p.state.w, p.state.h, p.state.d, p.state.fin]));
  const validation = validateForManufacture(inputOf(scene));
  assert.deepEqual(validation.findings.filter(f => f.severity === 'critical'), []);
  const pieces = placePieces(inputOf(scene)), board = pieces.find(p => p.id === part.id)!;
  assert.deepEqual(pieceBoards(board, pieces).map(p => p.cut), [{ length: 270, width: 58, thickness: 1.8 }]);
  const studio = { template: 'custom' as const, corners: [{ id: 'a', x: -200, z: -6 }, { id: 'b', x: 200, z: -6 }],
    walls: [{ id: 'wall', a: 'a', b: 'b', thickness: 12, height: 270 }], openings: [] };
  const upper = technicalDrawings({ ...inputOf(scene), studio }).find(p => p.title === 'Upper furniture plan')!;
  assert.ok(upper.pieces?.some(p => p.mark === board.mark), 'a floor-to-top shared board also appears on the upper plan');
  assert.ok(upper.views.flatMap(v => v.items).filter(p => p.kind === 'dims' && p.dir.x === 1).every(p => p.kind === 'dims' && p.side === 1),
    'including a full-height panel must not add a floor-front chain containing only the uprights');
});

test('committed end boards stay present on add, precise moves, save/reopen and undo', () => {
  const model = createEditorModel(sceneOf([cabinet(1, 0)])); let checkpoint = '';
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => { checkpoint = model.snapshot(); } });
  assert.deepEqual(model.activeCabinet().state.endPanelSides, [-1, 1]);
  const next = commands.addKitchenUnit('base', { beside: true })!;
  assert.ok(next); near(next.x, 61.8);
  assert.equal(automaticInstallationParts(model.scene.wardrobes).length, 3, 'two outside ends and the retained separator');
  assert.equal(commands.setCabinetPose('x', 60), false, 'cannot push the cabinet through the existing separator');
  assert.equal(commands.setCabinetPose('x', 62.3), true); near(next.x, 62.3);
  assert.equal(commands.setCabinetPose('x', 61.9), true); near(next.x, 61.9);
  const document = sceneToProject(createProject('retain', 'Retained panels'), model.scene);
  const reopened = projectToScene(deserializeProject(serializeProject(document)))!;
  assert.equal(automaticInstallationParts(reopened.wardrobes).length, 3); near(reopened.wardrobes[1]!.x, 61.9);
  assert.deepEqual(reopened.wardrobes.map(p => p.state.endPanelSides), model.scene.wardrobes.map(p => p.state.endPanelSides));
  model.restore(checkpoint); assert.equal(automaticInstallationParts(model.scene.wardrobes).length, 3);
});

test('a separately added positive-id pane remains when another cabinet joins its side', () => {
  const pane = cabinet(2, 30.9, 'end-panel');
  const model = createEditorModel(sceneOf([cabinet(1, 0), pane]));
  const commands = createSceneCommands(() => model.scene), added = commands.addKitchenUnit('base', { beside: true })!;
  assert.ok(added); near(added.x, 61.8);
  assert.equal(model.scene.wardrobes.filter(p => p.state.unit === 'end-panel').length, 1);
  assert.equal(model.scene.wardrobes.find(p => p.id === pane.id)!.state.w, 1.8);
  assert.deepEqual(validateForManufacture(inputOf(model.scene)).findings.filter(f => f.severity === 'critical'), []);
});

test('dimension rows separate stacked levels and front depths instead of splitting a 600 mm width into 599 + 1', () => {
  const scene = stackedJoint(); assert.equal(reconcileInstallation(scene), true);
  const rows = planLevelRows(placePieces(inputOf(scene)).filter(p => p.hung || p.id < 0));
  const ids = rows.map(row => row.filter(p => p.id > 0).map(p => p.id));
  assert.deepEqual(ids, [[3], [4], [5]]);
  for (const row of rows) for (const p of row.filter(p => p.id > 0)) near((p.hi - p.lo) * 10, 600);
});

test('custom stock and retained intent survive rotation; a real 1 mm clearance is not collapsed', () => {
  for (const angle of [0, 17, 90, 270]) {
    const a = cabinet(1, 0, 'base', { endPanelThickness: 2.2 }), b = cabinet(2, 62.3, 'base', { endPanelThickness: 2.2 });
    const rad = angle * Math.PI / 180;
    const boxes = [a, b].map(p => ({ ...p, x: Math.cos(rad) * p.x + Math.sin(rad) * p.z, z: -Math.sin(rad) * p.x + Math.cos(rad) * p.z, angle }));
    rememberEndPanels(boxes); const scene = sceneOf(boxes), before = structuredClone(boxes);
    assert.equal(reconcileInstallation(scene), true);
    near(scene.wardrobes[1]!.x, before[1]!.x); near(scene.wardrobes[1]!.z, before[1]!.z);
    assert.equal(automaticInstallationParts(scene.wardrobes).length, 3);
  }
});


test('two explicit separators of different heights become one full shared upright and preserve an actual panel entity', () => {
  const a = cabinet(2, 30.9, 'end-panel'), b = cabinet(3, 30.9, 'end-panel', { h: 164 });
  const scene = sceneOf([cabinet(1, 0), a, b, cabinet(4, 61.8, 'tall', { h: 164 })]);
  assert.equal(reconcileInstallation(scene), true);
  const panes = scene.wardrobes.filter(p => p.state.unit === 'end-panel');
  assert.equal(panes.length, 1); near(panes[0]!.state.w, 1.8); near(panes[0]!.state.h, 164);
  near(scene.wardrobes.find(p => p.id === 4)!.x, 61.8);
  assert.deepEqual(validateForManufacture(inputOf(scene)).findings.filter(f => f.severity === 'critical'), []);
});


test('shared separator uses configured thicker stock when the joining cabinet has the default thickness', () => {
  const model = createEditorModel(sceneOf([cabinet(1, 0, 'base', { endPanelThickness: 2.2 })]));
  const next = createSceneCommands(() => model.scene).addKitchenUnit('base', { beside: true })!;
  assert.ok(next); near(next.x, 62.2);
  const parts = automaticInstallationParts(model.scene.wardrobes);
  assert.equal(parts.length, 3);
  const common = parts.find(p => 'sources' in p && p.sources.length === 2)!;
  near(common.state.w, 2.2);
});

test('alignment and filling measure available space beyond the persistent separator stock', () => {
  const model = createEditorModel(sceneOf([cabinet(1, 0), cabinet(2, 63)]));
  const commands = createSceneCommands(() => model.scene); model.select(2);
  near(commands.alignSnap(model.activeCabinet(), 6).x, 61.8);
  const fill = createEditorModel(sceneOf([cabinet(1, 60), cabinet(2, 0), cabinet(3, 125)]));
  const filling = createSceneCommands(() => fill.scene);
  near(filling.fillableSpace(), 3.2); assert.equal(filling.fillSpace(), true);
  near(fill.activeCabinet().state.w, 63.2); near(filling.fillableSpace(), 0);
});

test('an imported cabinet overlapping a retained board is reported without moving any furniture', () => {
  const a = cabinet(1, 0, 'base', { endPanelSides: [1] }), b = cabinet(2, 60);
  const scene = sceneOf([a, b]); assert.equal(reconcileInstallation(scene), false);
  near(a.x, 0); near(b.x, 60); assert.ok(automaticInstallationParts(scene.wardrobes).some(p => p.state.unit === 'end-panel'));
});


test('serialized transform noise is numerical contact while a real 1 mm overlap remains a clash', () => {
  const geometry = createCabinetGeometry(() => []), a = cabinet(1, 0), b = cabinet(2, 60 - .000001);
  assert.equal(geometry.cabinetOverlaps(a, b), false);
  assert.equal(geometry.cabinetOverlaps(a, { ...b, x: 59.9 }), true);
});


test('an already-added explicit base-height separator grows for an adjoining taller cabinet instead of vanishing or duplicating', () => {
  const pane = cabinet(2, 30.9, 'end-panel'), model = createEditorModel(sceneOf([cabinet(1, 0), pane]));
  const added = createSceneCommands(() => model.scene).addKitchenUnit('tall', { beside: true })!;
  assert.ok(added); near(added.x, 61.8);
  const existing = model.scene.wardrobes.find(p => p.id === 2)!;
  near(existing.state.w, 1.8); near(existing.state.h, added.state.h);
  model.select(existing.id);
  assert.equal(createSceneCommands(() => model.scene).setCabinetSize('h', 86), false, 'keep the complete attached side');
  assert.equal(model.scene.wardrobes.filter(p => p.state.unit === 'end-panel').length, 1);
  assert.deepEqual(validateForManufacture(inputOf(model.scene)).findings.filter(f => f.severity === 'critical'), []);
});
