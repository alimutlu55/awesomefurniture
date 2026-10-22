import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry';
import { ceilingClearance } from '../../src/domain/studio/studio-clearance';
import { resolveShape } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import type { Studio } from '../../src/domain/studio/studio';

function fixture(studio: Studio) {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio });
  const history: string[] = [], messages: string[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.push(model.snapshot()), report: m => messages.push(m) });
  return { model, commands, history, messages };
}
test('a wardrobe added to a narrow prepared studio stays inside its walls and below its ceiling', () => {
  const studio: Studio = { ...rectangleStudio(150, 115, 270), ceilings: [{ id: 'k1', wall: 'w1', run: 'along', depth: 115,
    profile: [{ t: 6, y: 245 }, { t: 56, y: 190 }, { t: 156, y: 190 }] }] };
  const f = fixture(studio), before = f.model.snapshot(), added = f.commands.addCabinet();
  assert.ok(added);
  assert.equal(createCabinetGeometry(() => f.model.scene.wardrobes, () => studioObstacles(studio)).cabinetCollides(added), false);
  assert.ok(added.state.w <= 150, 'default width adapts to the room');
  assert.ok(Math.abs(added.x) + added.state.w / 2 <= 75 + .01);
  assert.equal(ceilingClearance(studio, { ...added, w: added.state.w, d: added.state.d })(resolveShape(added.state)), false);
  assert.deepEqual(f.history, [before]);
});
test('a room too small for a wardrobe refuses creation without changing scene or history', () => {
  const f = fixture(rectangleStudio(19, 19)), before = f.model.snapshot();
  assert.equal(f.commands.addCabinet(), null);
  assert.equal(f.model.snapshot(), before);
  assert.deepEqual(f.history, []);
});

function assertPhysics(f: ReturnType<typeof fixture>) {
  const room = f.model.scene.studio!, collision = createCabinetGeometry(() => f.model.scene.wardrobes, () => studioObstacles(room));
  for (const c of f.model.scene.wardrobes) {
    assert.equal(collision.cabinetCollides(c), false, 'wardrobe stays out of walls and neighbours');
    assert.equal(ceilingClearance(room, { ...c, w: c.state.w, d: c.state.d })(resolveShape(c.state)), false, 'full-depth top stays under all ceilings');
  }
}

test('a view-targeted wall keeps default size rather than filling a longer or different wall', () => {
  const f = fixture(rectangleStudio(300, 500));
  const added = f.commands.addCabinet(false, undefined, undefined, { placementWall: 'w1' });
  assert.ok(added); assert.equal(added.angle, 0); assert.equal(added.state.w, 200);
  assertPhysics(f);
});
test('a view-targeted wall adapts to its width and never falls back to a side wall', () => {
  const f = fixture(rectangleStudio(150, 400));
  const added = f.commands.addCabinet(false, undefined, undefined, { placementWall: 'w1' });
  assert.ok(added); assert.equal(added.angle, 0); assert.ok(added.state.w <= 150);
  assertPhysics(f);
  const narrow = fixture(rectangleStudio(19, 400)), before = narrow.model.snapshot();
  assert.equal(narrow.commands.addCabinet(false, undefined, undefined, { placementWall: 'w1' }), null);
  assert.equal(narrow.model.snapshot(), before); assert.equal(narrow.history.length, 0);
  assert.ok(narrow.commands.addCabinet(), 'a side wall could fit, but must not override the requested wall');
});
test('an explicitly selected wall takes priority over the view target', () => {
  const f = fixture(rectangleStudio(300, 500));
  const added = f.commands.addCabinet(false, undefined, 'w2', { w: 180, placementWall: 'w1' });
  assert.ok(added); assert.equal(added.angle, -90); assertPhysics(f);
});

test('explicit dimensions and a duplicate that cannot fit are refused atomically', () => {
  const f = fixture(rectangleStudio(150, 115)), empty = f.model.snapshot();
  assert.equal(f.commands.addCabinet(false, undefined, undefined, { w: 200 }), null);
  assert.equal(f.model.snapshot(), empty); assert.equal(f.history.length, 0);
  assert.ok(f.commands.addCabinet());
  const before = f.model.snapshot(), history = f.history.length;
  assert.equal(f.commands.addCabinet(true), null);
  assert.equal(f.model.snapshot(), before); assert.equal(f.history.length, history);
  assertPhysics(f);
});

test('a named wall or offset is honoured instead of silently choosing another wall', () => {
  const f = fixture(rectangleStudio(150, 180));
  const before = f.model.snapshot();
  assert.equal(f.commands.addCabinet(false, undefined, 'missing'), null);
  assert.equal(f.commands.addCabinet(false, undefined, 'w1', { w: 140, from: 30 }), null);
  assert.equal(f.model.snapshot(), before); assert.equal(f.history.length, 0);
  const valid = f.commands.addCabinet(false, undefined, 'w1', { w: 140, from: 5 });
  assert.ok(valid); assert.equal(valid.state.w, 140); assert.equal(valid.angle, 0);
  assertPhysics(f);
});

test('flat room ceilings constrain creation even without a ceiling feature', () => {
  const f = fixture(rectangleStudio(160, 120, 100));
  const added = f.commands.addCabinet(); assert.ok(added); assert.equal(added.state.h, 100);
  assertPhysics(f);
  const explicit = fixture(rectangleStudio(160, 120, 100)), before = explicit.model.snapshot();
  assert.equal(explicit.commands.addCabinet(false, undefined, undefined, { h: 230 }), null);
  assert.equal(explicit.model.snapshot(), before); assert.equal(explicit.history.length, 0);
});

test('placement preserves access to a doorway in the narrow studio', async () => {
  const { studioPlacementObstacles } = await import('../../src/domain/studio/studio-obstacles');
  const studio = { ...rectangleStudio(150, 115), openings: [{ id: 'o1', wall: 'w4', kind: 'door' as const, offset: 63.5, width: 80, height: 205, sill: 0 }] };
  const f = fixture(studio), added = f.commands.addCabinet(); assert.ok(added);
  assert.equal(createCabinetGeometry(() => f.model.scene.wardrobes, () => studioPlacementObstacles(studio)).cabinetCollides(added), false);
  assert.ok(added.state.w <= 100, 'width leaves a doorway access strip');
  assertPhysics(f);
});

test('width, depth and height fit a translated, rotated room with thick walls', () => {
  const a = 37 * Math.PI / 180, room = rectangleStudio(147.3, 42, 180, 28);
  const studio = { ...room, corners: room.corners.map(p => ({ ...p, x: 200 + p.x * Math.cos(a) + p.z * Math.sin(a), z: -70 - p.x * Math.sin(a) + p.z * Math.cos(a) })) };
  const f = fixture(studio), added = f.commands.addCabinet(false, undefined, undefined, { placementWall: 'w1' }); assert.ok(added);
  assert.ok(added.state.w <= 147.3); assert.ok(added.state.d <= 42); assert.equal(added.state.h, 180);
  assertPhysics(f);
});

test('room-fit results survive save/reload and one undo restores the original empty studio', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const f = fixture(rectangleStudio(150, 115)); assert.ok(f.commands.addCabinet());
  const restored = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('studio-test', 'Studio'), f.model.scene))));
  assert.ok(restored); const checked = fixture(restored.studio!); checked.model.restore(JSON.stringify(restored)); assertPhysics(checked);
  assert.equal(f.history.length, 1); f.model.restore(f.history[0]!);
  assert.equal(f.model.scene.wardrobes.length, 0); assert.equal(f.model.scene.nextWardrobeId, 1); assert.equal(f.model.scene.activeWardrobe, 0);
});


test('a ceiling sloping across depth checks the hidden rear edge during creation', () => {
  const studio: Studio = { ...rectangleStudio(150, 115), ceilings: [{ id: 'k1', wall: 'w1', run: 'across', depth: 115,
    profile: [{ t: 0, y: 80 }, { t: 115, y: 245 }] }] };
  const f = fixture(studio), added = f.commands.addCabinet(); assert.ok(added);
  assert.ok(added.state.h <= 80.5, 'rear clearance controls the automatic top'); assertPhysics(f);
});

test('a low wardrobe fits below a window after ceiling fitting', () => {
  const studio: Studio = { ...rectangleStudio(150, 70, 180), openings: [{ id: 'o1', wall: 'w1', kind: 'window', offset: 81, width: 120, height: 80, sill: 90 }],
    ceilings: [{ id: 'k1', wall: 'w1', run: 'along', depth: 70, profile: [{ t: 6, y: 80 }, { t: 156, y: 80 }] }] };
  const f = fixture(studio), added = f.commands.addCabinet(); assert.ok(added);
  assert.equal(added.state.h, 80); assertPhysics(f);
});
