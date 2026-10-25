import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { POSSESSIONS } from '../../src/domain/wardrobe/possessions';
import { PERSONAS, SPACES, countBelongings, personaBelongings, shareBelongings, spaceSpec } from '../../src/presentation/experience/spaces';
import { assemblyApproach, assemblyPhase, createAssemblyMotion, explodedOffset } from '../../src/presentation/viewport/assembly-motion';
import { dollyZoom } from '../../src/presentation/viewport/workshop-lens';
import { stageShift } from '../../src/presentation/experience/stage-framing';
import { fitSummary } from '../../src/presentation/experience/reveal';
import { createSceneLooks, surfaceLook } from '../../src/presentation/viewport/scene-looks';
import { TIMES_OF_DAY, lampSpots } from '../../src/presentation/viewport/daylight';
import { MIDDAY_LIGHT } from '../../src/presentation/viewport/scene-lighting';
import { readPreferences } from '../../src/presentation/experience/preferences';
import { projectToScene } from '../../src/application/projects/editor-mapper';

test('every space in the welcome builds, previewed empty and planned for everyday belongings', () => {
  const belongings = personaBelongings('everyday');
  for (const space of SPACES) {
    const preview = buildFromSpec(spaceSpec(space), 'preview');
    assert.ok(preview.ok, `${space.id} previews: ${JSON.stringify(!preview.ok && preview.problems)}`);
    const built = buildFromSpec(spaceSpec(space, belongings), 'built');
    assert.ok(built.ok, `${space.id} builds: ${JSON.stringify(!built.ok && built.problems)}`);
    assert.equal(built.report.wardrobes.length, space.wardrobes.length);
    const held = built.report.wardrobes.reduce((sum, w) => sum + Object.values(w.holds).reduce((s, h) => s + Math.min(h.asked, h.holds), 0), 0);
    assert.ok(held > countBelongings(belongings) * .6, `${space.id} holds most of what was counted (${held})`);
  }
});

test('belongings start from a way of living within every possession’s limits, and share out exactly', () => {
  for (const persona of PERSONAS) {
    const b = personaBelongings(persona.id);
    for (const p of POSSESSIONS) assert.ok(b[p.key]! >= 0 && b[p.key]! <= p.need.max, `${persona.id} ${p.key}`);
  }
  const b = personaBelongings('two'), parts = shareBelongings(b, [.62, .38]);
  for (const p of POSSESSIONS) assert.equal(parts[0]![p.key]! + parts[1]![p.key]!, b[p.key], p.key);
  assert.equal(countBelongings({ a: 2, b: -1, c: 3 }), 5);
});

test('parts go in as a cabinetmaker builds, and come apart without going into the floor or the wall', () => {
  assert.equal(assemblyPhase({ x: -.98, y: .5, z: 0, w: .02, h: .98, d: 1 }), 'side');
  assert.equal(assemblyPhase({ x: 0, y: .5, z: -.97, w: .98, h: .95, d: .02 }), 'back');
  assert.equal(assemblyPhase({ x: 0, y: .04, z: 0, w: .98, h: .05, d: 1 }), 'base');
  assert.equal(assemblyPhase({ x: 0, y: .98, z: 0, w: .98, h: .02, d: 1 }), 'top');
  assert.equal(assemblyPhase({ x: .3, y: .5, z: .2, w: .25, h: .02, d: .9 }), 'fitting');
  assert.equal(assemblyPhase({ x: .3, y: .5, z: .9, w: .25, h: .9, d: .02 }, true), 'door');
  assert.ok(assemblyApproach('side', { x: -.98, y: .5, z: 0, w: .02, h: .98, d: 1 })[0] < 0, 'a left side swings in from the left');
  assert.ok(assemblyApproach('top', { x: 0, y: .98, z: 0, w: 1, h: .02, d: 1 })[1] > 0, 'the top drops from above');
  assert.ok(assemblyApproach('fitting', { x: 0, y: .5, z: 0, w: .3, h: .02, d: .9 })[2] > 0, 'shelves slide in from the front');
  for (const place of [{ x: 0, y: 0, z: -1, w: 1, h: .05, d: 1 }, { x: 0, y: .5, z: -1, w: 1, h: 1, d: .02 }, { x: .9, y: .2, z: .8, w: .1, h: .2, d: .1 }]) {
    const [, y, z] = explodedOffset(place, 1, { w: 200, h: 230, d: 60 });
    assert.ok(y >= 0 && z >= 0, `taken apart, ${JSON.stringify(place)} stays out of the floor and the wall`);
  }
});

test('assembly lands every part exactly where it rests, and putting an exploded wardrobe together restores it', () => {
  let now = 0;
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const parts = [[-99, 115, 0, 2, 230, 60], [99, 115, 0, 2, 230, 60], [0, 2, 0, 200, 4, 60], [0, 228, 0, 200, 4, 60], [0, 120, 0, 196, 2, 56]]
    .map(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x!, y!, z!); group.add(m); return m; });
  group.position.set(40, 0, -20); group.rotation.y = .7;
  const rest = parts.map(p => p.position.clone()), motion = createAssemblyMotion({ clock: { now: () => now } });
  let landed = 0, done = false;
  void motion.play([group], { seconds: 2, onLand: () => landed++ }).then(() => { done = true; });
  assert.ok(parts.some(p => !p.visible), 'parts wait out of sight for their turn');
  for (now = 0; now < 5000; now += 16) motion.frame();
  assert.equal(landed, parts.length);
  parts.forEach((p, k) => { assert.ok(p.position.equals(rest[k]!), `part ${k} rests where it was`); assert.ok(p.visible); });
  assert.equal(motion.busy(), false);
  motion.explode([group], .8);
  assert.ok(parts.some((p, k) => !p.position.equals(rest[k]!)), 'taken apart');
  motion.explode([group], 0);
  parts.forEach((p, k) => assert.ok(p.position.equals(rest[k]!), `part ${k} back together`));
  return Promise.resolve().then(() => assert.ok(done));
});

test('the workshop lens keeps the design its size while it flattens into an elevation', () => {
  assert.deepEqual(dollyZoom(0), { factor: 1, fov: 35 });
  for (const amount of [.25, .5, 1]) {
    const { factor, fov } = dollyZoom(amount);
    assert.ok(Math.abs(Math.tan(fov * Math.PI / 360) * factor - Math.tan(35 * Math.PI / 360)) < 1e-9);
  }
  assert.equal(dollyZoom(1).factor, 6);
});

test('the design moves clear of a sheet: right of a side sheet, above a bottom sheet', () => {
  assert.deepEqual(stageShift({ width: 1440, height: 900 }, null), { x: 0, y: 0, zoom: 1 });
  const side = stageShift({ width: 1440, height: 900 }, { left: 16, right: 484, top: 16, height: 868 });
  assert.ok(side.x > 200 && side.y === 0 && side.zoom < 1);
  const bottom = stageShift({ width: 375, height: 812 }, { left: 8, right: 367, top: 320, height: 484 });
  assert.ok(bottom.y > 200 && bottom.x === 0 && bottom.zoom >= .5);
});

test('the reveal counts what has a place across wardrobes', () => {
  const holds = (asked: number, h: number) => ({ asked, holds: h });
  const report = { wardrobes: [{ holds: { short: holds(10, 12), shoes: holds(4, 4) } }, { holds: { short: holds(6, 3) } }] } as never;
  const s = fitSummary(report);
  assert.equal(s.asked, 20);
  assert.equal(s.placed, 19);
  assert.equal(s.all, false);
  assert.deepEqual(s.short.map(r => r.possession.key), ['short']);
  assert.equal(fitSummary({ wardrobes: [{ holds: { shoes: holds(4, 9) } }] } as never).spare, 5);
});

test('looks change surfaces in place and put every one back exactly', () => {
  assert.equal(surfaceLook('living', { tone: .5, board: true }), null);
  assert.equal(surfaceLook('maquette', { tone: .5, board: true })!.lit, true);
  assert.equal(surfaceLook('workshop', { tone: .5, board: false })!.lit, false);
  const scene = new THREE.Scene(), map = new THREE.Texture(), shader = () => {}, key = () => 'board';
  const board = new THREE.MeshStandardMaterial({ color: 0x8a6a40, map, roughness: .4, envMapIntensity: .3 });
  board.userData.board = true; board.onBeforeCompile = shader; board.customProgramCacheKey = key; board.toneMapped = false;
  const ao = new THREE.MeshBasicMaterial({ map: new THREE.Texture() });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2), board), new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ao));
  const before = { color: board.color.getHex(), roughness: board.roughness, env: board.envMapIntensity };
  const looks = createSceneLooks({ scene, shading: m => m === ao });
  looks.set({ look: 'workshop' });
  assert.equal(board.map, null);
  assert.notEqual(board.onBeforeCompile, shader, 'the board’s own shader steps aside');
  assert.equal(ao.visible, false, 'painted shading steps aside');
  assert.ok(scene.children[0]!.children.some(c => c.userData.lookEdge), 'edges are drawn');
  looks.set({ look: 'maquette', env: .5 });
  looks.set({ look: 'living', env: 1, emissive: 1 });
  assert.equal(board.map, map);
  assert.equal(board.onBeforeCompile, shader);
  assert.equal(board.customProgramCacheKey, key);
  assert.equal(board.toneMapped, false);
  assert.deepEqual({ color: board.color.getHex(), roughness: board.roughness, env: board.envMapIntensity }, before);
  assert.equal(ao.visible, true);
  assert.ok(!scene.children[0]!.children.length, 'edges are gone');
  looks.dispose();
});

test('the day starts from the editor’s own light, and each section gets a light under its top', () => {
  assert.equal(TIMES_OF_DAY[0].light, MIDDAY_LIGHT);
  assert.equal(new Set(TIMES_OF_DAY.map(t => t.id)).size, TIMES_OF_DAY.length);
  const built = buildFromSpec(spaceSpec(SPACES.find(s => s.id === 'attic')!), 'lamps');
  assert.ok(built.ok);
  const scene = projectToScene(built.ok ? built.project : null as never)!;
  for (const cabinet of scene.wardrobes) {
    const spots = lampSpots(cabinet), state = cabinet.state;
    assert.ok(spots.length >= 1);
    for (const s of spots) {
      assert.ok(Math.abs(s.x) + s.width / 2 <= state.w / 2 + .01, 'inside the width');
      assert.ok(s.y < state.h && s.y > 20, 'under the top, which slopes here');
    }
  }
});

test('preferences start from their defaults when storage is unavailable', () => {
  const thrower = () => { throw new Error('blocked'); };
  assert.deepEqual(readPreferences(thrower as never), { look: 'living', time: 'midday', sounds: true, welcomed: false });
  assert.deepEqual(readPreferences(() => ({ getItem: () => '{"look":"maquette"}' }) as never).look, 'maquette');
});
