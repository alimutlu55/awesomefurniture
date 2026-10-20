import test from 'node:test';
import assert from 'node:assert/strict';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import type { DrawingInput, DrawingPiece } from '../../src/domain/drawings/room-pieces';
import type { Sheet } from '../../src/domain/drawings/drawing';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { planClearances } from '../../src/domain/drawings/plan-clearances';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { setDoorOperation } from '../../src/domain/studio/studio-edit';
import { sheetPresentation, sheetSvg } from '../../src/presentation/drawings/sheet-marks';
import { drawingArea } from '../../src/presentation/drawings/sheet-layout';
import { intersectsBox, wordBox } from '../../src/presentation/drawings/annotation-layout';
import { paginateDrawingSheets } from '../../src/presentation/drawings/table-marks';
import { annotationStore } from '../../src/presentation/drawings/drawing-preferences';
import { drawingFixture, drawingInput } from '../../scripts/professional-drawing-fixtures.mjs';
import { createProject } from '../../src/domain/project/project';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

const unit = (id: number, x: number, z: number, angle = 0): DrawingPiece => ({ id, name: 'Unit', x, y: 0, z, angle, design: createKitchenDesign('base', 'drawers') });
const input = (kind: string) => drawingInput(drawingFixture(kind)) as DrawingInput;
const items = (s: Sheet) => s.views.flatMap(v => v.items);
const info = { project: 'Drawing QA', date: '20.10.2026', total: 1 };

test('drawing purposes separate visible furniture, overhead labels, exact positioning and operational envelopes', () => {
  const scene = input('l'), before = JSON.stringify(scene);
  const layout = technicalDrawings(scene, { preset: 'layout' }), installation = technicalDrawings(scene, { preset: 'installation' });
  const clearance = technicalDrawings(scene, { preset: 'clearances' });
  const floor = items(layout[0]!), upper = items(layout.find(s => s.title === 'Upper furniture plan')!);
  assert.ok(floor.some(i => i.kind === 'line' && i.stroke === 'overhead'));
  assert.equal(floor.filter(i => i.kind === 'arrow').length, 0, 'operation arrows off in Layout');
  assert.equal(floor.filter(i => i.kind === 'line' && i.stroke === 'swing').length, 0, 'cabinet operations off in Layout');
  assert.ok(items(clearance[0]!).some(i => i.kind === 'line' && i.stroke === 'swing'));
  const floorTags = floor.filter(i => i.kind === 'tag').map(i => i.text), upperTags = upper.filter(i => i.kind === 'tag').map(i => i.text);
  assert.ok(floorTags.length > 0 && upperTags.length > 0);
  assert.ok(floorTags.every(t => !upperTags.includes(t)), 'stacked identifiers are on separate plans');
  assert.ok(items(installation[0]!).filter(i => i.kind === 'dims').length > floor.filter(i => i.kind === 'dims').length);
  assert.equal(JSON.stringify(scene), before, 'view selection never changes design geometry');
});

test('cabinet marks remain stable after moving, reordering or deleting other cabinets', () => {
  const pieces = [unit(12, 0, 0), unit(9, 60, 0), unit(20, -60, 0)];
  const marks = (p: DrawingPiece[]) => new Map(placePieces({ pieces: p }).map(x => [x.id, x.mark]));
  const before = marks(pieces), after = marks([{ ...pieces[1]!, x: -500 }, pieces[0]!]);
  assert.equal(before.get(12), after.get(12)); assert.equal(before.get(9), after.get(9));
  assert.equal(after.get(12), 'K12');
});

for (const kind of ['l', 'u', 'island', 'rotated', 'shelf']) test('annotation quality: ' + kind + ' room, three purposes and every detail sheet', () => {
  for (const preset of ['layout', 'installation', 'clearances'] as const) {
    const pages = paginateDrawingSheets(technicalDrawings(input(kind), { preset }));
    for (const s of pages.filter(s => s.views.length)) {
      const result = sheetPresentation(s, { ...info, total: pages.length }), area = drawingArea(s);
      assert.deepEqual(result.warnings, [], kind + '/' + preset + '/' + s.title);
      assert.equal(result.anchors.filter(a => a.key.includes('/tag:')).length, items(s).filter(i => i.kind === 'tag').length, 'no missing cabinet identifiers');
      for (let i = 0; i < result.anchors.length; i++) {
        const a = result.anchors[i]!;
        assert.ok(a.box.x0 >= area.x && a.box.x1 <= area.x + area.w && a.box.y0 >= area.y && a.box.y1 <= area.y + area.h, 'annotation inside its view area');
        for (const b of result.anchors.slice(i + 1)) assert.ok(!intersectsBox(a.box, b.box), a.key + ' overlaps ' + b.key);
        for (const d of result.dimensionBoxes) assert.ok(!intersectsBox(a.box, d), 'annotation overlaps a dimension figure');
      }
    }
  }
});

test('clearance profiles distinguish working aisles from walkways and never classify a perpendicular return as an aisle', () => {
  const opposing = placePieces({ pieces: [unit(1, 0, 0), unit(2, 0, 162, 180)] });
  const one = planClearances(undefined, opposing, 'nkba-single'), project = planClearances(undefined, opposing, 'project');
  const issue = one.issues.find(i => i.kind === 'work-aisle')!;
  assert.equal(issue.measured, 1000); assert.equal(issue.required, 1067); assert.match(issue.rule!, /NKBA/);
  assert.ok(!project.issues.some(i => i.kind === 'work-aisle'));
  assert.ok(one.issues.some(i => i.kind === 'simultaneous'), 'simultaneous drawer envelopes reviewed separately');
  const perpendicular = placePieces({ pieces: [unit(1, 0, 0), unit(2, 0, 90, 90)] });
  assert.ok(!planClearances(undefined, perpendicular).issues.some(i => i.kind === 'walkway' || i.kind === 'work-aisle'));
  const elevated = placePieces({ pieces: [unit(1, 0, 0), { ...unit(2, 0, 100, 180), y: 142, design: createKitchenDesign('upper') }] });
  assert.ok(!planClearances(undefined, elevated).issues.some(i => i.kind === 'walkway' || i.kind === 'work-aisle'));
});

test('unknown room-door handing produces a review, confirmed handing controls the arc and survives scene serialization', () => {
  const studio = { ...rectangleStudio(400, 300), openings: [{ id: 'door', wall: 'w1', kind: 'door' as const, offset: 200, width: 80, height: 205, sill: 0 }] };
  const unknown = technicalDrawings({ studio, pieces: [] }, { preset: 'clearances' });
  assert.ok(unknown[0]!.issues!.some(i => i.kind === 'unconfirmed'));
  assert.ok(!items(unknown[0]!).some(i => i.kind === 'line' && i.stroke === 'swing'));
  const confirmed = setDoorOperation(studio, 'door', { hinge: 'right', swing: 'out' })!;
  assert.equal('hinge' in studio.openings[0]!, false, 'edit is immutable');
  const drawn = technicalDrawings({ studio: confirmed, pieces: [] });
  assert.ok(items(drawn[0]!).some(i => i.kind === 'line' && i.stroke === 'swing'));
  const scene = { wardrobes: [], activeWardrobe: -1, nextWardrobeId: 1, studio: confirmed };
  const restored = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('doors', 'Doors'), scene))))!;
  assert.equal(restored.studio!.openings[0]!.hinge, 'right'); assert.equal(restored.studio!.openings[0]!.swing, 'out');
  assert.ok(!planClearances(confirmed, []).issues.some(i => i.kind === 'unconfirmed'));
});

test('minor real gaps are reported for review and retained exactly in installation dimensions', () => {
  const studio = rectangleStudio(400, 300), pieces = [unit(1, -100, 29), unit(2, -39.8, 29)];
  const s = technicalDrawings({ studio, pieces }, { preset: 'installation' })[0]!;
  assert.ok(s.issues!.some(i => i.kind === 'alignment' && i.measured === 2));
  assert.ok(items(s).some(i => i.kind === 'dims' && i.stops.some((v, k) => k > 0 && v - i.stops[k - 1]! === 2)));
  assert.equal(pieces[1]!.x, -39.8);
});

test('saved label adjustments use geometry snapshots, ignore selection changes and remain usable without browser storage', () => {
  const scene = drawingFixture('l') as unknown as EditorScene, design = drawingInput(scene) as DrawingInput;
  const data = new Map<string, string>(), storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) } as unknown as Storage;
  const store = annotationStore(design, storage); store.offsets['tag:K1'] = { x: 4, y: 8 }; assert.equal(store.save(), true);
  const changedSelection = structuredClone(design); Object.assign(changedSelection.pieces[0]!.design, { sel: 3, item: 1, open: true });
  assert.deepEqual(annotationStore(changedSelection, storage).offsets['tag:K1'], { x: 4, y: 8 });
  const moved = structuredClone(design); Object.assign(moved.pieces[0]!, { x: 500 });
  assert.equal(annotationStore(moved, storage).offsets['tag:K1'], undefined, 'stale adjustments are not applied to changed geometry');
  const session = annotationStore(design, undefined); session.offsets['tag:K1'] = { x: 2, y: 0 }; assert.equal(session.save(), false);
  assert.equal(session.offsets['tag:K1']!.x, 2);
});

test('long schedules paginate without losing rows, clipping words, or reducing the lettering', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ['K' + i, 'Confirm the cabinet mounting level and its relationship to the adjacent worktop', 'A detailed review reference for the installation team']);
  const sample: Sheet = { number: 1, title: 'Review issues', views: [], pieces: [], checks: [], table: { columns: ['Mark', 'Finding', 'Reference'], rows, numeric: [], notes: ['Verify on site.'] } };
  const pages = paginateDrawingSheets([sample]); assert.ok(pages.length > 1);
  assert.deepEqual(pages.flatMap(p => p.table!.rows), rows);
  for (const page of pages) for (const m of sheetPresentation(page, { ...info, total: pages.length }).marks) {
    if (m.kind !== 'text' || !['cell', 'head'].includes(m.font)) continue;
    const b = wordBox(m); assert.ok(b.x0 >= 20 && b.x1 <= 410 && b.y1 < 253, 'schedule text outside paper area');
  }
});

test('saved paper positions are applied to the same SVG marks used for export', () => {
  const s = technicalDrawings(input('l'))[0]!, original = sheetPresentation(s, info), anchor = original.anchors.find(a => a.key.includes('/tag:'))!;
  const offset = { [anchor.key]: { x: anchor.offset.x + 4, y: anchor.offset.y + 4 } };
  const adjusted = sheetPresentation(s, info, offset), actual = adjusted.anchors.find(a => a.key === anchor.key)!;
  assert.ok(actual); assert.notEqual(sheetSvg(s, info), sheetSvg(s, info, offset));
  assert.equal(adjusted.warnings.length, 0); assert.equal(adjusted.anchors.length, original.anchors.length);
});


test('K32 wall shelf stays one board, has shelf labels and brackets, and is never described as a cabinet', () => {
  const shelf = { ...unit(32, 0, 0), y: 153, design: { ...createKitchenDesign('shelf'), w: 293, h: 3, d: 30 } };
  const model = { pieces: [shelf] }, placed = placePieces(model)[0]!;
  assert.equal(placed.mark, 'K32'); assert.equal(placed.fixture, 'shelf');
  const sheets = technicalDrawings(model), upper = sheets.find(s => s.title === 'Upper furniture plan')!;
  const elevation = sheets.find(s => s.title === 'Front elevation K32')!;
  for (const s of [upper, elevation]) {
    assert.ok(items(s).some(i => i.kind === 'tag' && i.text === 'K32'));
    assert.ok(items(s).some(i => i.kind === 'note' && i.lines.includes('Wall shelf')));
    const presentation = sheetPresentation(s, info); assert.deepEqual(presentation.warnings, []);
  }
  const board = items(elevation).find(i => i.kind === 'line' && i.closed)!;
  assert.ok(board.kind === 'line');
  assert.equal(Math.max(...board.points.map(p => p.y)) - Math.min(...board.points.map(p => p.y)), 30, 'a 30 mm board, not a cabinet carcass');
  assert.ok(!sheets.some(s => /^K32  /.test(s.title)), 'no cabinet shop sheet for a shelf');
  const schedule = sheets.find(s => s.title === 'Furniture schedule')!.table!;
  assert.equal(schedule.columns[1], 'Item'); assert.equal(schedule.rows[0]![1], 'Wall shelf');
  assert.equal(schedule.rows[0]![2], '2930 × 30 × 300'); assert.match(schedule.notes.join(' '), /K = kitchen item/);
  const cutting = sheets.filter(s => s.title.startsWith('Cutting list')).flatMap(s => s.table!.rows);
  assert.equal(cutting.length, 1); assert.equal(cutting[0]![1], 'Shelf board');
  const hardware = sheets.filter(s => s.title.startsWith('Hardware list')).flatMap(s => s.table!.rows);
  assert.deepEqual(hardware.map(row => row[0]), ['Shelf bracket']); assert.equal(hardware[0]![2], '5');
});
