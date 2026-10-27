import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { placePieces, type DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { unitDetailViews } from '../../src/domain/drawings/unit-detail';
import { sheetPresentation } from '../../src/presentation/drawings/sheet-marks';
import type { Dimensions, Item } from '../../src/domain/drawings/drawing';

const box = { id: 1, x: 0, y: 0, z: 0, angle: 0, state: { ...createKitchenDesign('base', 'corner'), w: 117.9 } };
// Right return: its left-facing front is at x = 0.95, its side touches the selected front at z = 29.
const right = { id: 2, x: 29.95, y: 0, z: 59, angle: 270, state: createKitchenDesign('base') };
const values = (b: Parameters<typeof cornerCabinetWidths>[0] = box, neighbours: Parameters<typeof cornerCabinetWidths>[1] = [right]) =>
  cornerCabinetWidths(b, [b, ...neighbours]).map(s => [Number(s.from.toFixed(8)), Number(s.to.toFixed(8)), s.covered]);
const dims = (items: readonly Item[]) => items.filter((i): i is Dimensions => i.kind === 'dims');
const drawingPieces = (): DrawingPiece[] => [box, right].map(p => ({ ...p, name: 'Cabinet', design: p.state }));

test('1179 mm corner cabinet measures 559 mm exposed + 40 mm strip + 580 mm return', () => {
  assert.deepEqual(values(), [[0, 55.9, false], [55.9, 59.9, false], [59.9, 117.9, true]]);
  assert.equal(box.state.w, 117.9);
});

test('left and double returns use actual depth and position, including nonstandard depths', () => {
  const left = { ...right, id: 3, x: -29.95, angle: 90 };
  assert.deepEqual(values(box, [left]), [[0, 58, true], [58, 62, false], [62, 117.9, false]]);
  assert.deepEqual(values(box, [left, right]), [[0, 58, true], [58, 59.9, false], [59.9, 117.9, true]]);
  assert.deepEqual(values(box, [{ ...right, x: 38.95, state: { ...right.state, d: 40 } }]), [[0, 73.9, false], [73.9, 77.9, false], [77.9, 117.9, true]]);
  assert.deepEqual(values(box, [{ ...right, x: right.x + 1.25 }]), [[0, 57.15, false], [57.15, 61.15, false], [61.15, 117.9, true]]);
});

test('turning and translating the complete installation retains the exact surface lengths', () => {
  for (const turn of [0, 37, 90, 180, 263, 360]) {
    const a = turn * Math.PI / 180;
    const pose = (p: typeof box) => ({ ...p, x: 113 + Math.cos(a) * p.x + Math.sin(a) * p.z,
      z: -217 - Math.sin(a) * p.x + Math.cos(a) * p.z, angle: p.angle + turn });
    assert.deepEqual(values(pose(box), [pose(right)]), values(), 'rotation ' + turn);
    const fractional = pose({ ...right, x: right.x + 1.25 });
    const widths = cornerCabinetWidths(pose(box), [fractional]);
    assert.equal(Math.round(widths[1]!.to * 10), 612, 'half-mm stop rounds consistently after rotation ' + turn);
  }
});

test('unrelated, parallel, elevated and fixture neighbours do not invent a corner', () => {
  for (const other of [
    { ...right, angle: 0 }, { ...right, z: right.z + 7.01 }, { ...right, x: 400 },
    { ...right, y: box.state.h }, { ...right, angle: 269 },
    { ...right, state: createKitchenDesign('sink-top') },
  ]) assert.deepEqual(values(box, [other]), [[0, 117.9, false]]);
  assert.deepEqual(values({ ...box, state: { ...box.state, product: undefined } }), [[0, 117.9, false]]);
});

test('saved corner layout with a 25 mm front offset still splits at the actual return faces', () => {
  const selected = { ...box, x: -141, z: -15.8, angle: 90, state: { ...box.state, w: 104.4 } };
  const returnUnit = { ...right, x: -94.5, z: -39, angle: 0, state: { ...right.state, w: 30 } };
  const before = structuredClone([selected, returnUnit]);
  assert.deepEqual(values(selected, [returnUnit]), [[0, 42.4, false], [42.4, 46.4, false], [46.4, 104.4, true]]);
  assert.deepEqual([selected, returnUnit], before, 'recognising a corner does not close its real gap or change its sizes');
  const pieces = [selected, returnUnit].map(p => ({ ...p, name: 'Cabinet', design: p.state }));
  for (const title of ['Plan', 'Front elevation K1', 'K1  Base cabinet']) {
    const sheet = technicalDrawings({ pieces }, { preset: 'installation' }).find(s => s.title === title)!;
    assert.ok(dims(sheet.views.flatMap(v => v.items)).some(d => JSON.stringify(d.stops) === '[0,424,464,1044]'),
      title + ' dimensions the real offset return');
  }
  for (const turn of [37, 90, 263]) {
    const a = turn * Math.PI / 180;
    const pose = (p: typeof selected) => ({ ...p, x: Math.cos(a) * p.x + Math.sin(a) * p.z,
      z: -Math.sin(a) * p.x + Math.cos(a) * p.z, angle: p.angle + turn });
    assert.deepEqual(values(pose(selected), [pose(returnUnit)]), [[0, 42.4, false], [42.4, 46.4, false], [46.4, 104.4, true]]);
  }
});

test('near-square returns use their actual angle rather than requiring exact quarter-turn coordinates', () => {
  for (const angle of [269.5, 269.9, 270.1, 270.5]) {
    const actual = cornerCabinetWidths(box, [{ ...right, angle }]);
    assert.ok(actual.length >= 2, 'recognises the editor quarter-turn tolerance at ' + angle);
    assert.equal(actual[0]!.covered, false); assert.equal(actual[2]!.covered, true);
    assert.ok(Math.abs(actual[1]!.to - 59.9) > .001, 'retains actual angled intersection');
    assert.equal(actual[0]!.to, actual[1]!.from);
    assert.equal(actual.at(-1)!.to, box.state.w);
    const a = angle * Math.PI / 180, x = actual[1]!.to - box.state.w / 2, z = box.state.d / 2;
    assert.ok(Math.abs((x - right.x) * Math.sin(a) + (z - right.z) * Math.cos(a) - right.state.d / 2) < 1e-8,
      'the split lies on the real return front plane');
  }
});

test('overlapping returns are merged; movement, depth changes and deletion recompute the split', () => {
  assert.deepEqual(values(box, [right, { ...right, id: 3 }]), values());
  assert.deepEqual(values(box, []), [[0, 117.9, false]]);
  assert.deepEqual(values(box, [{ ...right, state: { ...right.state, d: 60 } }]), [[0, 54.9, false], [54.9, 58.9, false], [58.9, 117.9, true]]);
  for (const s of cornerCabinetWidths(box, [box, right])) assert.ok(s.to > s.from);
});

test('plans, free elevations and shop fronts share the split, retain totals and preserve cutting geometry', () => {
  const pieces = drawingPieces(), before = structuredClone(pieces);
  const sheets = technicalDrawings({ pieces }, { preset: 'installation' });
  for (const title of ['Plan', 'Front elevation K1', 'K1  Base cabinet']) {
    const sheet = sheets.find(s => s.title === title)!;
    const items = title === 'K1  Base cabinet' ? sheet.views.find(v => v.title === 'Front')!.items : sheet.views.flatMap(v => v.items);
    const widths = dims(items).filter(d => d.dir.x === 1 && Math.abs(d.dir.y) < 1e-6);
    assert.ok(widths.some(d => JSON.stringify(d.stops) === '[0,559,599,1179]'), title + ' surface chain');
    assert.ok(widths.some(d => JSON.stringify(d.stops) === '[0,1179]'), title + ' total');
  }
  const placed = placePieces({ pieces }).find(p => p.id === 1)!;
  const front = unitDetailViews(placed!).find(v => v.title === 'Front')!.items;
  const contextual = sheets.find(s => s.title === 'K1  Base cabinet')!.views.find(v => v.title === 'Front')!.items;
  assert.notDeepEqual(contextual.filter(i => i.kind !== 'dims'), front.filter(i => i.kind !== 'dims'), 'installed fronts include the allocated strip; standalone fronts use their own split');
  assert.deepEqual(pieces, before, 'drawing export must not mutate the model');
  const shop = sheets.find(s => s.title === 'K1  Base cabinet')!;
  assert.match(shop.legend!.join(' '), /not front cutting sizes/);
  const paper = sheetPresentation(shop, { project: 'Corner QA', date: '2026-10-26', total: sheets.length });
  assert.deepEqual(paper.warnings, [], 'new installation string fits the manufacturing sheet');
  assert.ok(paper.marks.some(m => m.kind === 'text' && m.text.includes('not front cutting sizes')), 'installation datum appears on the rendered sheet');
  assert.ok(paper.dimensionBoxes.every((a, i) => paper.dimensionBoxes.every((b, k) =>
    i === k || a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0)), 'printed dimension figures do not overlap');
});

test('wall plan and elevation include the actual return front and retain the wall total', () => {
  const studio = { template: 'custom' as const, corners: [{ id: 'a', x: -58.95, z: -34 }, { id: 'b', x: 200, z: -34 }],
    walls: [{ id: 'w', a: 'a', b: 'b', thickness: 10, height: 260 }], openings: [] };
  const sheets = technicalDrawings({ studio, pieces: drawingPieces() }, { preset: 'installation' });
  for (const title of ['Plan', 'Elevation A']) {
    const chains = dims(sheets.find(s => s.title === title)!.views.flatMap(v => v.items));
    assert.ok(chains.some(d => JSON.stringify(d.stops) === '[-18,0,559,599,1179,2590]'), title + ' includes return split and wall end');
    assert.ok(chains.some(d => JSON.stringify(d.stops) === '[0,2590]'), title + ' wall total');
  }
});

test('fractional positions round shared stops once so all printed segments add exactly to the total', () => {
  const pieces = drawingPieces().map(p => p.id === 2 ? { ...p, x: p.x + .025 } : p);
  const sheets = technicalDrawings({ pieces });
  const chain = dims(sheets.find(s => s.title === 'Front elevation K1')!.views[0]!.items).find(d => d.stops.length === 4 && d.dir.x === 1)!;
  assert.deepEqual(chain.stops, [0, 559, 599, 1179]);
  assert.equal(chain.stops.slice(1).reduce((sum, s, k) => sum + s - chain.stops[k]!, 0), 1179);
});
