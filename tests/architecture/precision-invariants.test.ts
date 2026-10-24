import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { cabinetBoards } from '../../src/domain/drawings/cabinet-boards';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createProject } from '../../src/domain/project/project';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { translateStudio } from '../../src/domain/studio/studio-edit';
import type { EditorScene } from '../../src/application/projects/editor-scene';

/** Millimetre precision through the whole life of a design: derived sizes, saving, undo and snapping. */

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('an 800 mm cabinet with two 18 mm sides is 764 mm inside, and every derived size follows the boards', () => {
  const design = { ...createEditorState(), w: 80, n: 1 };
  assert.equal(PANEL, 1.8);
  assert.equal(Math.round(createWardrobeGeometry(() => design).widths()[0]! * 10), 764);
  const base = cabinetBoards(design).find(b => b.name === 'Base')!;
  assert.equal(Math.round(base.cut.length * 10), 764, 'the base board between the sides is cut to the inside width');
  // Property: at any width and bay count, the inside widths and the boards close exactly on the outer width.
  for (let k = 0; k < 300; k++) {
    const n = 1 + Math.floor(rand() * 4), w = Math.round((40 * n + rand() * 200) * 10) / 10, d = { ...createEditorState(), w, n };
    const widths = createWardrobeGeometry(() => d).widths();
    assert.ok(widths.every(x => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9), 'whole millimetres: ' + widths);
    assert.ok(Math.abs(widths.reduce((s, x) => s + x, 0) + (n + 1) * PANEL - w) < 1e-9, w + ' cm, ' + n + ' bays');
    if (n === 1) assert.ok(Math.abs(cabinetBoards(d).find(b => b.name === 'Base')!.cut.length - (w - 2 * PANEL)) < 1e-9);
  }
});

test('saving and reopening keeps every size and pose to the last digit', () => {
  for (let k = 0; k < 25; k++) {
    const state = { ...createEditorState(), w: Math.round((120 + rand() * 200) * 10) / 10, h: Math.round((200 + rand() * 60) * 10) / 10, d: Math.round((40 + rand() * 30) * 10) / 10 };
    const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 2, wardrobes: [{ id: 1, name: 'W1',
      x: Math.round((rand() * 400 - 200) * 100) / 100, y: 0, z: Math.round((rand() * 300) * 100) / 100, angle: Math.round(rand() * 3600) / 10, state }] };
    const back = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('p' + k, 'P'), scene))))!.wardrobes[0]!;
    const before = scene.wardrobes[0]!;
    assert.deepEqual([back.x, back.z, back.angle, back.state.w, back.state.h, back.state.d], [before.x, before.z, before.angle, state.w, state.h, state.d]);
  }
});

test('undo and redo return to exactly the states they left, after a run of edits', () => {
  const model = createEditorModel(), history = createSceneHistory(model.snapshot, model.restore), commands = createSceneCommands(() => model.scene);
  const states = [model.snapshot()];
  for (const [key, value] of [['w', 213.7], ['h', 241.3], ['d', 57.9], ['w', 180.1]] as const) {
    const before = model.snapshot();
    assert.ok(commands.setCabinetSize(key, value, false));
    history.checkpoint(before);
    states.push(model.snapshot());
  }
  for (let k = states.length - 2; k >= 0; k--) { history.undo(); assert.equal(model.snapshot(), states[k], 'undo to state ' + k); }
  for (let k = 1; k < states.length; k++) { history.redo(); assert.equal(model.snapshot(), states[k], 'redo to state ' + k); }
  assert.equal(model.activeCabinet().state.w, 180.1);
});

test('a snap that would run into something is not taken: the piece stays where the pointer put it', () => {
  const studio = translateStudio(createStudio('bedroom'), 0, -30);
  const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 4, studio, wardrobes: [
    { id: 1, name: 'W1', x: -80, y: 0, z: 4, angle: 0, state: createEditorState() },
    { id: 2, name: 'W2', x: 130, y: 0, z: 0, angle: 0, state: { ...createEditorState(), w: 120, n: 1 } },
    // A thin panel right behind W1: lining W1's front up with W2's would push W1 into it.
    { id: 3, name: 'Panel', x: -80, y: 0, z: -27, angle: 0, state: { ...createEditorState(), w: 200, d: 2, n: 1 } }] };
  const commands = createSceneCommands(() => scene), w1 = scene.wardrobes[0]!;
  assert.deepEqual(commands.alignSnap(w1, 6), { x: -80, z: 4 }, 'fronts in line would collide: no snap');
  scene.wardrobes.pop();
  assert.deepEqual(commands.alignSnap(w1, 6), { x: -80, z: 0 }, 'with the panel gone, it lines up');
});
