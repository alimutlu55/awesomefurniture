import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGarmentRenderer } from '../../src/presentation/viewport/garment-renderer';
import { disposeCabinetGroup } from '../../src/presentation/viewport/render-disposal';

function fixture() {
  const state = { Gr: new THREE.Group(), garments: [] as import('../../src/presentation/viewport/garment-renderer').GarmentInstance[] };
  const renderer = createGarmentRenderer({ renderState: state });
  const add = (x = 0, height = 100, color = '#c9d3e0') => renderer.garment(x, 100, 0, height, 42, color);
  const cloth = () => state.garments.at(-1)!.pivot.children[0] as THREE.Mesh;
  const rebuild = () => {
    disposeCabinetGroup(state.Gr, renderer.sharedMaterials, renderer.sharedGeometries);
    state.Gr.clear(); state.garments = []; renderer.beginBuild();
  };
  return { state, renderer, add, cloth, rebuild };
}

test('identical clothes reuse their full-resolution assets across items and rebuilds', () => {
  const f = fixture();
  f.renderer.beginBuild(); f.add(); const first = f.cloth();
  f.add(12); const second = f.cloth(); f.renderer.endBuild();
  assert.equal(first.geometry, second.geometry);
  assert.equal(first.material, second.material);
  assert.notEqual(f.state.garments[0]!.pivot, f.state.garments[1]!.pivot);
  assert.notEqual(f.state.garments[0]!.sp.ph1, f.state.garments[1]!.sp.ph1);
  let freed = 0; first.geometry.addEventListener('dispose', () => freed++);
  f.rebuild(); f.add(); f.renderer.endBuild();
  assert.equal(f.cloth().geometry, first.geometry);
  assert.equal(f.cloth().material, first.material);
  assert.equal(freed, 0);
  f.renderer.dispose(); f.renderer.dispose();
  assert.equal(freed, 1);
  assert.equal(f.renderer.sharedGeometries.size, 0);
  assert.equal(f.renderer.sharedMaterials.size, 0);
});

test('resizing and recolouring replace only affected assets and release removed clothing', () => {
  const f = fixture(); f.renderer.beginBuild(); f.add(); f.renderer.endBuild();
  const original = f.cloth(); let disposed = 0;
  original.geometry.addEventListener('dispose', () => disposed++);
  f.rebuild(); f.add(0, 100, '#4c5872'); f.renderer.endBuild();
  const recoloured = f.cloth();
  assert.equal(recoloured.geometry, original.geometry);
  assert.notEqual(recoloured.material, original.material);
  f.rebuild(); f.add(0, 65, '#4c5872'); f.renderer.endBuild();
  assert.notEqual(f.cloth().geometry, original.geometry);
  assert.equal(f.cloth().material, recoloured.material);
  assert.equal(disposed, 1);
  f.rebuild(); f.renderer.endBuild();
  assert.equal(f.renderer.sharedGeometries.size, 0);
  assert.equal(f.renderer.sharedMaterials.size, 0);
  f.renderer.dispose();
});

test('editors own separate caches and disposal does not release another editor’s clothes', () => {
  const a = fixture(), b = fixture(); a.add(); b.add();
  assert.notEqual(a.cloth().geometry, b.cloth().geometry);
  assert.notEqual(a.cloth().material, b.cloth().material);
  let freed = 0; b.cloth().geometry.addEventListener('dispose', () => freed++);
  a.renderer.dispose(); assert.equal(freed, 0);
  b.renderer.dispose(); assert.equal(freed, 1);
});
