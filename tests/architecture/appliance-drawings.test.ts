import test from 'node:test';
import assert from 'node:assert/strict';
import type { Studio } from '../../src/domain/studio/studio';
import type { DrawingPiece } from '../../src/domain/drawings/room-pieces';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { fixtureDatum, fixturePosition, fixtureRun, runOffsets, applianceAllocations, applianceReview, applianceSchedule } from '../../src/domain/drawings/appliance-setout';
import { sheetPresentation, sheetSvg } from '../../src/presentation/drawings/sheet-marks';
import { paginateDrawingSheets } from '../../src/presentation/drawings/table-marks';
import { wordBox, intersectsBox } from '../../src/presentation/drawings/annotation-layout';

const wall = (): Studio => ({ template: 'custom', corners: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 400, z: 0 }],
  walls: [{ id: 'w', a: 'a', b: 'b', height: 270, thickness: 10 }], openings: [] });
const base = (id: number, x: number): DrawingPiece => ({ id, name: 'Base', x, y: 0, z: 34, angle: 0, design: createKitchenDesign('base') });
const sink = (): DrawingPiece => ({ id: 13, name: 'Sink', x: 148, y: 90, z: 36, angle: 0,
  design: { ...createKitchenDesign('sink-top'), w: 72, d: 50 } });
const scene = () => ({ studio: wall(), pieces: [base(1, 130), base(2, 190), sink()] });
const info = { project: 'Appliance QA', date: '20.10.2026', total: 1 };

test('sink set-out uses exact finished wall, worktop edges and current overall dimensions', () => {
  const input = scene(), before = JSON.stringify(input), pieces = placePieces(input), p = pieces.find(p => p.id === 13)!;
  assert.deepEqual(fixtureDatum(input.studio, p, pieces), { wall: 'A', along: 148, normal: 31 });
  const run = fixtureRun(p, pieces)!; assert.ok(run);
  assert.deepEqual(runOffsets(p, run), { s: 48, t: 31, left: 12, right: 36, back: 6, front: 4 });
  const sheets = technicalDrawings(input, { preset: 'installation' });
  const schedule = sheets.find(s => s.title === 'Appliance schedule')!;
  const labels = schedule.table!.rows.flat().join(' ');
  assert.ok(labels.includes('720 W × 500 D overall'));
  assert.ok(labels.includes('CL 1480 from Wall A left')); assert.ok(labels.includes('CL 310 from Wall A face'));
  const detail = sheets.find(s => s.title === 'K13 Sink setting out')!;
  const dimensions = detail.views[0]!.items.filter(i => i.kind === 'dims').map(d => d.stops);
  assert.deepEqual(dimensions, [[0, 720], [0, 500]], 'actual footprint gets explicit width and depth dimensions');
  assert.ok(detail.views[1]!.items.some(i => i.kind === 'dims' && i.stops.join() === '0,480,1200'));
  assert.ok(detail.views[1]!.items.some(i => i.kind === 'dims' && i.stops.join() === '0,310,600'));
  assert.equal(JSON.stringify(input), before, 'export never moves/resizes the design');
});

test('rotating the whole room retains fixture datums and edge gaps to the millimetre', () => {
  const input = scene(), a = 37 * Math.PI / 180;
  const rotate = (x: number, z: number) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) });
  const studio = { ...input.studio, corners: input.studio.corners.map(c => ({ ...c, ...rotate(c.x, c.z) })) };
  const pieces = placePieces({ studio, pieces: input.pieces.map(p => ({ ...p, ...rotate(p.x, p.z), angle: 37 })) });
  const p = pieces.find(p => p.id === 13)!, datum = fixtureDatum(studio, p, pieces)!;
  assert.equal(Math.round(datum.along * 10), 1480); assert.equal(Math.round(datum.normal * 10), 310);
  const gaps = runOffsets(p, fixtureRun(p, pieces)!);
  assert.deepEqual([gaps.left, gaps.right, gaps.back, gaps.front].map(v => Math.round(v * 10)), [120, 360, 60, 40]);
});

test('island fixture uses its worktop datum; unsupported or overhanging fixtures are reported', () => {
  const input = scene(), pieces = placePieces({ pieces: input.pieces }), p = pieces.find(p => p.id === 13)!;
  const notes = fixturePosition(undefined, p, pieces).join(' ');
  assert.match(notes, /Run K1\/K2/); assert.match(notes, /CL 480 from left/); assert.doesNotMatch(notes, /Wall/);
  const unsupported = placePieces({ pieces: [{ ...sink(), y: 91 }, ...input.pieces.slice(0, 2)] });
  assert.ok(applianceReview(unsupported).some(i => i.id === 'worktop:13'));
  const oversize = placePieces({ pieces: [...input.pieces.slice(0, 2), { ...sink(), design: { ...sink().design, w: 130 } }] });
  assert.ok(applianceReview(oversize).some(i => i.id === 'worktop-edge:13'));
  assert.equal(Math.round(runOffsets(oversize.find(p => p.id === 13)!, fixtureRun(oversize.find(p => p.id === 13)!, oversize)!).left * 10), -170);
});

test('oven allocations separate real housing geometry from unconfirmed appliance and niche requirements', () => {
  const design = createKitchenDesign('base'); design.secs[0] = [{ k: 'oven', h: 60 }];
  const input = { pieces: [{ ...base(8, 0), design }] }, p = placePieces(input)[0]!;
  assert.deepEqual(applianceAllocations(p), [{ reference: 'K8.1', name: 'Oven', x: 1.8, y: 9.8, width: 56.4, height: 60, depth: 57.4 }]);
  const sheets = technicalDrawings(input), detail = sheets.find(s => s.title === 'K8 appliance allocations')!;
  const text = detail.views.flatMap(v => v.items).filter(i => i.kind === 'note').flatMap(i => i.lines).join(' ');
  assert.match(text, /564 W × 600 H allocation/); assert.match(text, /bottom FFL 98/); assert.match(text, /Clear carcass depth 574/);
  assert.match(detail.legend!.join(' '), /Actual appliance.*UNCONFIRMED/);
  const schedule = applianceSchedule(undefined, [p])!;
  assert.match(schedule.rows[0]![4]!, /UNCONFIRMED/); assert.match(schedule.rows[0]![1]!, /allocation/);
  assert.ok(sheets[0]!.issues!.some(i => i.id === 'appliance-spec:8' && i.kind === 'unconfirmed'));
});

test('cutting list and appliance sheets never invent cutting-template dimensions', () => {
  const sheets = technicalDrawings(scene()), cutting = sheets.filter(s => s.title.startsWith('Cutting list')).flatMap(s => s.table!.rows);
  const top = cutting.find(r => r[1] === 'Worktop')!;
  assert.match(top[8]!, /cut-outs for K13: UNCONFIRMED/);
  const schedule = sheets.find(s => s.title === 'Appliance schedule')!.table!;
  assert.match(schedule.rows[0]![4]!, /UNCONFIRMED: cut-out/);
  const detail = sheets.find(s => s.title === 'K13 Sink setting out')!;
  assert.match(sheetSvg(detail, info), /confirm manufacturer cutting template/);
  assert.deepEqual(sheetPresentation(detail, info).warnings, []);
});

test('appliance schedules retain all devices and readable text across pagination', () => {
  const input = scene(), many = Array.from({ length: 30 }, (_, n) => ({ ...sink(), id: n + 100, x: n * 100 }));
  const sheets = paginateDrawingSheets(technicalDrawings({ studio: input.studio, pieces: [...input.pieces.slice(0, 2), ...many] }));
  const schedules = sheets.filter(s => s.title.startsWith('Appliance schedule'));
  assert.ok(schedules.length > 1); assert.equal(schedules.flatMap(s => s.table!.rows).length, 30);
  for (const s of schedules) for (const m of sheetPresentation(s, info).marks) {
    if (m.kind !== 'text' || !['cell', 'head'].includes(m.font)) continue;
    assert.ok(wordBox(m).y1 < 253, 'table text clipped into title strip');
  }
});


test('overlapping corner worktops choose the span containing the complete footprint independent of input order', () => {
  const horizontal = { ...base(1, 160), design: { ...createKitchenDesign('base'), w: 120 } };
  const perpendicular = { ...base(2, 148), z: 36, angle: 90, design: { ...createKitchenDesign('base'), w: 120 } };
  const pieces = placePieces({ pieces: [perpendicular, horizontal, sink()] }), p = pieces.find(p => p.id === 13)!;
  const span = fixtureRun(p, pieces)!;
  assert.deepEqual(span.units, [1]); assert.equal(span.angle, 0);
  assert.ok(!applianceReview(pieces).some(i => i.id === 'worktop-edge:13'));
});


test('fixture centre lines stop before the paper dimension figures on overall and setting-out views', () => {
  const detail = technicalDrawings(scene()).find(s => s.title === 'K13 Sink setting out')!;
  const marks = sheetPresentation(detail, info).marks;
  const figures = marks.filter(m => m.kind === 'text' && m.font === 'figure').map(m => wordBox(m as Parameters<typeof wordBox>[0]));
  for (const m of marks) {
    if (m.kind !== 'shape' || m.pen !== 'centre') continue;
    const box = { x0: Math.min(...m.points.map(p => p.x)) - .01, x1: Math.max(...m.points.map(p => p.x)) + .01,
      y0: Math.min(...m.points.map(p => p.y)) - .01, y1: Math.max(...m.points.map(p => p.y)) + .01 };
    for (const figure of figures) assert.ok(!intersectsBox(box, figure), 'centre line crosses a dimension figure');
  }
});
