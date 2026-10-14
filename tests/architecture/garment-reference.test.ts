import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeGarmentSpec, buildGarmentGeometry, smooth, DRAPE, GARMENT_TYPES } from '../../src/presentation/viewport/garment-shape';
import { GARMENT_COLOURS } from '../../src/presentation/viewport/fabric';
import { createGarmentMaterials } from '../../src/presentation/viewport/garment-materials';

test('shirt body matches Drape Lab dimensions at every panel vertex', () => {
  const sp = makeGarmentSpec(11, 110, 43, GARMENT_COLOURS[0]);
  const geometry = buildGarmentGeometry(sp);
  const positions = geometry.getAttribute('position');
  // Reference panel equation, converted from metres to centimetres. Taper remains a ratio.
  for (let row = 0; row <= 44; row++) {
    for (let column = 0; column <= 26; column++) {
      const i = row * 27 + column;
      const s = -1 + 2 * column / 26;
      const d = -positions.getY(i);
      const armhole = 22.5;
      const width = (19 + 2.5 * (1 - smooth(5.5, armhole, d))) *
        (1 - .02 * smooth(armhole, armhole + 10, d) * (1 - smooth(armhole + 10, 78 * .95, d)));
      assert.ok(Math.abs(positions.getX(i) - s * width) < 1e-5, `panel ${row}, ${column}`);
    }
  }
  assert.equal(sp.len, 78);
  assert.equal(sp.sleeve, 58);
  assert.ok(Math.abs(sp.rotY - 81 * Math.PI / 180) < 1e-10);
  geometry.dispose();
});

test('reference colours enter the renderer in linear space and retain dark buttons', () => {
  for (const hex of GARMENT_COLOURS) {
    const sp = makeGarmentSpec(11, 110, 43, hex);
    assert.equal(sp.color.clone().convertLinearToSRGB().getHexString(), hex.slice(1));
    const materials = createGarmentMaterials('poplin', sp.color);
    const cloth = materials[0] as THREE.MeshPhysicalMaterial;
    const buttons = materials[2] as THREE.MeshStandardMaterial;
    assert.equal(cloth.roughness, .78);
    assert.equal(buttons.color.clone().convertLinearToSRGB().getHex(), hex === '#4c5872' ? 0xe8e2d2 : 0x403b36);
    materials.forEach(material => material.dispose());
  }
});

test('zero variation gives identical geometry and short fittings keep hems clear', () => {
  assert.equal(DRAPE.foldDepth, 0);
  assert.equal(DRAPE.variation, 0);
  assert.equal(DRAPE.pitch, 2);
  assert.equal(GARMENT_TYPES.jacket.waist, .05);
  assert.equal(GARMENT_TYPES.coat.flare, .06);
  const a = buildGarmentGeometry(makeGarmentSpec(1, 65, 43));
  const b = buildGarmentGeometry(makeGarmentSpec(99, 65, 43));
  assert.deepEqual(a.getAttribute('position').array, b.getAttribute('position').array);
  a.computeBoundingBox();
  assert.ok(a.boundingBox!.min.y >= -(65 - 7.5 - 2) - 1e-5);
  a.dispose();
  b.dispose();
});
