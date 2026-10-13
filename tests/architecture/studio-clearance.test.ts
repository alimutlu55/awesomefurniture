import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ceilingClearance } from '../../src/domain/studio/studio-clearance';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import type { Studio } from '../../src/domain/studio/studio';
import type { WardrobeShape } from '../../src/domain/wardrobe/shape/wardrobe-shape';

const top = (points: [number, number][]): WardrobeShape => ({ template: 'custom', top: points.map(([x, y]) => ({ x, y })) });
const pose = { x: 0, z: 30, angle: 0, w: 200, d: 60 };
function room(run: 'along' | 'across', points: [number, number][]): Studio {
  return { ...rectangleStudio(400, 350), ceilings: [{ id: 'k1', wall: 'w1', run, depth: 100, profile: points.map(([t, y]) => ({ t, y })) }] };
}

test('edits beneath a slope can rise through clear space up to actual contact', () => {
  const blocks = ceilingClearance(room('along', [[6, 100], [406, 240]]), pose);
  assert.equal(blocks(top([[0, 130], [200, 190]])), false);
  assert.equal(blocks(top([[0, 135], [200, 205]])), false, 'flush with the real slope');
  assert.equal(blocks(top([[0, 135], [200, 206]])), true);
  assert.equal(blocks(top([[0, 130], [100, 180], [200, 190]])), true, 'interior break points are checked');
});

test('a slope across depth includes hidden rear contact and follows changes in position and elevation', () => {
  const studio = room('across', [[0, 100], [200, 240]]);
  assert.equal(ceilingClearance(studio, pose)(top([[0, 100], [200, 100]])), false);
  assert.equal(ceilingClearance(studio, pose)(top([[0, 110], [200, 110]])), true, 'front clearance alone is insufficient');
  assert.equal(ceilingClearance(studio, { ...pose, z: 50 })(top([[0, 110], [200, 110]])), false);
  assert.equal(ceilingClearance(studio, { ...pose, z: 50, y: 10 })(top([[0, 110], [200, 110]])), true);
});

test('rotated footprints are checked against ceiling planes over their full depth', () => {
  const studio = room('along', [[6, 100], [406, 240]]);
  const blocks = ceilingClearance(studio, { ...pose, x: 0, z: 160, angle: 90, w: 100, d: 40 });
  // Rotated depth spans room x=-20..20: the lowest clearance is 163 cm.
  const deeper = { ...studio, ceilings: studio.ceilings!.map(c => ({ ...c, depth: 250 })) };
  const rotated = ceilingClearance(deeper, { ...pose, z: 160, angle: 90, w: 100, d: 40 });
  assert.equal(blocks(top([[0, 200], [100, 200]])), false, 'outside the original ceiling depth');
  assert.equal(rotated(top([[0, 160], [100, 160]])), false);
  assert.equal(rotated(top([[0, 164], [100, 164]])), true);
});

test('flush steps are allowed; even sub-centimetre penetration beside a step is blocked', () => {
  const blocks = ceilingClearance(room('along', [[106, 230], [156.3, 230], [156.3, 150], [306, 150]]), pose);
  assert.equal(blocks(top([[0, 230], [50.3, 230], [50.3, 150], [200, 150]])), false);
  assert.equal(blocks(top([[0, 230], [50.6, 230], [50.6, 150], [200, 150]])), true);
});

test('narrow ceilings between old depth samples and multiple overlapping ceilings remain solid', () => {
  const studio = room('across', [[10.2, 120], [10.4, 120]]);
  assert.equal(ceilingClearance(studio, pose)(top([[0, 130], [200, 130]])), true);
  const overlapping: Studio = { ...studio, ceilings: [...studio.ceilings!, { id: 'k2', wall: 'w1', run: 'along', depth: 60,
    profile: [{ t: 106, y: 110 }, { t: 306, y: 110 }] }] };
  assert.equal(ceilingClearance(overlapping, pose)(top([[0, 115], [200, 115]])), true);
  assert.equal(ceilingClearance(overlapping, pose)(top([[0, 110], [200, 110]])), false);
});
