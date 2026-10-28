import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { kitchenSpans } from '../../src/domain/kitchen/kitchen-runs';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { ventilationDetails } from '../../src/domain/drawings/ventilation-details';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { sheetPresentation } from '../../src/presentation/drawings/sheet-marks';
import { installationDrawingFixture } from '../../scripts/installation-drawing-fixture.mjs';
import { drawingInputOf } from '../../src/presentation/drawings/drawing-release';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { installationSlab } from '../../src/domain/kitchen/installation-parts';
import { materialSchedule } from '../../src/domain/drawings/material-schedule';
import { hardwareList } from '../../src/domain/drawings/hardware-list';

test('arbitrary corner sizes and rotations retain their own exact face, strip and return dimensions', () => {
  const corner = { id: 1, x: 0, z: 0, y: 0, angle: 0,
    state: { ...createKitchenDesign('base', 'corner'), w: 113.7, d: 56.2, cornerStrip: 3.7 } };
  const returning = { id: 2, x: 26.15, z: 58.1, y: 0, angle: 90,
    state: { ...createKitchenDesign('base'), w: 60, d: 61.4 } };
  for (const angle of [0, 90, 180, 270, 33]) {
    const a = angle * Math.PI / 180;
    const boxes = [corner, returning].map(p => ({ ...p, angle: p.angle + angle,
      x: 176.3 + p.x * Math.cos(a) + p.z * Math.sin(a),
      z: -45.7 - p.x * Math.sin(a) + p.z * Math.cos(a) }));
    const before = structuredClone(boxes), widths = cornerCabinetWidths(boxes[0]!, boxes);
    assert.deepEqual(widths.map(s => Math.round((s.to - s.from) * 10)), [486, 37, 614]);
    assert.equal(widths.reduce((sum, s) => sum + Math.round((s.to - s.from) * 10), 0), 1137);
    assert.deepEqual(boxes, before, 'dimensioning must not modify the design');
  }
  const legacy = { ...corner, state: { ...corner.state, cornerStrip: undefined } };
  assert.deepEqual(cornerCabinetWidths(legacy, [legacy, returning]).map(s => Math.round((s.to - s.from) * 10)), [483, 40, 614],
    'legacy corners now receive the 40 mm installation default');
});

test('plan and service dimensions use arbitrary user geometry, finished-wall datums and configured construction', () => {
  const design = { ...createKitchenDesign('base'), w: 67.3, h: 90.7, d: 54.6, plinthHeight: 11.3, worktopThickness: 2.7 };
  const input = { studio: { template: 'custom' as const,
    corners: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 413.2, z: 0 }],
    walls: [{ id: 'wall', a: 'a', b: 'b', thickness: 10, height: 278.4 }],
    openings: [{ id: 'power', wall: 'wall', kind: 'socket' as const, offset: 153.7, width: 12.4, height: 8.2, sill: 106.5, status: 'retain' as const }] },
    pieces: [{ id: 8, name: 'User cabinet', x: 57.05, y: 0, z: 39, angle: 0, design }] };
  const before = structuredClone(input), sheets = technicalDrawings(input, { preset: 'installation' });
  const dimensions = sheets[0]!.views[0]!.items.filter(i => i.kind === 'dims');
  assert.ok(dimensions.some(d => d.stops.join() === '0,234,907,4132'));
  assert.ok(dimensions.some(d => d.stops.join() === '0,67,613,633'));
  const service = sheets.find(s => s.title === 'Service & lighting schedule')!.table!.rows[0]!;
  assert.deepEqual(service.slice(3), ['1537', '1106', '124 × 82']);
  const pose = { ...input.pieces[0]!, state: design };
  assert.equal(kitchenSpans([pose]).find(s => s.kind === 'worktop')!.height, 2.7);
  assert.deepEqual(input, before, 'drawing all sheets leaves the model unchanged');
});

test('standalone installation panels have no phantom worktop and full-plinth grilles have unique dimension stops', () => {
  const panel = { id: 1, x: 0, y: 0, z: 0, angle: 0, state: createKitchenDesign('end-panel') };
  assert.equal(kitchenSpans([panel]).length, 0);
  const design = { ...createKitchenDesign('tall', 'fridge'), plinthHeight: 10, ventilationWidth: 60, ventilationHeight: 10 };
  const pieces = placePieces({ pieces: [{ id: 2, name: 'Fridge', x: 0, y: 0, z: 0, angle: 0, design }] });
  const dimensions = ventilationDetails(pieces)[0]!.views[0]!.items.filter(i => i.kind === 'dims');
  assert.deepEqual(dimensions.map(d => d.stops), [[0, 600], [0, 100]]);
  design.fridgeSplit = design.h;
  assert.ok(validateForManufacture({ pieces: [{ ...pieces[0]!, design }] }).findings.some(f => f.id === 'fridge-split:K2' && f.severity === 'critical'));
});

test('dimension figures at intersecting cabinet-front and depth chains stay legible without changing values', () => {
  const scene = installationDrawingFixture() as EditorScene, sheet = technicalDrawings(drawingInputOf(scene), { preset: 'installation' })[0]!;
  const { dimensionBoxes, marks } = sheetPresentation(sheet, { project: 'Dimension layout', date: '2026-10-26', total: 1 });
  dimensionBoxes.forEach((a, i) => dimensionBoxes.slice(i + 1).forEach(b => {
    assert.ok(!(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0), 'dimension figures overlap');
  }));
  const figures = marks.flatMap(m => m.kind === 'text' && m.font === 'figure' ? [m.text] : []);
  for (const value of ['400', '40', '580', '530', '20', '4115']) assert.ok(figures.includes(value));
});

test('solid installation parts describe only their actual board and align with the adjoining cabinet front plane', () => {
  const strip = { ...createKitchenDesign('filler'), frontThickness: 1.9 }, slab = installationSlab(strip)!;
  assert.equal(slab.z0, strip.d);
  assert.equal(slab.z1, strip.d + 1.9);
  const pieces = placePieces({ pieces: [{ id: 1, name: 'Strip', x: 0, y: 0, z: 0, angle: 0, design: strip },
    { id: 2, name: 'Panel', x: 30, y: 0, z: 0, angle: 0, design: { ...createKitchenDesign('end-panel'), w: 2.2 } }] });
  const rows = materialSchedule(pieces).flatMap(t => t.rows);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]![3], '19mm'); assert.equal(rows[1]![3], '22mm');
  assert.equal(hardwareList(pieces).flatMap(t => t.rows).length, 0, 'fixed parts have no door or storage hardware');
});
