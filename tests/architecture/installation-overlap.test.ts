import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { installationSolid } from '../../src/domain/kitchen/installation-parts';

const strip = { id: 1, name: 'Strip', x: 0, y: 0, z: 29, angle: 0, design: createKitchenDesign('filler') };
const cabinet = { id: 2, name: 'Cabinet', x: 0, y: 0, z: 88.7, angle: 0, design: createKitchenDesign('base') };
const clash = (items: typeof strip[]) => validateForManufacture({ pieces: items }).findings.some(f => f.id === 'clash:K1:K2' || f.id === 'clash:K2:K1');

test('manufacture catches a 1 mm penetration of the actual strip stock beyond its reserved envelope', () => {
  for (const angle of [0, 17, 90, 270]) {
    const a = angle * Math.PI / 180;
    const rotate = (p: typeof strip) => ({ ...p, x: p.x * Math.cos(a) + p.z * Math.sin(a), z: -p.x * Math.sin(a) + p.z * Math.cos(a), angle });
    assert.equal(clash([rotate(strip), rotate(cabinet)]), true, 'detects the strip stock at ' + angle);
    assert.equal(clash([rotate(strip), rotate({ ...cabinet, z: 88.8 })]), false, 'exact contact is allowed at ' + angle);
  }
});

test('front strip collision bounds use its actual 18 mm stock and start above the plinth', () => {
  const solid = installationSolid({ ...strip, state: strip.design });
  assert.deepEqual(Object.values(solid.state).map(v => Math.round(v * 10)), [40, 780, 18]);
  assert.equal(solid.y, 8);
  assert.ok(Math.abs(solid.z - 58.9) < 1e-8);
});


test('strip clearance includes the adjoining front thickness, even when both carcasses are clear', () => {
  const withFront = { ...cabinet, z: 90.5, angle: 180, design: createKitchenDesign('base', 'drawers') };
  assert.equal(clash([strip, withFront]), true, '1 mm front-stock overlap is a real clash');
  assert.equal(clash([strip, { ...withFront, z: 90.6 }]), false, 'finished front exact contact is allowed');
});
