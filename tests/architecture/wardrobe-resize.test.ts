import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { measureAround } from '../../src/application/commands/align-commands';
import type { EditorScene } from '../../src/application/projects/editor-scene';

function fixture(room = true) {
  const studio: EditorScene['studio'] = room ? { ...rectangleStudio(400, 350), ceilings: [{ id: 'k1', wall: 'w1', run: 'across', depth: 150,
    profile: [{ t: 0, y: 120 }, { t: 150, y: 260 }] }] } : undefined;
  const model = createEditorModel({ wardrobes: [{ id: 1, name: 'W', x: -120, z: 30, y: 0, angle: 0,
    state: { ...createEditorState(), w: 160 } }], activeWardrobe: 1, nextWardrobeId: 2, studio });
  const messages: string[] = [], history: string[] = [];
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: () => history.push(model.snapshot()) });
  commands.followCeilings();
  return { model, commands, messages, history, cabinet: () => model.activeCabinet() };
}

test('front depth resize under a slope leaves touching back and side walls fixed', () => {
  const f = fixture(), before = structuredClone(f.cabinet());
  assert.equal(f.commands.setCabinetSize('d', 80, true, 'front'), true);
  const c = f.cabinet();
  assert.equal(c.state.d, 80);
  assert.equal(c.z - c.state.d / 2, before.z - before.state.d / 2, 'back face stays at the wall');
  assert.equal(c.x - c.state.w / 2, -200, 'side wall contact stays fixed');
  assert.deepEqual(c.state.shape!.top, before.state.shape!.top, 'touching ceiling does not block free depth');
  const gaps = measureAround(f.model.scene, c, ['left', 'back']).gaps;
  assert.deepEqual(gaps.map(g => [g.side, g.distance]), [['left', 0], ['back', 0]]);
  assert.equal(f.commands.setCabinetSize('d', 70, true, 'back'), true, 'blocked face can shrink away from the wall');
  assert.equal(f.commands.setCabinetSize('d', 80, true, 'back'), true, 'can return to contact');
  assert.equal(f.commands.setCabinetSize('d', 81, true, 'back'), false, 'cannot grow through the wall');
  assert.deepEqual(f.messages, [], 'contact is measured, without warning feedback');
});

test('a blocked side or ceiling does not freeze width and depth on free faces', () => {
  const f = fixture();
  assert.equal(f.commands.setCabinetSize('w', 180, true, 'left'), false);
  assert.equal(f.commands.setCabinetSize('h', 130, true, 'top'), false);
  assert.equal(f.commands.setCabinetSize('w', 180, true, 'right'), true);
  assert.equal(f.cabinet().x - f.cabinet().state.w / 2, -200);
  assert.equal(f.commands.setCabinetSize('d', 80, true, 'front'), true);
  assert.equal(f.cabinet().z - f.cabinet().state.d / 2, 0);
  assert.equal(f.commands.setCabinetSize('h', 110, true, 'top'), true, 'a low room-fitted top can shrink away from ceiling contact');
  assert.equal(f.cabinet().state.h, 110);
});

test('dimension fields anchor wall contact, while free-standing fields remain centred', () => {
  const fitted = fixture();
  assert.equal(fitted.commands.setCabinetSize('d', 80), true);
  assert.equal(fitted.cabinet().z, 40);
  assert.equal(fitted.commands.setCabinetSize('w', 180), true);
  assert.equal(fitted.cabinet().x, -110);
  const free = fixture(false), original = structuredClone(free.cabinet());
  assert.equal(free.commands.setCabinetSize('d', 80), true);
  assert.equal(free.cabinet().z, original.z, 'existing centred input behaviour');
  assert.equal(free.commands.setCabinetSize('w', 180), true);
  assert.equal(free.cabinet().x, original.x);
  assert.equal(free.commands.setCabinetSize('h', 240), true);
  assert.equal(free.cabinet().state.h, 240);
});

test('rotated face resizing anchors in wardrobe coordinates', () => {
  const f = fixture(false), c = f.cabinet();
  c.angle = 90;
  const back = c.x - c.state.d / 2;
  assert.equal(f.commands.setCabinetSize('d', 80, true, 'front'), true);
  assert.ok(Math.abs(c.x - c.state.d / 2 - back) < 1e-8);
  assert.equal(c.z, 30);
});
