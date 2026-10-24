import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FIXTURES, TAPS } from '../../src/domain/studio/fixtures/fixture-kinds';
import type { FixtureKind } from '../../src/domain/studio/fixtures/fixture-kinds';
import type { StudioFixture } from '../../src/domain/studio/studio';
import { modelOf } from '../../src/presentation/viewport/fixture-views';
import { fixtureCardArt, setupArt, basinArt } from '../../src/presentation/editor/fixture-art';

const m = { ceramic: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), front: new THREE.MeshStandardMaterial() };

/** Every kind and type is drawn, finite, within its own width and depth (what furniture collides with) and on or
 * above the floor; a tap or a seat may rise above its rim. */
test('every fixture kind, type and tap has a model that stays inside its solid', () => {
  for (const kind of FIXTURES as readonly FixtureKind[]) {
    const model = modelOf(kind.key);
    assert.ok(model, kind.key + ' has a model');
    for (const type of kind.types) for (const tap of kind.tap ? TAPS.map(t => t.id) : ['deck' as const]) {
      const f: StudioFixture = { id: 'f1', wall: 'w1', kind: kind.key, type: type.id, offset: 100, ...type.size, ...(tap === 'wall' ? { tap } : {}) };
      const box = new THREE.Box3(), parts = model!(f, m);
      assert.ok(parts.length > 0);
      for (const part of parts) {
        const g = part.geometry.clone();
        if (part.at) g.translate(...part.at);
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count; i++) assert.ok([pos.getX(i), pos.getY(i), pos.getZ(i)].every(Number.isFinite), `${kind.key}/${type.id} finite`);
        g.computeBoundingBox();
        box.union(g.boundingBox!);
      }
      const where = `${kind.key}/${type.id}/${tap}`, { top } = type.extent(f);
      assert.ok(box.min.x >= -f.width / 2 - .5 && box.max.x <= f.width / 2 + .5, `${where} width ${box.min.x}…${box.max.x}`);
      assert.ok(box.min.z >= -.5 && box.max.z <= f.depth + .5, `${where} depth ${box.min.z}…${box.max.z}`);
      assert.ok(box.min.y >= -.01 && box.max.y <= top + 45, `${where} height ${box.min.y}…${box.max.y}`);
    }
  }
});

test('every kind has a catalogue card, and every setup, type and tap a drawing that names itself', () => {
  for (const kind of FIXTURES as readonly FixtureKind[]) {
    assert.match(fixtureCardArt(kind.key), /<svg[^>]*>.*<path/s, kind.key);
    for (const s of kind.setups ?? []) assert.match(setupArt(s.type, s.boxing, s.name), new RegExp(`aria-label="${s.name}"`));
    if (kind.key === 'basin') for (const t of kind.types) for (const tap of TAPS) assert.match(basinArt(t.id, tap.id, t.name), /<svg/);
  }
});
