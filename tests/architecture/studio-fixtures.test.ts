import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createFixtureCommands } from '../../src/application/commands/fixture-commands';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { FIXTURE_CATALOG, FIXTURE_PRESETS, fixtureDefinition } from '../../src/domain/studio/fixtures/fixture-catalog';
import { fixtureDataProblems, fixtureFindings } from '../../src/domain/studio/fixtures/fixture-validation';
import { fixturePose, fixtureSolids } from '../../src/domain/studio/fixtures/fixture-geometry';
import { fixtureWall } from '../../src/domain/studio/fixtures/fixture-geometry';
import { moveWall, removeWall, splitWall } from '../../src/domain/studio/studio-edit';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject, parseProject } from '../../src/infrastructure/serialization/project-codec';
import { fixtureArt, fixtureProducts } from '../../src/presentation/editor/fixture-art';
import { moveFixtureAssembly } from '../../src/domain/studio/fixtures/fixture-assembly';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { createFixtureViews } from '../../src/presentation/viewport/fixture-renderer';
import * as THREE from 'three';

function setup() {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: createStudio('bedroom') });
  const history = createSceneHistory(model.snapshot, model.restore), messages: string[] = [];
  const commands = createFixtureCommands({ getScene: () => model.scene, checkpoint: () => history.checkpoint(), report: m => messages.push(m) });
  const scene = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint(), report: m => messages.push(m) });
  return { model, history, commands, scene, messages };
}

for (const def of FIXTURE_CATALOG) test('fixture registry: ' + def.key + ' can be placed, rendered and serialized', () => {
  const { model, commands, messages } = setup();
  if (def.variants[0].mounting === 'surface') assert.ok(commands.add('vanity'));
  const id = commands.add(def.key);
  assert.ok(id, messages.join('; '));
  assert.deepEqual(fixtureDataProblems(model.scene.studio!), []);
  assert.ok(fixtureArt(def.key).includes('<svg'));
  assert.ok(fixtureProducts().includes('data-add-fixture="' + def.key + '"'));
  const document = sceneToProject(createProject('test', 'Fixture test'), model.scene);
  assert.equal(document.schemaVersion, 3);
  const reopened = projectToScene(deserializeProject(serializeProject(document)))!;
  assert.deepEqual(reopened.studio, model.scene.studio);
  assert.ok(fixtureDefinition(def.key));
});

for (const preset of FIXTURE_PRESETS) test('complete preset: ' + preset.key + ' is one undo step', () => {
  const { model, commands, history, messages } = setup(), before = model.snapshot();
  const id = commands.preset(preset.key);
  assert.ok(id, messages.join('; '));
  assert.equal(history.undoCount, 1);
  assert.equal(commands.problem(model.scene.studio!), null);
  const after = model.snapshot();
  assert.equal(history.undo(), true); assert.equal(model.snapshot(), before);
  assert.equal(history.redo(), true); assert.equal(model.snapshot(), after);
});

test('toilet boxing consumes space and retains independent bowl dimensions', () => {
  const { model, commands } = setup(), id = commands.preset('toilet-boxed')!;
  const f = model.scene.studio!.fixtures![0]!, e = model.scene.studio!.enclosures![0]!;
  assert.equal(f.id, id); assert.equal(f.d, 54);
  assert.ok(commands.commit({ ...model.scene.studio!, enclosures: [{ ...e, d: 20 }] }));
  assert.equal(model.scene.studio!.enclosures![0]!.d + f.d, 74);
  const previous = fixturePose(model.scene.studio!, f)!;
  assert.ok(commands.commit({ ...model.scene.studio!, enclosures: [{ ...e, d: 25, w: 100 }] }));
  assert.equal(fixturePose(model.scene.studio!, f)!.z - previous.z, 5);
  assert.equal(model.scene.studio!.fixtures![0]!.w, 37);
  assert.equal(commands.commit({ ...model.scene.studio!, enclosures: [{ ...e, d: 10 }] }), false);
});

test('existing concealed installation removes only its generated, unused enclosure', () => {
  const { model, commands } = setup(), id = commands.preset('toilet-boxed')!;
  assert.ok(commands.installation(id, 'existing'));
  assert.equal(model.scene.studio!.enclosures!.length, 0);
  assert.equal(model.scene.studio!.fixtures![0]!.anchor.kind, 'wall');
  assert.ok(fixtureFindings(model.scene.studio!, id).some(f => f.id === 'support'));
});

test('shared enclosure survives removing the toilet that originally created it', () => {
  const { model, commands } = setup(), id = commands.preset('toilet-boxed')!;
  const s = model.scene.studio!, e = s.enclosures![0]!;
  assert.ok(commands.commit({ ...s, enclosures: [{ ...e, w: 180 }] }));
  const other = commands.add('basin')!;
  assert.ok(commands.update(other, { anchor: { kind: 'enclosure', enclosure: e.id, offset: 52, y: 69 } }));
  assert.ok(commands.remove(id));
  assert.equal(model.scene.studio!.enclosures!.length, 1);
  assert.equal(commands.problem(model.scene.studio!), null);
});

test('mounted fixtures follow walls and host removal is refused without losing history', () => {
  const { model, commands, scene, history } = setup(), id = commands.add('toilet')!;
  const f = model.scene.studio!.fixtures!.find(f => f.id === id)!, a = f.anchor;
  assert.equal(a.kind, 'wall'); if (a.kind !== 'wall') return;
  const p = fixturePose(model.scene.studio!, f)!;
  assert.ok(scene.editStudio(s => moveWall(s, a.wall, 20)));
  assert.equal(fixturePose(model.scene.studio!, f)!.z, p.z + 20);
  const count = history.undoCount;
  assert.equal(scene.editStudio(s => removeWall(s, a.wall)), false);
  assert.equal(history.undoCount, count);
  assert.equal(scene.placeStudio('none'), false);
});

test('splitting a supporting wall rebinds a fixture on the second segment without moving it', () => {
  const { model, commands, scene } = setup(), wall = model.scene.studio!.walls[0]!.id;
  const id = commands.add('toilet', { wall, along: 300 })!, f = model.scene.studio!.fixtures!.find(f => f.id === id)!;
  const before = fixturePose(model.scene.studio!, f)!;
  assert.ok(scene.editStudio(s => splitWall(s, wall, 200)));
  const after = model.scene.studio!.fixtures!.find(f => f.id === id)!;
  assert.notDeepEqual(after.anchor, f.anchor);
  assert.deepEqual(fixturePose(model.scene.studio!, after), before);
});

test('duplicate remaps support chains and gets fresh IDs; removal protects dependent accessories', () => {
  const { model, commands } = setup(), id = commands.preset('vanity-set')!;
  assert.equal(commands.remove(id), false);
  const copy = commands.duplicate(id, true); assert.ok(copy);
  const s = model.scene.studio!, ids = s.fixtures!.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
  const group = s.fixtures!.find(f => f.id === copy)!.assembly;
  const members = s.fixtures!.filter(f => f.assembly === group);
  assert.equal(members.length, 4);
  assert.ok(members.filter(f => f.anchor.kind === 'fixture').every(f => { const a = f.anchor; return a.kind === 'fixture' && members.some(m => m.id === a.fixture); }));
  assert.ok(commands.remove(id, true)); assert.equal(model.scene.studio!.fixtures!.length, 4);
});

test('fixture solids join cabinet collision obstacles and reject intersecting fixture changes', () => {
  const { model, commands } = setup(), first = commands.add('toilet')!;
  const f = model.scene.studio!.fixtures!.find(f => f.id === first)!;
  const second = commands.add('toilet')!;
  assert.equal(commands.update(second, { anchor: f.anchor }), false);
  assert.ok(studioObstacles(model.scene.studio).some(o => o.id === 'fixture:' + first));
  assert.ok(fixtureSolids(model.scene.studio).length >= 2);
});

test('persistence rejects bad hosts, cycles, invalid dimensions, legacy version misuse and future versions', () => {
  const { model, commands } = setup(); commands.preset('vanity-set');
  const document = sceneToProject(createProject('test', 'Test'), model.scene);
  assert.throws(() => parseProject({ ...document, schemaVersion: 1 }));
  assert.throws(() => parseProject({ ...document, schemaVersion: 2 }));
  assert.throws(() => parseProject({ ...document, schemaVersion: 999 }));
  for (const patch of [{ w: -1 }, { anchor: { kind: 'fixture', fixture: 'fx1', x: 0, z: 0, lift: 0 } }, { anchor: { kind: 'wall', wall: 'missing', offset: 1, y: 0, gap: 0 } }]) {
    assert.throws(() => parseProject({ ...document, studio: { ...document.studio, fixtures: document.studio!.fixtures!.map((f, i) => i === 0 ? { ...f, ...patch } : f) } }));
  }
  assert.equal(parseProject(createProject('legacy', 'Legacy')).schemaVersion, 1);
});

test('moving a vanity assembly updates roots once and supported children follow without changing local anchors', () => {
  const { model, commands } = setup(), id = commands.preset('vanity-set')!, s = model.scene.studio!;
  const root = s.fixtures!.find(f => f.id === id)!, a = root.anchor;
  assert.equal(a.kind, 'wall'); if (a.kind !== 'wall') return;
  const before = s.fixtures!.map(f => ({ id: f.id, p: fixturePose(s, f)!, anchor: f.anchor }));
  const moved = moveFixtureAssembly(s, id, { ...a, offset: a.offset + 30 })!;
  assert.equal(commands.problem(moved), null);
  for (const f of moved.fixtures!) {
    const original = before.find(x => x.id === f.id)!;
    assert.ok(Math.abs(fixturePose(moved, f)!.x - original.p.x - 30) < .001);
    if (f.anchor.kind === 'fixture') assert.deepEqual(f.anchor, original.anchor);
  }
});

test('moving a boxed toilet assembly moves its enclosure once, leaving the bowl anchor unchanged', () => {
  const { model, commands } = setup(), id = commands.preset('toilet-boxed')!, s = model.scene.studio!;
  const f = s.fixtures![0]!, a = f.anchor;
  assert.equal(a.kind, 'enclosure'); if (a.kind !== 'enclosure') return;
  const next = moveFixtureAssembly(s, id, { ...a, offset: 20 })!;
  assert.equal(fixturePose(next, next.fixtures![0]!)!.x - fixturePose(s, f)!.x, 20);
  assert.deepEqual(next.fixtures![0]!.anchor, a);
  assert.equal(commands.problem(next), null);
});

test('toilet variant conversion removes an unused generated box and keeps the correct support configuration', () => {
  const { model, commands } = setup(), id = commands.preset('toilet-boxed')!;
  assert.ok(commands.variant(id, 'close-coupled'));
  assert.equal(model.scene.studio!.enclosures!.length, 0);
  assert.equal(model.scene.studio!.fixtures![0]!.installation, undefined);
  assert.ok(commands.variant(id, 'wall-hung'));
  assert.equal(model.scene.studio!.fixtures![0]!.installation!.h, 112);
});

test('an independent enclosure accepts multiple fixtures and is not owned by a toilet', () => {
  const { model, commands } = setup(), id = commands.addEnclosure()!;
  const e = model.scene.studio!.enclosures![0]!;
  assert.equal(e.generatedFor, undefined);
  assert.ok(commands.commit({ ...model.scene.studio!, enclosures: [{ ...e, w: 180 }] }));
  assert.ok(commands.add('toilet', { enclosure: id }));
  assert.ok(commands.add('basin', { enclosure: id }));
  assert.equal(commands.problem(model.scene.studio!), null);
});

test('fixtures appear in plans, elevations and a separate schedule without cabinet manufacturing parts', () => {
  const { model, commands } = setup(); commands.preset('toilet-boxed'); commands.preset('vanity-set');
  const sheets = technicalDrawings({ studio: model.scene.studio, pieces: [] });
  const schedule = sheets.find(s => s.title === 'Fixture & installation schedule')!;
  assert.equal(schedule.table!.rows.length, 6);
  assert.ok(sheets[0]!.views[0]!.items.some(i => i.kind === 'note' && i.lines.includes('F1')));
  assert.ok(sheets.some(s => s.title.startsWith('Elevation') && s.views.some(v => v.items.some(i => i.kind === 'note' && i.lines.some(t => t.includes('F1 · top FFL'))))));
  assert.ok(!sheets.some(s => s.title.includes('Cutting list') && s.table!.rows.length));
});

test('fixture renderers draw every catalog family, select assemblies and dispose their scene resources', () => {
  const { model, commands } = setup();
  for (const def of FIXTURE_CATALOG) assert.ok(commands.add(def.key), def.key);
  const scene = new THREE.Scene(), renderer = createFixtureViews(scene);
  renderer.sync(model.scene.studio);
  for (const f of model.scene.studio!.fixtures!) assert.ok(renderer.pickables().some(h => h.userData.studioFixture === f.id), f.kind);
  renderer.select({ kind: 'fixture', id: model.scene.studio!.fixtures![0]!.id, assembly: true });
  renderer.dispose(); assert.equal(scene.children.length, 0);
});

test('free-standing items placed against a wall remain independent and survive removing the room', () => {
  const { model, commands, scene } = setup(), id = commands.add('washer')!, f = model.scene.studio!.fixtures![0]!;
  assert.equal(f.anchor.kind, 'floor');
  const backing = fixtureWall(model.scene.studio!, f)!, before = fixturePose(model.scene.studio!, f)!;
  assert.ok(scene.editStudio(s => moveWall(s, backing.wall, -20)));
  assert.deepEqual(fixturePose(model.scene.studio!, f), before);
  assert.ok(scene.placeStudio('none'));
  assert.equal(model.scene.studio!.walls.length, 0);
  assert.equal(model.scene.studio!.fixtures![0]!.id, id);
});

test('a faucet can start on a wall, and a deck tap can stand behind a vessel on its vanity', () => {
  const { model, commands } = setup(), wallTap = commands.add('faucet')!;
  assert.equal(model.scene.studio!.fixtures!.find(f => f.id === wallTap)!.variant, 'wall');
  const vanity = commands.preset('vanity-set')!;
  const tap = model.scene.studio!.fixtures!.find(f => f.kind === 'faucet' && f.id !== wallTap)!;
  assert.ok(commands.update(tap.id, { anchor: { kind: 'fixture', fixture: vanity, x: 0, z: -15, lift: 0 } }));
});
