import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { wallLine } from '../../src/domain/studio/studio';
import { addOpening, moveOpening } from '../../src/domain/studio/studio-edit';
import { WALL_UTILITIES } from '../../src/domain/studio/wall-utilities';
import { FIXTURES } from '../../src/domain/studio/fixtures/fixture-kinds';
import { addFixture } from '../../src/domain/studio/fixtures/fixture-edit';
import { studioWallItems, wallItemSegments } from '../../src/domain/studio/studio-wall-items';
import { createEditorState } from '../../src/application/projects/editor-state';
import { cabinetBox, selectedDimensions } from '../../src/presentation/editor/studio-2d-dimensions';
import { renderUtilities, utilityMarkers } from '../../src/presentation/editor/studio-2d-utilities';
import { layoutPlanLabels, polygonOverlapsRect } from '../../src/presentation/editor/studio-2d-labels';
import { createTransform } from '../../src/presentation/editor/studio-2d-canvas';

const setup = () => {
  let studio = addOpening(rectangleStudio(600, 400), 'w1', WALL_UTILITIES[0]!.kind)!;
  studio = moveOpening(studio, studio.openings[0]!.id, 300)!;
  studio = addFixture(studio, 'w1', FIXTURES[0]!.key, 400)!;
  const cabinet = { id: 1, name: 'Wardrobe', x: -136, y: 0, z: 30, angle: 0,
    state: { ...createEditorState(), w: 100, d: 60, h: 180 } };
  return { studio, cabinet };
};

test('utilities, fixtures and wall-standing furniture share the nearest-item clearance calculation', () => {
  const { studio, cabinet } = setup(), items = studioWallItems(studio, [cabinetBox(cabinet)]);
  const utility = items.find(i => i.kind === 'opening')!, fixture = items.find(i => i.kind === 'fixture')!, wardrobe = items.find(i => i.kind === 'furniture')!;
  const spans = (selected: typeof utility) => wallItemSegments(studio, 'w1', items, selected);
  assert.equal(spans(wardrobe).find(s => s.side === 'right')!.to - wardrobe.to, 68);
  assert.equal(utility.from - spans(utility).find(s => s.side === 'left')!.from, 68);
  assert.equal(spans(utility).find(s => s.side === 'right')!.to, fixture.from);
  assert.equal(spans(fixture).find(s => s.side === 'left')!.from, utility.to);
  for (const selected of items) {
    const selection = selected.kind === 'furniture' ? null : { kind: selected.kind, id: String(selected.id) };
    const dims = selectedDimensions(studio, [cabinet], selection, selected.kind === 'furniture' ? cabinet.id : null);
    const expected = selected.kind === 'furniture' ? 68 : selected.kind === 'fixture' ? fixture.from - utility.to : 68;
    assert.ok(dims.some(d => Math.abs(Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) - expected) < .01), selected.kind);
  }
});

test('overlapping wall projections do not invent a positive gap, while the selected size stays intact', () => {
  const { studio, cabinet } = setup();
  const room = moveOpening(studio, studio.openings[0]!.id, 170)!;
  const items = studioWallItems(room, [cabinetBox(cabinet)]), utility = items.find(i => i.kind === 'opening')!;
  const segments = wallItemSegments(room, 'w1', items, utility);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]!.item, utility);
  assert.equal(segments[0]!.to - segments[0]!.from, utility.width);
});

test('utility markers stay 20 px wide and outside furniture, with a leader to their actual wall position', () => {
  const { studio, cabinet } = setup();
  const room = moveOpening(studio, studio.openings[0]!.id, 170)!;
  for (const zoom of [.2, .6, 2.5]) {
    const marker = utilityMarkers(room, zoom)[0]!, line = wallLine(room, room.walls[0]!)!;
    assert.equal(marker.radius * 2 * zoom, 20);
    const separation = (marker.x - marker.anchor.x) * line.nx + (marker.z - marker.anchor.z) * line.nz;
    assert.ok(separation < -marker.radius - room.walls[0]!.thickness);
    const svg = renderUtilities(room, { kind: 'opening', id: marker.id }, zoom);
    assert.ok(svg.includes('sp2d-utility-leader')); assert.ok(svg.includes('selected'));
    const transform = { width: 1440, height: 900, panX: 0, panZ: 150, zoom };
    const p = createTransform(transform).toScreen(marker), r = marker.radius * zoom;
    const polygon = [{ x: p.x - r, z: p.z - r }, { x: p.x + r, z: p.z - r }, { x: p.x + r, z: p.z + r }, { x: p.x - r, z: p.z + r }];
    const labels = layoutPlanLabels({ studio: room, wardrobes: [cabinet], selection: { kind: 'opening', id: marker.id }, transform });
    assert.ok(labels.every(l => !polygonOverlapsRect(polygon, l.box)), 'labels never cover the utility marker');
  }
});
