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
  const design = createKitchenDesign(unitKey, preset === 'sink' ? undefined : preset);
  // A base cabinet that holds a sink fitting (a sink on its own is a fixture unit: see kitchen.test.ts).
  if (preset === 'sink') design.secs[0] = [{ k: 'sink', h: 74.4 }];
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
  const s = scene(unit(1, 'base', 0, 0, 0, 80, 'oven-under'));
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
  assert.equal(commands.arrayKitchenUnit(1, 1), 1, 'pulling the same side again continues after the copies');
  assert.equal(commands.arrayKitchenUnit(1, -1), 1, 'and the other side starts before the run');
  assert.deepEqual(s.wardrobes.map(c => c.x).sort((a, b) => a - b), [-80, 0, 80, 160, 240, 320]);
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

test('the Storage panel counts the whole kitchen along the wall and says what it still lacks', async () => {
  const { kitchenStorage } = await import('../../src/domain/kitchen/kitchen-storage');
  const units = [unit(1, 'base', 0, 0, 0, 60, 'sink'), unit(2, 'base', 60, 0, 0, 60, 'drawers'), unit(3, 'tall', 120, 0, 0, 60, 'fridge'), unit(4, 'upper', 0, -11.5, 0, 60, 'upper'), unit(9, 'base', 0, 400)];
  const s = kitchenStorage(units, units[1]!);
  assert.equal(s.drawers, 3);
  assert.equal(s.doors, 1, 'the fridge housing cupboard; the sink and fridge fronts are appliances');
  assert.deepEqual(s.appliances, ['Sink and tap', 'Integrated fridge']);
  assert.equal(s.worktop, 120, 'the worktop stops at the tall unit');
  assert.deepEqual(s.units, { base: 2, upper: 1, tall: 1, 'sink-top': 0, 'hob-top': 0 }, 'a unit on another wall is another kitchen');
  assert.deepEqual(s.notes, ['No hob yet: add one from Sinks and appliances, then place it on the worktop.', '1 cabinet is still empty: select a space and use Add item.']);
});

test('Reset keeps a kitchen cabinet a cabinet: an empty unit of its kind at its standard size', () => {
  const s = scene(unit(1, 'upper', 0, -11.5, 0, 90, 'upper'));
  s.wardrobes[0]!.state.secs[0] = [{ k: 'flap', h: 30 }];
  let checkpoints = 0;
  assert.equal(createSceneCommands(() => s, { checkpoint: () => checkpoints++ }).resetCabinet(), true);
  const state = s.wardrobes[0]!.state;
  assert.deepEqual([state.product, state.unit, state.w, state.h, state.d, state.secs[0]!.length], ['kitchen', 'upper', 60, 70, 35, 0]);
  assert.equal(checkpoints, 1);
});

test('Add furniture puts a cabinet against the wall in view, in front of the viewer; a cabinet\'s own Add joins it', async () => {
  const { standsAgainst } = await import('../../src/domain/studio/studio-placement');
  const { wallFace, wallLine } = await import('../../src/domain/studio/studio');
  const room = rectangleStudio(400, 300, 260), s: EditorScene = { ...scene(), studio: room };
  const commands = createSceneCommands(() => s, { initialDesign: createEditorState });
  const along = (c: EditorCabinet, id: string) => { const l = wallLine(room, room.walls.find(w => w.id === id)!)!; return (c.x - l.a.x) * l.ux + (c.z - l.a.z) * l.uz; };
  const [first, second] = [room.walls[0]!, room.walls[2]!], face = wallFace(room, first)!;
  const target = face.start + 80;
  const a = commands.addKitchenUnit('base', { placementWall: first.id, placementAlong: target })!;
  assert.ok(standsAgainst(room, first.id, a, a.state), 'on the wall in view');
  near(along(a, first.id), target, 'at the point in view, not the middle of the wall');
  const b = commands.addKitchenUnit('base', { placementWall: second.id, placementAlong: wallFace(room, second)!.start + 200 })!;
  assert.ok(standsAgainst(room, second.id, b, b.state), 'looking at another wall puts it there, not beside the last kitchen');
  const c = commands.addKitchenUnit('drawers', { placementWall: first.id, placementAlong: face.end - 40 })!;
  assert.ok(standsAgainst(room, first.id, c, c.state));
  near(Math.abs(along(c, first.id) - along(a, first.id)), 60, 'a kitchen already on the wall in view is joined');
  s.activeWardrobe = a.id;
  const d = commands.addKitchenUnit('base', { placementWall: second.id, beside: true })!;
  assert.ok(standsAgainst(room, first.id, d, d.state), 'a cabinet\'s own Add stands beside it whatever is in view');
});

test('dragging a unit to a neighbour: a front almost in line does not stop it closing the gap', () => {
  // The second unit stands 3 cm from the first and 0.4 cm out of line: both snaps apply, not just the smaller one.
  const s = scene(unit(1, 'base', 0), { ...unit(2, 'base', 63), z: 0.4 });
  const commands = createSceneCommands(() => s);
  const pose = commands.alignSnap(s.wardrobes[1]!, 6);
  near(pose.x, 60, 'touching the first unit'); near(pose.z, 0, 'and its front in line');
  // Pressed to a wall (depth = false) the unit keeps the wall's line and only closes the gap.
  const wall = commands.alignSnap(s.wardrobes[1]!, 6, false);
  near(wall.x, 60, 'touching'); near(wall.z, 0.4, 'depth left to the wall');
});

test('a gap between two kitchen units is filled by widening the unit between them, whatever the split', () => {
  // 2.4 cm to the unit on one side and 2.6 cm to the one on the other: neither a centred nor a one-sided growth fits.
  const s = scene({ ...unit(1, 'base', 62.4), id: 1 }, unit(2, 'base', 0), unit(3, 'base', 125));
  s.activeWardrobe = 1;
  let checkpoints = 0;
  const commands = createSceneCommands(() => s, { checkpoint: () => checkpoints++ });
  near(commands.fillableSpace(), 5, 'the room beside it');
  assert.equal(commands.fillSpace(), true);
  const middle = s.wardrobes[0]!;
  near(middle.state.w, 65, 'as wide as the room');
  near(middle.x, 62.5, 'between its neighbours');
  assert.equal(checkpoints, 1, 'one undo step');
  assert.equal(kitchenRuns(s.wardrobes).length, 1, 'the three units are one run again');
  assert.equal(commands.fillSpace(), false, 'nothing left to fill');
  assert.equal(createSceneCommands(() => scene(unit(1, 'base', 0))).fillableSpace(), 0, 'a lone unit has no gap beside it');
});

test('a unit put against a neighbour stays there however far out the view is zoomed', () => {
  // Touching the unit on its left, 4 cm from the one on its right: the snap tolerance grows as the view zooms out
  // (it is a number of screen pixels), and touching the right one would have pulled it away from the left.
  const s = scene(unit(1, 'base', -60), unit(2, 'base', 0), unit(3, 'base', 64));
  s.activeWardrobe = 2;
  const commands = createSceneCommands(() => s);
  for (const tolerance of [0.5, 1, 3, 6, 15]) {
    const pose = commands.alignSnap(s.wardrobes[1]!, tolerance);
    near(pose.x, 0, `x at tolerance ${tolerance}`);
  }
  // Still snaps to touch a neighbour when it is not touching anything.
  const free = scene(unit(1, 'base', 0), unit(2, 'base', 63));
  near(createSceneCommands(() => free).alignSnap(free.wardrobes[1]!, 6).x, 60, 'closes a free gap');
});

test('tapping + at the end of a run closes a gap too small for a cabinet by widening that unit', () => {
  // Two base units 12 cm apart: too little for the narrowest (30 cm) cabinet, so the unit grows into it.
  const s = scene(unit(1, 'base', 0), unit(2, 'base', 72));
  let checkpoints = 0, discarded = 0;
  const commands = createSceneCommands(() => s, { checkpoint: () => checkpoints++, discardCheckpoint: () => discarded++ });
  assert.equal(commands.closeRunGap(1), true);
  assert.equal(s.wardrobes[0]!.state.w, 72, 'grew by the gap');
  near(s.wardrobes[0]!.x, 6, 'the far side stays where it was');
  assert.equal(checkpoints, 1); assert.equal(discarded, 0);
  assert.equal(commands.closeRunGap(1), false, 'nothing left to close');
  // 35 cm is still too little for a sensible cabinet (under 40): closed too.
  const corner = scene(unit(1, 'base', 0), unit(2, 'base', 95));
  assert.equal(createSceneCommands(() => corner, { checkpoint: () => {} }).closeRunGap(1), true);
  assert.equal(corner.wardrobes[0]!.state.w, 95);
  // Room for a cabinet (40 cm or more) is not closed: the + adds one instead, as wide as the room allows when a whole copy does not fit.
  const wide = scene(unit(1, 'base', 0), unit(2, 'base', 105));
  const wideCommands = createSceneCommands(() => wide, { checkpoint: () => {} });
  assert.equal(wideCommands.closeRunGap(1), false);
  assert.equal(wide.wardrobes[0]!.state.w, 60);
  assert.equal(wideCommands.arrayKitchenUnit(1, 1), 0, 'a whole copy does not fit in 45 cm');
  const narrow = wideCommands.fitUnitInGap(1)!;
  assert.ok(narrow.state.w >= 44 && narrow.state.w <= 45, 'a copy made to fit the 45 cm room (' + narrow.state.w + ')');
  near(narrow.x, 30 + narrow.state.w / 2, 'right beside it');
  assert.ok(wideCommands.fitUnitInGap(1)!.x > 105, 'the filled gap joins the run: the next goes beyond its end');
  // A gap the unit cannot grow across (past its widest) is left.
  const big = scene({ ...unit(1, 'base', 0), state: { ...unit(1, 'base', 0).state, w: 140 } }, unit(2, 'base', 160));
  assert.equal(createSceneCommands(() => big, { checkpoint: () => {} }).closeRunGap(1), false);
});
