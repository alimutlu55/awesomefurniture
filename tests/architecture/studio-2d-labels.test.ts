import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { stepStudioWall } from '../../src/domain/studio/studio-plan';
import { door2DPlan, wall2DPlan, type Point2D } from '../../src/domain/studio/studio-plan';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorCabinet } from '../../src/application/projects/editor-scene';
import { createTransform, renderFurniture, renderRooms, renderWalls } from '../../src/presentation/editor/studio-2d-canvas';
import { layoutPlanLabels, polygonOverlapsRect, rectanglesOverlap, renderPlanLabels, type LabelRect } from '../../src/presentation/editor/studio-2d-labels';

const cabinet = (id: number, x: number, z: number, angle: number, width: number, depth = 60): EditorCabinet => ({
  id, name: `C${id}`, x, y: 0, z, angle, state: { ...createEditorState(), w: width, d: depth },
});
const rectangles = (markup: string) => [...markup.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1]!.split(' ').map(p => {
  const [x, z] = p.split(',').map(Number); return { x: x!, z: z! };
}));

for (const zoom of [.25, .55, 1.2, 2.5]) {
  test(`2D labels avoid walls, rotated furniture, controls and each other at zoom ${zoom}`, () => {
    const studio = stepStudioWall(createStudio('bedroom'), 'w3', 50, .55)!;
    const wardrobes = [cabinet(1, 0, 30, 0, 320), cabinet(2, -170, 165, 90, 230), cabinet(3, 110, 220, 35, 100)];
    const transform = { width: 390, height: 760, panX: 0, panZ: 60, zoom };
    const { toScreen } = createTransform(transform);
    const exclusions: LabelRect[] = [{ x: 0, y: 0, width: 390, height: 115 }, { x: 96, y: 128, width: 196, height: 44 }, { x: 50, y: 696, width: 290, height: 64 }];
    const guides = [{ a: { x: 0, z: 0 }, b: { x: 80, z: 80 }, label: 'Square' },
      { a: { x: 60, z: 0 }, b: { x: 80, z: 80 }, label: 'Aligned with corner' },
      { a: { x: 100, z: 0 }, b: { x: 80, z: 80 }, label: 'Aligned with corner' }];
    const labels = layoutPlanLabels({ studio, wardrobes, transform, selection: { kind: 'wall', id: 'w1' }, exclusions, guides });
    assert.ok(labels.length > 1, 'keeps useful labels on screen');
    assert.ok(labels.some(l => l.wallId === 'w1'), 'selected wall takes priority');
    const objects: Point2D[][] = [...studio.walls.map(w => wall2DPlan(studio, w)!.solid), ...rectangles(renderFurniture(wardrobes, 1))].map(p => p.map(toScreen));
    for (const [i, label] of labels.entries()) {
      assert.ok(label.box.x >= 0 && label.box.y >= 0 && label.box.x + label.box.width <= transform.width && label.box.y + label.box.height <= transform.height);
      for (const object of objects) assert.equal(polygonOverlapsRect(object, label.box), false, `${label.id} clears geometry`);
      for (const control of exclusions) assert.equal(rectanglesOverlap(label.box, control), false, `${label.id} clears controls`);
      for (const other of labels.slice(i + 1)) assert.equal(rectanglesOverlap(label.box, other.box), false, `${label.id} clears ${other.id}`);
    }
    const hints = labels.filter(l => l.kind === 'guide');
    assert.ok(hints.length <= 1, 'never stacks hints when there is no nearby space');
    if (hints.length) assert.equal(hints[0]!.text, 'Square · Aligned with corner', 'one message with no repeated text');
  });
}

test('dimension badges shrink with the plan when zooming out and stop growing when zooming in', () => {
  const studio = createStudio('wall');
  const values = [.15, .3, .6, 1, 2.5].map(zoom => layoutPlanLabels({ studio, wardrobes: [],
    transform: { width: 1440, height: 900, panX: 0, panZ: 0, zoom }, selection: null }).find(l => l.wallId === 'w1')!);
  assert.ok(values.every(Boolean));
  assert.equal(values[0]!.height, values[2]!.height / 4);
  assert.equal(values[1]!.height, values[2]!.height / 2);
  assert.equal(values[0]!.width, values[2]!.width / 4);
  assert.equal(values[3]!.height, values[2]!.height);
  assert.equal(values[4]!.width, values[2]!.width);
  assert.ok(values.every(l => l.text === values[0]!.text));
});

test('crowded labels are omitted instead of covering the drawing; geometry contains no buried labels', () => {
  const studio = createStudio('bedroom');
  const transform = { width: 390, height: 760, panX: 0, panZ: 160, zoom: .5 };
  assert.deepEqual(layoutPlanLabels({ studio, wardrobes: [], transform, selection: null,
    exclusions: [{ x: 0, y: 0, width: 390, height: 760 }] }), []);
  assert.ok(!renderRooms(studio).includes('<text'));
  assert.ok(!renderWalls(studio, null).includes('<text'));
  const markup = renderPlanLabels(layoutPlanLabels({ studio, wardrobes: [], transform, selection: { kind: 'wall', id: 'w1' } }));
  assert.ok(!markup.includes('data-edit-wall'), 'labels have no edit action');
  assert.ok(!markup.includes('role="button"'), 'labels are not buttons');
  assert.ok(markup.includes('sp2d-dimension-leader'), 'a short line identifies the measured wall');
});

test('polygon collision checks leave the empty corners of diagonal footprints usable', () => {
  const diamond = [{ x: 0, z: 5 }, { x: 5, z: 0 }, { x: 10, z: 5 }, { x: 5, z: 10 }];
  assert.equal(polygonOverlapsRect(diamond, { x: 0, y: 0, width: 1, height: 1 }), false);
  assert.equal(polygonOverlapsRect(diamond, { x: 4, y: 4, width: 2, height: 2 }), true);
});

test('dimensions stay clear of door leaves and swing arcs', () => {
  const studio = createStudio('bedroom');
  const transform = { width: 390, height: 760, panX: 0, panZ: 160, zoom: .55 };
  const { toScreen } = createTransform(transform);
  const labels = layoutPlanLabels({ studio, wardrobes: [], transform, selection: { kind: 'wall', id: 'w2' } });
  assert.ok(labels.some(l => l.wallId === 'w2'));
  const door = studio.openings.find(o => o.kind === 'door')!;
  const plan = door2DPlan(studio, door)!;
  const hinge = toScreen(plan.hingePoint);
  const leaf = toScreen(plan.openPoint);
  const leafBounds = { x: Math.min(hinge.x, leaf.x) - 2, y: hinge.z - 2, width: Math.abs(hinge.x - leaf.x) + 4, height: 4 };
  assert.ok(labels.every(l => !rectanglesOverlap(l.box, leafBounds)));
});


test('short wall segments beside a T-junction do not put labels under the crossing wall', () => {
  const studio = { template: 'custom' as const, corners: [
    { id: 'a', x: -300, z: 0 }, { id: 'b', x: 0, z: 0 }, { id: 'c', x: 0, z: -150 },
    { id: 'd', x: 130, z: -150 }, { id: 'e', x: 130, z: -280 }, { id: 'f', x: 0, z: -280 }, { id: 'g', x: 0, z: 38 },
  ], walls: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['b', 'g']].map(([a, b], i) => ({
    id: 'w' + i, a: a!, b: b!, thickness: 12, height: 260,
  })), openings: [] };
  const transform = { width: 390, height: 760, panX: -60, panZ: -100, zoom: 1.2 };
  const { toScreen } = createTransform(transform);
  const labels = layoutPlanLabels({ studio, wardrobes: [], transform, selection: { kind: 'wall', id: 'w5' } });
  assert.ok(labels.some(l => l.wallId === 'w5'), 'the short selected segment is still labelled');
  for (const [i, label] of labels.entries()) {
    for (const wall of studio.walls) assert.equal(polygonOverlapsRect(wall2DPlan(studio, wall)!.solid.map(toScreen), label.box), false);
    for (const other of labels.slice(i + 1)) assert.equal(rectanglesOverlap(label.box, other.box), false);
  }
});


test('overview dimensions stay beside their walls instead of scattering across the screen', () => {
  const studio = stepStudioWall(createStudio('bedroom'), 'w3', 50, .55)!;
  for (const zoom of [.15, .2, .4, 1]) {
    const labels = layoutPlanLabels({ studio, wardrobes: [], transform: { width: 390, height: 760, panX: 0, panZ: 160, zoom }, selection: null });
    const dimensions = labels.filter(l => l.kind === 'dimension');
    assert.ok(dimensions.length > 0);
    for (const label of dimensions) {
      assert.ok(label.anchor);
      assert.ok(Math.hypot(label.x - label.anchor!.x, label.y - label.anchor!.z) <= 56 * label.scale + .01);
    }
    if (zoom <= .2) assert.ok(dimensions.length < studio.walls.length, 'small details wait for zooming in or selection');
  }
});
