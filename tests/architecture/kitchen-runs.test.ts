import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrayCount, arrayPoses, besidePose, kitchenRuns, kitchenSpans, type UnitPose } from '../../src/domain/kitchen/kitchen-runs';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { WORKTOP } from '../../src/domain/kitchen/kitchen-units';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorState } from '../../src/application/projects/editor-state';
import { hasTrait } from '../../src/domain/wardrobe/fittings';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import type { EditorCabinet, EditorScene } from '../../src/application/projects/editor-scene';
import type { KitchenUnitKey } from '../../src/domain/kitchen/kitchen-units';

const unit = (id: number, unitKey: KitchenUnitKey, x: number, z = 0, angle = 0, w = 60, preset?: string): EditorCabinet => {
  const design = createKitchenDesign(unitKey, preset);
  return { id, name: 'U' + id, x, y: unitKey === 'upper' ? 142 : 0, z, angle, state: { ...design, w, sel: 0, item: -1, divider: -1, space: null, open: false } };
};
const scene = (...wardrobes: EditorCabinet[]): EditorScene => ({ wardrobes, activeWardrobe: wardrobes[0]?.id ?? 0, nextWardrobeId: Math.max(0, ...wardrobes.map(w => w.id)) + 1 });
const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);

test('runs · touching base units share one worktop and plinth; a gap splits them', () => {
  const units = [unit(1, 'base', 0), unit(2, 'base', 60), unit(3, 'base', 120), unit(4, 'base', 300)];
  const runs = kitchenRuns(units);
  assert.deepEqual(runs.map(r => r.map(c => c.id)), [[1, 2, 3], [4]]);
  const tops = kitchenSpans(units).filter(s => s.kind === 'worktop');
  assert.equal(tops.length, 2);
  near(tops[0]!.length, 180, 'one worktop over three 60 cm units');
  near(tops[0]!.x, 60, 'centred over the run');
  near(tops[0]!.y, 86, 'on top of the units');
  near(tops[0]!.depth, 58 + WORKTOP.overhang, 'overhangs the fronts');
  near(tops[0]!.z, -29 + (58 + WORKTOP.overhang) / 2, 'flush with the backs');
  const plinths = kitchenSpans(units).filter(s => s.kind === 'plinth');
  assert.deepEqual(plinths.map(p => p.units), [[1, 2, 3], [4]]);
});

test('runs · tall units interrupt the worktop but share the plinth; wall units have neither', () => {
  const units = [unit(1, 'base', 0), unit(2, 'tall', 60), unit(3, 'base', 120), unit(4, 'upper', 0, -11.5)];
  const spans = kitchenSpans(units);
  assert.deepEqual(spans.filter(s => s.kind === 'worktop').map(s => s.units), [[1], [3]]);
  assert.deepEqual(spans.filter(s => s.kind === 'plinth').map(s => s.units), [[1, 2, 3]]);
});

test('runs · work at any angle, and units at different heights do not share a worktop', () => {
  const pose = besidePose(unit(1, 'base', 100, 50, 90), 60, 58, 1);
  const turned = [unit(1, 'base', 100, 50, 90), { ...unit(2, 'base', 0), ...pose }];
  assert.deepEqual(kitchenRuns(turned).map(r => r.map(c => c.id)), [[1, 2]]);
  near(kitchenSpans(turned).find(s => s.kind === 'worktop')!.length, 120, 'turned run');
  const tall = { ...unit(2, 'base', 60), state: { ...unit(2, 'base', 60).state, h: 90 } };
  assert.equal(kitchenSpans([unit(1, 'base', 0), tall]).filter(s => s.kind === 'worktop').length, 2);
});

test('array poses line copies up end to end, and the pull distance sets how many', () => {
  const anchor = unit(1, 'base', 0, 0, 30, 80) as UnitPose;
  const poses = arrayPoses(anchor, 3, 1), runs = kitchenRuns([anchor, ...poses.map((p, n) => ({ ...anchor, ...p, id: n + 2 }))]);
  assert.deepEqual(runs.map(r => r.length), [4]);
  assert.equal(arrayCount(0, 60), 0);
  assert.equal(arrayCount(20, 60), 0);
  assert.equal(arrayCount(30, 60), 1);
  assert.equal(arrayCount(100, 60), 2);
  assert.equal(arrayCount(10000, 60), 12);
});

test('adding units: beside the selected one, wall units above it, one undo step each', () => {
  const s = scene(unit(1, 'base', 0, 0, 0, 60, 'sink'));
  let checkpoints = 0;
  const commands = createSceneCommands(() => s, { checkpoint: () => checkpoints++ });
  const second = commands.addKitchenUnit('drawers')!;
  assert.equal(second.state.unit, 'base');
  near(second.x, 60, 'right beside it'); near(second.z, 0, 'backs in line');
  assert.equal(s.activeWardrobe, second.id, 'the new unit is selected');
  const wall = commands.addKitchenUnit('upper')!;
  near(wall.y, 142, 'hangs above the worktop'); near(wall.x, 60, 'over the selected unit');
  near(wall.z, -29 + 35 / 2, 'back against the same wall');
  const another = commands.addKitchenUnit('upper')!;
  assert.ok(Math.abs(another.x - 120) < 1e-6 || Math.abs(another.x) < 1e-6, 'next wall unit lines up with the first');
  assert.equal(checkpoints, 3);
  assert.equal(kitchenSpans(s.wardrobes).filter(x => x.kind === 'worktop').length, 1, 'the base units share one worktop');
});

test('duplicate and pull-to-array copy size and finish but never the appliance', () => {
  const s = scene(unit(1, 'base', 0, 0, 0, 80, 'cooking'));
  s.wardrobes[0]!.state.fin = 'Walnut';
  let checkpoints = 0;
  const commands = createSceneCommands(() => s, { checkpoint: () => checkpoints++ });
  assert.equal(commands.arrayKitchenUnit(3, 1), 3);
  assert.equal(checkpoints, 1, 'one undo step for the whole pull');
  assert.equal(s.wardrobes.length, 4);
  for (const copy of s.wardrobes.slice(1)) {
    assert.equal(copy.state.w, 80); assert.equal(copy.state.fin, 'Walnut');
    assert.ok(copy.state.secs[0]!.every(it => !hasTrait(it.k, 'appliance')), 'no hob or oven copied');
  }
  assert.ok(s.wardrobes[0]!.state.secs[0]!.some(it => it.k === 'oven'), 'the original keeps its oven');
  assert.deepEqual(kitchenSpans(s.wardrobes).filter(x => x.kind === 'worktop').map(x => x.length), [320], 'the worktop runs over all four');
  const copy = commands.addCabinet(true)!;
  assert.equal(copy.state.unit, 'base');
  assert.ok(copy.state.secs[0]!.every(it => !hasTrait(it.k, 'appliance')));
  assert.equal(commands.arrayKitchenUnit(0, 1), 0);
});

test('copies stop at a wall of the room and at other furniture', () => {
  const s: EditorScene = { ...scene(), studio: rectangleStudio(300, 250, 260) };
  const commands = createSceneCommands(() => s, { initialDesign: createEditorState });
  const first = commands.addKitchenUnit('base')!;
  assert.ok(first, 'a lone unit stands against a free wall');
  const count = commands.arrayKitchenUnit(40, 1) + commands.arrayKitchenUnit(40, -1);
  assert.ok(count > 0 && count < 40, 'stops at the ends of the wall');
  const blocked = { ...unit(9, 'base', 0), x: 1000 };
  const free = scene(unit(1, 'base', 0), blocked);
  const second = createSceneCommands(() => free).arrayKitchenUnit(40, 1);
  assert.equal(second, 15, 'stops before the unit 1000 cm away');
});
