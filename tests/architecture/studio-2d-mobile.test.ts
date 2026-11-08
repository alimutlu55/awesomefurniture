import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio, rectangleStudio } from '../../src/domain/studio/studio-templates';
import { wallLine } from '../../src/domain/studio/studio';
import { door2DPlan } from '../../src/domain/studio/studio-plan';
import { OPENING_KINDS } from '../../src/domain/studio/wall-utilities';
import { addOpening } from '../../src/domain/studio/studio-edit';
import { FIXTURES } from '../../src/domain/studio/fixtures/fixture-kinds';
import { addFixture } from '../../src/domain/studio/fixtures/fixture-edit';
import { fixturePlace } from '../../src/domain/studio/fixtures/fixture-place';
import { FINGER_REACH, nearbyWall, nearbyWallAsset, slideWallAsset } from '../../src/presentation/editor/studio-2d-assets';
import { overlayInsets, planScale } from '../../src/presentation/editor/studio-2d-overlays';
import { layoutPlanLabels, renderPlanLabels } from '../../src/presentation/editor/studio-2d-labels';

for (const zoom of [.2, .6, 2.5]) {
  test(`wall assets have a finger-sized target at zoom ${zoom}`, () => {
    for (const kind of OPENING_KINDS) {
      const studio = addOpening(rectangleStudio(600, 500), 'w1', kind)!;
      assert.ok(studio, kind);
      const o = studio.openings[0]!, line = wallLine(studio, studio.walls[0]!)!;
      const at = { x: line.a.x + line.ux * o.offset, z: line.a.z + line.uz * o.offset + 6 };
      assert.deepEqual(nearbyWallAsset(studio, { x: at.x, z: at.z + 20 / zoom }, zoom), { kind: 'opening', id: o.id });
      assert.equal(nearbyWallAsset(studio, { x: at.x, z: at.z - 30 / zoom }, zoom), null);
    }
    for (const kind of FIXTURES) {
      const studio = addFixture(rectangleStudio(600, 500), 'w1', kind.key, 200)!;
      const f = studio.fixtures![0]!, place = fixturePlace(studio, f)!;
      const p = { x: place.solid.x + f.width / 2 + 20 / zoom, z: place.solid.z };
      assert.deepEqual(nearbyWallAsset(studio, p, zoom), { kind: 'fixture', id: f.id });
    }
  });
}

for (const zoom of [.2, .6, 2.5]) {
  test(`walls have a finger-sized target at zoom ${zoom}`, () => {
    const studio = rectangleStudio(600, 500);
    for (const w of studio.walls) {
      const line = wallLine(studio, w)!, mid = { x: line.a.x + line.ux * line.length / 2, z: line.a.z + line.uz * line.length / 2 };
      const off = (px: number, side: number) => ({ x: mid.x + side * line.nx * (w.thickness / 2 + px / zoom), z: mid.z + side * line.nz * (w.thickness / 2 + px / zoom) });
      assert.equal(nearbyWall(studio, mid, zoom), w.id, 'on the wall');
      for (const side of [-1, 1]) {
        assert.equal(nearbyWall(studio, off(FINGER_REACH - 4, side), zoom), w.id, `${FINGER_REACH - 4} px off, side ${side}`);
        assert.equal(nearbyWall(studio, off(FINGER_REACH + 6, side), zoom), null, `${FINGER_REACH + 6} px off, side ${side}`);
      }
    }
  });
}

test('the door swing area is selectable without hitting its thin leaf or arc', () => {
  const studio = createStudio('bedroom'), o = studio.openings.find(o => o.kind === 'door')!, door = door2DPlan(studio, o)!;
  const p = { x: (door.hingePoint.x + door.closedPoint.x + door.openPoint.x) / 3,
    z: (door.hingePoint.z + door.closedPoint.z + door.openPoint.z) / 3 };
  assert.deepEqual(nearbyWallAsset(studio, p, 2.5), { kind: 'opening', id: o.id });
});

test('edge grabs slide openings and fixtures by pointer travel without jumping their centres', () => {
  const studio = createStudio('bedroom'), o = studio.openings[0]!;
  const next = slideWallAsset(studio, studio, { kind: 'opening', id: o.id }, { x: 220, z: 260 }, { x: 240, z: 240 })!;
  assert.equal(next.openings[0]!.offset, o.offset - 20);
  const room = addFixture(rectangleStudio(600, 500), 'w1', FIXTURES[0]!.key, 200)!;
  const moved = slideWallAsset(room, room, { kind: 'fixture', id: room.fixtures![0]!.id }, { x: 0, z: 20 }, { x: 25, z: 50 })!;
  assert.equal(moved.fixtures![0]!.offset, 225);
});

test('the scale stays readable, geometrically correct and bounded across zoom levels', () => {
  for (const zoom of [.15, .25, .6, 1, 2.5, 6]) {
    const scale = planScale(zoom, 375);
    assert.equal(scale.pixels, scale.cm * zoom);
    assert.ok(scale.pixels >= 40 && scale.pixels <= 120);
    assert.ok(scale.label.endsWith(' m') || scale.label.endsWith(' cm'));
  }
  const rect = (top: number, bottom: number, width = 375) => ({ top, bottom, width, height: bottom - top }) as DOMRect;
  const insets = overlayInsets(rect(100, 900), rect(810, 880), rect(116, 170));
  assert.equal(insets.bottom, 686, 'scale baseline is 24 px above the actual toolbar');
  assert.equal(insets.top, 102, 'compass clears top controls');
});

test('dimension halos paint separately behind clean foreground digits, including rotated labels', () => {
  const studio = createStudio('bedroom');
  const labels = layoutPlanLabels({ studio, wardrobes: [], selection: { kind: 'opening', id: 'o1' },
    transform: { width: 1440, height: 900, panX: 0, panZ: 175, zoom: 1.5 } });
  assert.ok(labels.some(l => Math.abs(l.angle) === 90));
  const markup = renderPlanLabels(labels);
  const dimensions = labels.filter(l => l.kind === 'dimension');
  assert.equal([...markup.matchAll(/class="sp2d-text-halo"/g)].length, dimensions.length);
  assert.ok(markup.indexOf('sp2d-text-halo') < markup.indexOf('class="sp2d-dim-text"'));
  assert.ok(!markup.includes('paint-order'), 'no per-glyph halo painting on foreground text');
});
