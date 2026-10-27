import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKitchenArrayGesture } from '../../src/presentation/editor/kitchen-array-gesture';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { kitchenSpans } from '../../src/domain/kitchen/kitchen-runs';
import { hasTrait } from '../../src/domain/wardrobe/fittings';
import type { EditorScene } from '../../src/application/projects/editor-scene';

/** A kitchen unit selected in a model, seen square on at 2 px per centimetre, with the gesture wired to fakes. */
function fixture(preset = 'oven-under') {
  const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 2, wardrobes: [
    { id: 1, name: 'Hob and oven 1', x: 0, y: 0, z: 0, angle: 0, state: { ...createKitchenDesign('base', preset), sel: 0, item: -1, divider: -1, space: null, open: false } }] };
  const model = createEditorModel(scene), checkpoints: string[] = [], toasts: string[] = [], ticks: number[] = [];
  let rebuilt = 0, finished = 0, added = 0;
  const sceneCommands = createSceneCommands(() => model.scene);
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const gesture = createKitchenArrayGesture({
    dom: {} as never, model, sceneCommands, history: { checkpoint: s => checkpoints.push(s) },
    lifetime: { timeout: (fn: () => void) => { timers.set(nextTimer, fn); return nextTimer++; }, cancelTimeout: (id: never) => { timers.delete(id); } },
    picking: { screenPoint: p => ({ x: 500 + p.x * 2, y: 400 - p.y * 2 }) },
    renderState: { Gr: new THREE.Object3D(), labs: [] },
    callbacks: { added: () => added++, rebuild: () => rebuilt++, finished: () => finished++, toast: m => toasts.push(m), tick: n => ticks.push(n) },
  });
  return { model, gesture, checkpoints, toasts, ticks, timers, counts: () => ({ rebuilt, finished, added }) };
}

test('pulling a grip adds copies as the pull passes most of a unit width, and lets them go when pulled back', () => {
  const f = fixture();
  assert.ok(f.gesture.begin(500, 400, 1));
  f.gesture.move(500 + 2 * 20, 400);
  assert.equal(f.model.scene.wardrobes.length, 1, '20 cm is not yet a copy');
  f.gesture.move(500 + 2 * 30, 400);
  assert.equal(f.model.scene.wardrobes.length, 2, '30 cm of a 60 cm unit adds one');
  f.gesture.move(500 + 2 * 100, 400);
  assert.equal(f.model.scene.wardrobes.length, 3, '100 cm adds two');
  f.gesture.move(500 + 2 * 40, 400);
  assert.equal(f.model.scene.wardrobes.length, 2, 'pulling back takes copies away');
  assert.deepEqual(f.ticks, [1, 2, 1]);
  assert.equal(f.model.scene.activeWardrobe, 1, 'the pulled unit stays selected');
  f.gesture.end();
  assert.equal(f.checkpoints.length, 1, 'one undo step for the whole pull');
  assert.equal(f.counts().added, 1, 'the view then shows the whole run');
  assert.equal((JSON.parse(f.checkpoints[0]!) as EditorScene).wardrobes.length, 1, 'undo returns to before the pull');
  assert.match(f.toasts[0]!, /1 cabinet added, with plain storage in place of the appliances/);
  const copy = f.model.scene.wardrobes[1]!;
  assert.ok(Math.abs(copy.x - 61.8) < 1e-6, 'beside the retained 18 mm separator');
  assert.ok(copy.state.secs[0]!.every(it => !hasTrait(it.k, 'appliance')), 'no hob or oven copied');
  assert.deepEqual(kitchenSpans(f.model.scene.wardrobes).filter(s => s.kind === 'worktop').map(s => s.length), [121.8], 'one worktop over both, including the retained separator');
});

test('a long press then a slide pulls copies towards the side it slides to; a cancelled pull leaves nothing', () => {
  const f = fixture('drawers');
  let started = 0;
  f.gesture.holdStart(500, 400, () => started++);
  assert.equal(f.timers.size, 1, 'the hold waits on the editor lifetime');
  const fire = [...f.timers.values()][0]!;
  f.timers.clear();
  fire();
  assert.equal(started, 1);
  assert.ok(f.gesture.active());
  f.gesture.move(500 - 2 * 5, 400);
  assert.equal(f.model.scene.wardrobes.length, 1, 'a small wobble does not choose a side');
  f.gesture.move(500 - 2 * 100, 400);
  assert.equal(f.model.scene.wardrobes.length, 3);
  assert.ok(f.model.scene.wardrobes.slice(1).every(c => c.x < 0), 'copies go left, the way it slid');
  f.gesture.end(true);
  assert.equal(f.model.scene.wardrobes.length, 1, 'cancel puts the scene back');
  assert.equal(f.checkpoints.length, 0, 'and records nothing');
  assert.equal(f.counts().added, 0, 'and leaves the view alone');
  f.gesture.holdStart(500, 400, () => started++);
  f.gesture.holdMoved(520, 400);
  assert.equal(f.timers.size, 0, 'moving off before the hold completes is an ordinary drag');
});

test('a pull with no copies records nothing; wardrobes never start a pull', () => {
  const f = fixture();
  f.gesture.begin(500, 400, -1);
  f.gesture.end();
  assert.equal(f.checkpoints.length, 0);
  const w = createEditorModel(), g = createKitchenArrayGesture({ dom: {} as never, model: w, sceneCommands: createSceneCommands(() => w.scene),
    history: { checkpoint: () => {} }, lifetime: { timeout: () => 0, cancelTimeout: () => {} }, picking: { screenPoint: () => ({ x: 0, y: 0 }) },
    renderState: { Gr: new THREE.Object3D(), labs: [] }, callbacks: { rebuild() {}, finished() {}, added() {}, toast() {}, tick() {} } });
  assert.equal(g.begin(0, 0, 1), false);
});
