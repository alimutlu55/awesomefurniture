import { test } from 'node:test';
import assert from 'node:assert/strict';
import { continuousStudio } from '../../src/domain/studio/continuous-studio';
import { wallLine, type Studio } from '../../src/domain/studio/studio';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';

test('continuousStudio merges collinear wall extensions and preserves openings with shifted offsets', () => {
  const studio: Studio = {
    template: 'custom',
    corners: [
      { id: 'c0', x: 0, z: 0 },
      { id: 'c1', x: 200, z: 0 },
      { id: 'c2', x: 500, z: 0 },
      { id: 'c3', x: 500, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ],
    walls: [
      { id: 'w1', a: 'c0', b: 'c1', thickness: 10, height: 260 },
      { id: 'w2', a: 'c1', b: 'c2', thickness: 10, height: 260 },
      { id: 'w3', a: 'c2', b: 'c3', thickness: 10, height: 260 },
      { id: 'w4', a: 'c3', b: 'c4', thickness: 10, height: 260 },
      { id: 'w5', a: 'c4', b: 'c0', thickness: 10, height: 260 },
    ],
    openings: [
      { id: 'o1', wall: 'w1', kind: 'door', offset: 80, width: 90, height: 210, sill: 0 },
      { id: 'o2', wall: 'w2', kind: 'window', offset: 150, width: 120, height: 120, sill: 90 },
    ],
  };

  const cStudio = continuousStudio(studio)!;
  assert.equal(cStudio.walls.length, 4, 'five walls merged into four');
  assert.equal(cStudio.corners.length, 4, 'intermediate corner removed');

  const topWall = cStudio.walls.find(w => w.id === 'w1')!;
  assert.equal(topWall.a, 'c0');
  assert.equal(topWall.b, 'c2');
  const l = wallLine(cStudio, topWall)!;
  assert.equal(l.length, 500);

  const o1 = cStudio.openings.find(o => o.id === 'o1')!;
  assert.equal(o1.wall, 'w1');
  assert.equal(o1.offset, 80);

  const o2 = cStudio.openings.find(o => o.id === 'o2')!;
  assert.equal(o2.wall, 'w1', 'opening shifted to merged wall');
  assert.equal(o2.offset, 200 + 150, 'opening offset shifted by first wall length');
});

test('cabinets straddling extended wall seams retain full width in drawings', () => {
  const studio: Studio = {
    template: 'custom',
    corners: [
      { id: 'c0', x: 0, z: 0 },
      { id: 'c1', x: 0, z: 282.7 },
      { id: 'c2', x: 0, z: 446.9 },
      { id: 'c3', x: 400, z: 446.9 },
      { id: 'c4', x: 400, z: 0 },
    ],
    walls: [
      { id: 'wB', a: 'c0', b: 'c1', thickness: 12, height: 270 },
      { id: 'wA', a: 'c1', b: 'c2', thickness: 12, height: 270 },
      { id: 'w3', a: 'c2', b: 'c3', thickness: 12, height: 270 },
      { id: 'w4', a: 'c3', b: 'c4', thickness: 12, height: 270 },
      { id: 'w5', a: 'c4', b: 'c0', thickness: 12, height: 270 },
    ],
    openings: [],
  };

  // K21 is a 71.6 cm cabinet placed across the seam at z = 282.7 (spans 253.6 to 325.2 cm)
  const k21 = {
    id: 21,
    name: 'Base unit',
    x: 29,
    y: 0,
    z: 289.4,
    angle: 90,
    design: { ...createKitchenDesign('base', 'drawers'), w: 71.6, d: 58, h: 88, product: 'kitchen' as const },
  };

  const sheets = technicalDrawings({ studio, pieces: [k21] }, { preset: 'installation' });
  const plan = sheets[0]!;
  const dims = plan.views.flatMap(v => v.items).filter(i => i.kind === 'dims');
  const frontChain = dims.find(d => d.stops.some(s => s === 716));
  assert.ok(frontChain, 'dimension chain contains 716 mm full cabinet width');
});
