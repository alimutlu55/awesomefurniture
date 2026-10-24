import test from 'node:test';
import assert from 'node:assert/strict';
import type { Dimensions } from '../../src/domain/drawings/drawing';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { unitDetailLegend, unitDetailViews } from '../../src/domain/drawings/unit-detail';
import { sheetPresentation } from '../../src/presentation/drawings/sheet-marks';

// A tall wardrobe with a drawer stack and shelves: the kind whose strings used to fill with 18 mm boards and 10 mm joints.
const drawer = { k: 'drawer', h: 22 } as const, shelf = { k: 'shelf', h: 20 } as const;
const design = { ...createInitialDesign(), w: 88, h: 272, d: 40, secs: [[drawer, drawer, drawer, shelf, shelf, shelf, shelf], [], [], [], [], []] };
const [piece] = placePieces({ pieces: [{ id: 2, name: 'Wardrobe', x: 0, z: 0, angle: 0, y: 0, design }] });
const views = unitDetailViews(piece!);
const figures = (d: Dimensions) => d.stops.slice(1).flatMap((s, k) => d.quiet?.includes(k) ? [] : [s - d.stops[k]!]);
const strings = (title: string) => views.find(v => v.title === title)!.items.filter((i): i is Dimensions => i.kind === 'dims');

test('shop sheet strings carry no figure for a board thickness or a joint between fronts', () => {
  for (const view of views) for (const d of view.items.filter((i): i is Dimensions => i.kind === 'dims'))
    assert.ok(!figures(d).some(f => f === 18 || f === 10), view.title + ' writes ' + figures(d).join(' '));
});

test('Inside and Section A–A give the same clear heights between boards', () => {
  const clear = (title: string) => strings(title).filter(d => d.dir.y === 1 && d.row === 0).flatMap(figures).filter(f => f > 100 && f < 1000).sort((a, b) => a - b);
  assert.ok(clear('Inside').length >= 4);
  assert.deepEqual(clear('Section A–A'), clear('Inside'));
});

test('each view still states its overall size, and the legend says what the figures are', () => {
  for (const title of ['Front', 'Inside']) assert.ok(strings(title).some(d => d.dir.y === 1 && figures(d).includes(2720)), title + ' height');
  const legend = unitDetailLegend(piece!).join(' ');
  assert.match(legend, /boards 18 mm thick/); assert.match(legend, /joints between fronts 10 mm/); assert.match(legend, /6 back board \+ 380 shelf depth \+ 14 shelf setback/);
});

test('no two dimension figures on a shop sheet overlap, and nothing is left unplaced', () => {
  const sheet = { number: 1, title: 'W2', legend: unitDetailLegend(piece!), views, pieces: [], checks: [] };
  const { dimensionBoxes, warnings } = sheetPresentation(sheet, { project: 'QA', date: '2026-10-25', total: 1 });
  assert.equal(warnings.length, 0);
  assert.ok(dimensionBoxes.every((a, i) => dimensionBoxes.every((b, k) => i === k || a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0)), 'no two figures overlap');
});
