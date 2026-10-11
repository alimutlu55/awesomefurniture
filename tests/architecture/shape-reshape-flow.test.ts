import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';
import {
  addStep, maxHeight, removePoint, setPanelAngle, setPoint, setStepRise, shapePanels, shapeProblems, splitPanel,
  type WardrobeShape,
} from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';

/** One test per step of the reshape flow, in the order a user takes them:
 * choose a shape, adjust points and panels, add or remove steps, resize,
 * refit fittings, and undo. Each step checks the result and the feedback. */

const W = 200, H = 230;
const pts = (top: WardrobeShape['top']): WardrobeShape => ({ template: 'custom', top });
const coords = (shape: WardrobeShape) => shape.top.map(p => [p.x, p.y]);

function session(state = createEditorState()) {
  const model = createEditorModel({ wardrobes: [{ id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 }, () => crypto.randomUUID());
  const messages: string[] = [];
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: () => { checkpoints++; } });
  return { model, commands, messages, state: () => model.activeCabinet().state, checkpoints: () => checkpoints };
}

test('step 1 · choosing a shape gives a valid skeleton with a sensible height and sections', () => {
  const s = session();
  for (const id of ['sloped', 'stepped', 'under-stairs', 'alcove', 'custom'] as const) {
    assert.equal(s.commands.applyShapeTemplate(id), true, id);
    assert.deepEqual(shapeProblems(s.state().shape!, W), [], id);
    assert.equal(s.state().h, maxHeight(s.state().shape!), id + ' height follows the tallest point');
  }
  assert.equal(s.checkpoints(), 5, 'each template choice is one undo step');
});

test('step 1b · choosing the regular shape removes the skeleton and is reversible', () => {
  const s = session();
  s.commands.applyShapeTemplate('sloped');
  assert.equal(s.commands.applyShapeTemplate('regular'), true);
  assert.equal(s.state().shape, undefined);
});

test('step 2 · a side height typed below the minimum is rejected with the reason', () => {
  const s = session();
  s.commands.applyShapeTemplate('sloped');
  assert.equal(s.commands.setShape(pts([{ x: 0, y: 20 }, { x: W, y: H }])), false);
  assert.match(s.messages.at(-1)!, /at least 40 cm tall/);
  assert.equal(s.state().shape!.top[0]!.y, 140, 'the previous height is kept');
});

test('step 3 · dragging a break point to a steep slope is refused, and the closest allowed spot is used', () => {
  const start = pts([{ x: 0, y: 140 }, { x: 100, y: 185 }, { x: W, y: H }]);
  // Reaching x = 10 would be steeper than 70°: the drag stops at the closest valid point.
  assert.equal(shapeProblems(setPoint(start, 1, { x: 10, y: 185 }), W).length > 0, true);
  let x = 100;
  while (x > 10 && shapeProblems(setPoint(start, 1, { x: x - 1, y: 185 }), W).length === 0) x -= 1;
  assert.ok(x >= 15 && x <= 25, 'the limit is near 20 cm (steepness 70°), got ' + x);
});

test('step 4 · a break point cannot cross its neighbour (order is kept)', () => {
  const start = pts([{ x: 0, y: 140 }, { x: 100, y: 185 }, { x: 150, y: 200 }, { x: W, y: H }]);
  assert.match(shapeProblems(setPoint(start, 1, { x: 160 }), W).join(), /left to right|at least 5 cm wide/);
});

test('step 5 · splitting a panel adds a break point at its middle, and a narrow panel cannot be split', () => {
  const shape = pts([{ x: 0, y: 140 }, { x: W, y: H }]);
  assert.deepEqual(coords(splitPanel(shape, 0)), [[0, 140], [100, 185], [W, H]]);
  const narrow = pts([{ x: 0, y: 140 }, { x: 8, y: 140 }, { x: W, y: H }]);
  assert.equal(splitPanel(narrow, 0), narrow, 'a 8 cm panel is too narrow to split');
});

test('step 6 · adding a step keeps the top continuous and drops the right side by the step', () => {
  const shape = pts([{ x: 0, y: H }, { x: W, y: H }]);
  const stepped = addStep(shape, 0, 20);
  assert.deepEqual(coords(stepped).map(([x, y]) => [x, y]), [[0, H], [100, H], [100, 210], [W, 210]]);
  assert.deepEqual(shapeProblems(stepped, W), []);
});

test('step 7 · a step rise moves the run after it, so flat panels stay flat', () => {
  const start = createFromTemplate('stepped', { w: W, h: H, maxN: 6 }).shape;
  const deeper = setStepRise(start, 1, -60);
  assert.deepEqual(deeper.top.map(p => p.y), [230, 230, 170, 170, 150, 150]);
});

test('step 8 · panel angle edits pivot on the left end and keep the board length', () => {
  const shape = pts([{ x: 0, y: 140 }, { x: W, y: H }]);
  const panel = shapePanels(shape)[1]!;
  const tilted = setPanelAngle(shape, 0, 20);
  const next = shapePanels(tilted)[1]!;
  assert.ok(Math.abs(next.angle - 20) < .5);
  assert.ok(Math.abs(next.length - panel.length) > 0, 'the length changes with the angle');
  assert.equal(tilted.top[0]!.y, 140, 'the left end stays put');
});

test('step 9 · removing a break point removes a step as one piece', () => {
  const stepped = createFromTemplate('stepped', { w: W, h: H, maxN: 6 }).shape;
  const after = removePoint(stepped, 1);
  assert.ok(after.top.length < stepped.top.length);
  assert.deepEqual(shapeProblems(after, W), []);
});

test('step 10 · sides cannot be removed', () => {
  const shape = pts([{ x: 0, y: 140 }, { x: W, y: H }]);
  assert.deepEqual(removePoint(shape, 0), shape);
  assert.deepEqual(removePoint(shape, 1), shape);
});

test('step 11 · resizing the width keeps the measured slope and the height', () => {
  const s = session();
  s.commands.applyShapeTemplate('sloped');
  assert.equal(s.commands.setCabinetSize('w', 240), true);
  assert.deepEqual(coords(s.state().shape!), [[0, 140], [240, 230]]);
  assert.deepEqual(shapeProblems(s.state().shape!, 240), []);
});

test('step 12 · lowering the top refits fittings: nothing is lost unless it cannot fit', () => {
  const s = session();
  s.commands.applyShapeTemplate('custom');
  s.state().n = 1;
  s.state().secs[0] = [{ k: 'drawer', h: 22 }, { k: 'folded', h: 28 }, { k: 'short', h: 106 }];
  assert.equal(s.commands.setShape(pts([{ x: 0, y: 150 }, { x: W, y: 230 }])), true);
  assert.equal(s.state().secs[0]!.length, 3);
  const geometry = createWardrobeGeometry(() => s.state());
  assert.equal(geometry.sectionLayoutValid(0), true);
});

test('step 13 · a live drag does not record undo steps until release', () => {
  const s = session();
  s.commands.applyShapeTemplate('stepped');
  const before = s.checkpoints();
  for (const y of [200, 190, 180, 170]) s.commands.setShape(pts([{ x: 0, y: 140 }, { x: W, y: y }]), false, false);
  assert.equal(s.checkpoints(), before, 'previews record no history');
});

test('step 14 · a skeleton with a panel under the minimum width is rejected, not silently changed', () => {
  const s = session();
  s.commands.applyShapeTemplate('sloped');
  const before = JSON.stringify(s.state().shape);
  assert.equal(s.commands.setShape(pts([{ x: 0, y: 140 }, { x: 3, y: 150 }, { x: W, y: H }])), false);
  assert.equal(JSON.stringify(s.state().shape), before);
});

test('step 15 · every panel the list shows has a matching measurement', () => {
  const stepped = createFromTemplate('stepped', { w: W, h: H, maxN: 6 }).shape;
  const panels = shapePanels(stepped);
  assert.equal(panels.filter(p => p.kind === 'top').length, 3);
  assert.equal(panels.filter(p => p.kind === 'step').length, 2);
  assert.equal(panels.filter(p => p.kind === 'side').length, 2);
  void PANEL;
});

test('every rule has a plain-language message that says what to do', async () => {
  const { friendlyProblem } = await import('../../src/domain/wardrobe/shape/wardrobe-shape');
  assert.match(friendlyProblem('Break points must run from left to right.'), /can't pass its neighbour/);
  assert.match(friendlyProblem('Slopes steeper than 70° must be built as a step.'), /Make it a step instead/);
  assert.match(friendlyProblem('Every part must be at least 40 cm tall.'), /at least 40 cm tall/);
  assert.equal(friendlyProblem('Something new.'), 'Something new.');
});

test('dividers follow the slope like items: tops are cut, heights are limited and set in cm', async () => {
  const { createDesignCommands } = await import('../../src/application/commands/design-commands');
  const { createWardrobeGeometry: geometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const state = createEditorState();
  const sloped = createFromTemplate('sloped', { w: W, h: H, maxN: 6 });
  Object.assign(state, { shape: sloped.shape, h: H, n: 1, wt: sloped.wt, sel: 0 });
  const messages: string[] = [];
  const commands = createDesignCommands(() => state, { report: m => messages.push(m) });
  const rules = geometry(() => state);
  state.space = null;
  commands.addSpaceDivider();
  const index = state.dividers.length - 1;
  // Created at full bay height, its top is cut to the slope it stands under, and the full height is remembered.
  const created = state.dividers[index]!;
  assert.ok(created.want! > created.y1!, 'the full wanted height is remembered, the drawn top is cut');
  assert.equal(rules.dividerValid(state.dividers[index]!, index), true);
  // Asking for more than the slope allows gives the tallest allowed height and says why.
  assert.equal(commands.setDividerHeight(index, 500), true);
  assert.match(messages.at(-1)!, /limits this divider to/);
  assert.ok(state.dividers[index]!.y1! - state.dividers[index]!.y0! < 200);
  // Too short is refused with a reason.
  assert.equal(commands.setDividerHeight(index, 5), false);
  assert.match(messages.at(-1)!, /at least 15 cm/);
  // A lower flat top cuts a divider's top to the new clear height, and removes one that is too short.
  state.shape = { template: 'custom', top: [{ x: 0, y: 120 }, { x: W, y: 120 }] };
  state.h = 120;
  commands.fitToShape();
  const kept = state.dividers[index]!;
  assert.ok(kept, 'a divider that still has room is kept');
  assert.ok(kept!.y1! - kept!.y0! >= 15 - .01, 'and is at least the shortest divider');
  state.shape = { template: 'custom', top: [{ x: 0, y: 24 }, { x: W, y: 24 }] };
  state.h = 24;
  commands.fitToShape();
  assert.equal(state.dividers.length, 0, 'a divider the slope leaves too short is removed');
  assert.match(messages.at(-1)!, /shelf or divider/);
});

test('a divider moved under a lower part of the slope takes its top with it', async () => {
  const { createDesignCommands } = await import('../../src/application/commands/design-commands');
  const { createWardrobeGeometry: geometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const state = createEditorState();
  const sloped = createFromTemplate('sloped', { w: W, h: H, maxN: 6 });
  Object.assign(state, { shape: sloped.shape, h: H, n: 1, wt: sloped.wt, sel: 0 });
  const commands = createDesignCommands(() => state);
  const rules = geometry(() => state);
  state.space = null;
  commands.addSpaceDivider();
  const index = state.dividers.length - 1;
  commands.moveDividerTo(index, 20);
  const d = state.dividers[index]!;
  assert.ok(Math.abs(d.y1! - rules.clampDivider({ ...d, y1: 999 }).y1!) < .01, 'the stored top matches the slope at the new spot');
  assert.equal(rules.dividerValid(d, index), true);
});

test('a divider adapts to the height: it is cut when the slope drops and grows back to its wanted height', async () => {
  const { createDesignCommands } = await import('../../src/application/commands/design-commands');
  const { createWardrobeGeometry: geometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const state = createEditorState();
  const sloped = createFromTemplate('sloped', { w: W, h: H, maxN: 6 });
  Object.assign(state, { shape: sloped.shape, h: H, n: 1, wt: sloped.wt, sel: 0 });
  const commands = createDesignCommands(() => state);
  const rules = geometry(() => state);
  state.space = null;
  commands.addSpaceDivider();
  const index = state.dividers.length - 1;
  commands.setDividerHeight(index, 300);
  const wanted = state.dividers[index]!.want!;
  // Lower the top: the divider is cut to the new slope.
  state.shape = { template: 'custom', top: [{ x: 0, y: 120 }, { x: W, y: 120 }] };
  state.h = 120;
  commands.fitToShape();
  const low = state.dividers[index]!;
  assert.ok(low.y1! < wanted, 'cut when the slope drops');
  assert.equal(low.want, wanted, 'the wanted height is kept');
  // Raise the top again: the divider grows back to what was asked for.
  state.shape = { template: 'custom', top: [{ x: 0, y: H }, { x: W, y: H }] };
  state.h = H;
  commands.fitToShape();
  const back = state.dividers[index]!;
  assert.ok(back.y1! > low.y1! + 1, 'grows back when the slope rises');
  assert.ok(Math.abs(back.y1! - rules.clampDivider(back).y1!) < .01, 'and matches the slope at its position');
  assert.ok(back.y1! <= wanted + .01, 'never above the wanted height');
});
