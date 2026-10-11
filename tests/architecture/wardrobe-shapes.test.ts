import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL, PLINTH } from '../../src/domain/wardrobe/catalog.js';
import {
  addStep, ceilingMax, ceilingMin, ceilingPieces, fitSpans, isRegularShape, maxHeight, minimumShapeHeight, partitionPositions,
  removePoint, resizeShape, resolveShape, setPanelAngle, setPoint, setStepRise, shapeBoards, shapePanels, shapeProblems, splitPanel,
  type WardrobeShape,
} from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { SHAPE_TEMPLATES, createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorState } from '../../src/application/projects/editor-scene';
import { projectToScene, sceneDesignKey, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, parseProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

const BASE = PLINTH + PANEL;
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const sloped: WardrobeShape = { template: 'sloped', top: [{ x: 0, y: 140 }, { x: 200, y: 230 }] };
function design(shape?: WardrobeShape, patch: Partial<EditorState> = {}): EditorState {
  const s = createEditorState();
  return Object.assign(s, shape ? { shape, h: maxHeight(shape) } : {}, patch);
}
function scene(state: EditorState) {
  const model = createEditorModel({ wardrobes: [{ id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 }, () => crypto.randomUUID());
  const messages: string[] = [];
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: () => { checkpoints++; } });
  return { model, commands, messages, state: () => model.activeCabinet().state, checkpoints: () => checkpoints };
}

test('every template is a valid skeleton in the shared model at common sizes', () => {
  for (const template of SHAPE_TEMPLATES) {
    for (const [w, h] of [[200, 230], [120, 200], [320, 260], [80, 180]] as const) {
      const start = createFromTemplate(template.id, { w, h, maxN: Math.max(1, Math.min(6, Math.floor((w - PANEL) / (25 + PANEL)))) });
      const resolved = resolveShape({ w, h, n: start.n, wt: start.wt, shape: start.shape });
      assert.deepEqual(shapeProblems(resolved, w), [], `${template.id} ${w}×${h}`);
      assert.equal(resolved.top[0]!.x, 0);
      assert.equal(resolved.top[resolved.top.length - 1]!.x, w);
    }
  }
});

test('a sloped top board drops by its true thickness and the clear height is exact', () => {
  const pieces = ceilingPieces(sloped), m = 90 / 200, t = PANEL * Math.sqrt(1 + m * m);
  close(ceilingMin(pieces, PANEL, PANEL), 140 + m * PANEL - t);
  close(ceilingMax(pieces, PANEL, 200 - PANEL), 140 + m * (200 - PANEL) - t);
  // A 180 cm tall item above the base clears the slope only right of the exact crossing.
  const [span] = fitSpans(pieces, PANEL, 200 - PANEL, BASE + 180);
  close(span!.x0, (BASE + 180 + t - 140) / m);
  close(span!.x1, 200 - PANEL);
});

test('steps place a riser board on their higher side and anchored steps follow partitions', () => {
  const start = createFromTemplate('stepped', { w: 200, h: 230, maxN: 6 });
  const state = { w: 200, h: 230, n: start.n, wt: start.wt, shape: start.shape };
  const resolved = resolveShape(state), [p0] = partitionPositions(state);
  const risers = shapeBoards(resolved).filter(b => b.kind === 'riser');
  assert.equal(risers.length, 2);
  // The first riser is the partition board continued upwards.
  close(risers[0]!.points[0]!.x, p0!);
  close(risers[0]!.points[1]!.x, p0! + PANEL);
  // Clear height steps down exactly at the partition.
  const pieces = ceilingPieces(resolved);
  close(ceilingMin(pieces, p0! - 1, p0!), 230 - PANEL);
  close(ceilingMin(pieces, p0!, p0! + PANEL), resolved.top[2]!.y - PANEL);
  // Moving the partition (new weights) moves the anchored step with it.
  const moved = resolveShape({ ...state, wt: [140, 80, 80, 100, 100, 100] });
  assert.notEqual(moved.top[1]!.x, resolved.top[1]!.x);
  close(moved.top[1]!.x, partitionPositions({ ...state, wt: [140, 80, 80, 100, 100, 100] })[0]! + PANEL);
});

test('invalid geometry is rejected with a reason', () => {
  const problems = (top: WardrobeShape['top'], w = 200) => shapeProblems({ template: 'custom', top }, w);
  assert.match(problems([{ x: 0, y: 30 }, { x: 200, y: 230 }]).join(), /at least 40 cm/);
  assert.match(problems([{ x: 0, y: 230 }, { x: 150, y: 230 }]).join(), /full wardrobe width/);
  assert.match(problems([{ x: 0, y: 230 }, { x: 120, y: 230 }, { x: 100, y: 200 }, { x: 200, y: 200 }]).join(), /left to right/);
  assert.match(problems([{ x: 0, y: 60 }, { x: 20, y: 230 }, { x: 200, y: 230 }]).join(), /steeper than 70°/);
  assert.match(problems([{ x: 0, y: 230 }, { x: 0, y: 200 }, { x: 200, y: 200 }]).join(), /side panel/);
  assert.match(problems([{ x: 0, y: 230 }, { x: 100, y: 230 }, { x: 100, y: 229.5 }, { x: 200, y: 229.5 }]).join(), /rise at least/);
  assert.match(problems([{ x: 0, y: 230 }, { x: 102, y: 230 }, { x: 104, y: 230 }, { x: 200, y: 230 }]).join(), /at least 5 cm wide/);
  // The lowest allowed top still leaves usable clear height above the base board.
  assert.deepEqual(problems([{ x: 0, y: 40 }, { x: 200, y: 40 }]), []);
  assert.deepEqual(problems(sloped.top), []);
});

test('panel edits are pure and keep measured geometry', () => {
  const original = structuredClone(sloped);
  const split = splitPanel(sloped, 0);
  assert.deepEqual(sloped, original);
  assert.deepEqual(split.top.map(p => [p.x, p.y]), [[0, 140], [100, 185], [200, 230]]);
  const level = setPanelAngle(split, 1, 0);
  assert.equal(level.top[2]!.y, 185);
  const stepped = addStep(level, 1, 20);
  assert.deepEqual(stepped.top.map(p => [p.x, p.y]), [[0, 140], [100, 185], [150, 185], [150, 165], [200, 165]]);
  assert.deepEqual(removePoint(stepped, 3).top.map(p => [p.x, p.y]), [[0, 140], [100, 185], [200, 165]]);
  // A step's rise moves the run after it up to the next step, keeping flat panels flat.
  const stairs = createFromTemplate('stepped', { w: 200, h: 230, maxN: 6 }).shape;
  const deeper = setStepRise(stairs, 1, -60);
  assert.deepEqual(deeper.top.map(p => p.y), [230, 230, 170, 170, 150, 150]);
  // Editing a step's position releases it from its partition.
  assert.equal(setPoint(stairs, 1, { x: 90 }).top[2]!.partition, undefined);
  assert.equal(setPoint(stairs, 1, { x: 90 }).top[2]!.x, 90);
  const panels = shapePanels(sloped);
  assert.deepEqual(panels.map(p => p.label), ['Left side', 'Top panel', 'Right side']);
  close(panels[1]!.length, Math.hypot(200, 90));
  close(panels[1]!.angle, Math.atan2(90, 200) * 180 / Math.PI);
});

test('resizing keeps slopes measured: width scales, height shifts the whole top', () => {
  const resized = resizeShape(sloped, 200, 250, 230, 220);
  assert.deepEqual(resized.top.map(p => [p.x, p.y]), [[0, 130], [250, 220]]);
  assert.equal(minimumShapeHeight(sloped), 130);
  assert.ok(isRegularShape(undefined));
  assert.ok(!isRegularShape(sloped));
});

test('regular wardrobes keep their exact long-standing clear height', () => {
  const geometry = createWardrobeGeometry(() => design());
  assert.equal(geometry.ih(), 218.4);
  assert.equal(geometry.ih(0), 218.4);
  assert.equal(geometry.ceilingIn(0, 0, 100), 218.4);
});

test('fittings respect a sloped top: placement, measurements and free spaces', () => {
  const state = design(sloped, { n: 1 });
  const geometry = createWardrobeGeometry(() => state);
  const bw = geometry.widths()[0]!;
  // A full-width hanging rail cannot sit under the low end...
  state.secs[0] = [{ k: 'long', h: 160 }];
  assert.equal(geometry.sectionLayoutValid(0), false);
  assert.ok(geometry.overflow(0) > 0);
  // ...but fits in the taller part.
  const span = geometry.clearSpans(0, 0, bw, 160)[0]!;
  state.secs[0] = [{ k: 'long', h: 160, w: Math.floor((bw - span.x0) * 10) / 10, x: span.x0, y: 0 }];
  assert.equal(geometry.sectionLayoutValid(0), true);
  const m = geometry.itemMeasurements(0, 0)!;
  assert.ok(m.top >= 0 && m.top < 1, 'top clearance is measured to the slope above the item');
  // The free space reports both its tallest and its lowest clear height.
  state.secs[0] = [];
  const space = geometry.sectionSpaceMeasurements(0);
  assert.equal(space.sloped, true);
  close(space.h, geometry.ceilingTop(0, 0, bw), .02);
  close(space.hMin, geometry.ceilingIn(0, 0, bw), .02);
});

test('adding a fitting under a slope places it in the taller part of the space', () => {
  const state = design(sloped, { n: 1 });
  const messages: string[] = [];
  const commands = createDesignCommands(() => state, { report: m => messages.push(m) });
  const geometry = createWardrobeGeometry(() => state);
  state.space = { i: 0, x: 150, y: 50 };
  commands.addMod('long');
  assert.equal(state.secs[0]!.length, 1);
  const item = state.secs[0]![0]!;
  assert.ok(item.w! < geometry.widths()[0]!);
  assert.equal(geometry.sectionLayoutValid(0), true);
  assert.ok(messages.some(m => /taller part/.test(m)));
});

test('shape commands validate, refit fittings and record one history entry', () => {
  const s = scene(design(undefined, { n: 2, secs: [[{ k: 'long', h: 160 }], [{ k: 'short', h: 106 }, { k: 'drawer', h: 22 }], [], [], [], []] }));
  // An impossible skeleton changes nothing.
  assert.equal(s.commands.setShape({ template: 'custom', top: [{ x: 0, y: 20 }, { x: 200, y: 230 }] }), false);
  assert.equal(s.state().shape, undefined);
  assert.match(s.messages.at(-1)!, /at least 40 cm/);
  // Lowering the left side squeezes or removes what no longer fits.
  assert.equal(s.commands.setShape({ template: 'custom', top: [{ x: 0, y: 120 }, { x: 200, y: 230 }] }), true);
  assert.equal(s.checkpoints(), 1);
  assert.equal(s.state().h, 230);
  const geometry = createWardrobeGeometry(() => s.state());
  for (let i = 0; i < s.state().n; i++) assert.equal(geometry.sectionLayoutValid(i), true, 'section ' + i);
  // Live previews neither record history nor refit.
  const before = structuredClone(s.state().secs);
  assert.equal(s.commands.setShape({ template: 'custom', top: [{ x: 0, y: 60 }, { x: 200, y: 230 }] }, false, false), true);
  assert.equal(s.checkpoints(), 1);
  assert.deepEqual(s.state().secs, before);
});

test('applying a template on an empty wardrobe takes its sections; height follows the shape', () => {
  const s = scene(design());
  assert.equal(s.commands.applyShapeTemplate('under-stairs'), true);
  assert.equal(s.state().shape!.template, 'under-stairs');
  assert.equal(s.state().n, 3);
  assert.equal(s.state().h, maxHeight(s.state().shape!));
  assert.equal(s.commands.applyShapeTemplate('regular'), true);
  assert.equal(s.state().shape, undefined);
  // New wardrobes can start from a template.
  const added = s.commands.addCabinet(false, 'stepped');
  assert.equal(added.state.shape!.template, 'stepped');
  assert.equal(s.model.scene.wardrobes[0]!.state.shape, undefined);
});

test('resizing a shaped wardrobe scales the skeleton and rejects impossible sizes', () => {
  const s = scene(design(sloped, { n: 1 }));
  assert.equal(s.commands.setCabinetSize('w', 250), true);
  assert.deepEqual(s.state().shape!.top.map(p => [p.x, p.y]), [[0, 140], [250, 230]]);
  assert.equal(s.commands.setCabinetSize('h', 200), true);
  assert.deepEqual(s.state().shape!.top.map(p => p.y), [110, 200]);
  assert.equal(s.state().h, 200);
  // The shaped minimum keeps the low side at least 40 cm tall.
  s.commands.setCabinetSize('h', 60);
  assert.equal(Math.min(...s.state().shape!.top.map(p => p.y)), 40);
});

test('auto design on a shaped wardrobe keeps every fitting under the top', async () => {
  const { selectStorageLayouts } = await import('../../src/domain/planner/selection-planner');
  const start = createFromTemplate('under-stairs', { w: 200, h: 230, maxN: 6 });
  const state = design(start.shape, { n: start.n, wt: start.wt });
  const commands = createDesignCommands(() => state);
  const geometry = createWardrobeGeometry(() => state);
  const proposal = selectStorageLayouts({ ...geometry.plannerConfig(), engaged: true })[0]!;
  commands.applyProposal(proposal);
  assert.equal(state.n, 3, 'the shape-aligned partitions are kept');
  assert.ok(state.secs.slice(0, state.n).some(items => items.length));
  for (let i = 0; i < state.n; i++) assert.equal(geometry.sectionLayoutValid(i), true, 'section ' + i);
  state.dividers.forEach((d, j) => assert.equal(geometry.dividerValid(d, j), true));
});

test('shapes survive saving, reopening and dirty comparison; old projects stay regular', () => {
  const start = createFromTemplate('alcove', { w: 200, h: 230, maxN: 6 });
  const s = scene(design(start.shape, { n: start.n, wt: start.wt }));
  const project = sceneToProject(createProject('p1', 'Shapes'), s.model.scene);
  const json = serializeProject(project);
  const reopened = projectToScene(deserializeProject(json))!;
  assert.deepEqual(reopened.wardrobes[0]!.state.shape, s.state().shape);
  assert.equal(sceneDesignKey(reopened), sceneDesignKey(s.model.scene));
  // Changing only the skeleton marks the design as changed.
  const edited = structuredClone(s.model.scene);
  edited.wardrobes[0]!.state.shape = setPoint(edited.wardrobes[0]!.state.shape!, 0, { y: 220 });
  assert.notEqual(sceneDesignKey(edited), sceneDesignKey(s.model.scene));
  // Projects saved before shapes existed have none and open as regular wardrobes.
  const legacy = sceneToProject(createProject('p2', 'Legacy'), scene(design()).model.scene);
  assert.equal('shape' in legacy.wardrobes[0]!, false);
  assert.equal(projectToScene(parseProject(JSON.parse(serializeProject(legacy))))!.wardrobes[0]!.state.shape, undefined);
});

test('saved shapes are validated against the editor rules', () => {
  const s = scene(design(sloped, { n: 1 }));
  const project = sceneToProject(createProject('p1', 'Shapes'), s.model.scene);
  const broken = structuredClone(project) as unknown as { wardrobes: { shape: WardrobeShape; dimensions: { height: number } }[] };
  broken.wardrobes[0]!.shape.top[0]!.y = 10;
  assert.throws(() => parseProject(broken), /Invalid wardrobe shape/);
  const mismatched = structuredClone(project) as unknown as typeof broken;
  mismatched.wardrobes[0]!.dimensions.height = 240;
  assert.throws(() => parseProject(mismatched), /height disagrees/);
});
