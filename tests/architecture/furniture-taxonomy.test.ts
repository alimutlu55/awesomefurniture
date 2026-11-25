import test from 'node:test';
import assert from 'node:assert/strict';
import { FURNITURE_CATEGORIES, ROOMS, categoryPath, furnitureCategory, leafCategories } from '../../src/domain/furniture/furniture-taxonomy';
import { FURNITURE } from '../../src/domain/furniture/furniture';
import { PIECE_PRESETS } from '../../src/domain/furniture/piece-presets';

/** Every kind of thing Add furniture offers, with the category it is filed under. */
const items = [...FURNITURE.map(m => ({ what: 'module ' + m.key, category: m.category as string })),
  ...PIECE_PRESETS.map(p => ({ what: 'preset ' + p.id, category: p.category as string }))];

test('the taxonomy is one tree: unique ids and names, every parent exists, one root', () => {
  const ids = FURNITURE_CATEGORIES.map(c => c.id), labels = FURNITURE_CATEGORIES.map(c => c.label);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.equal(new Set(labels).size, labels.length, 'unique names');
  assert.deepEqual(FURNITURE_CATEGORIES.filter(c => c.parent === null).map(c => c.id), ['furniture']);
  for (const c of FURNITURE_CATEGORIES) if (c.parent) assert.ok(furnitureCategory(c.parent), `${c.id}: parent ${c.parent}`);
  for (const c of FURNITURE_CATEGORIES) assert.ok(categoryPath(c.id).length < 5, `${c.id}: at most five levels`);
  const roomKeys = ROOMS.map(r => r.key) as string[];
  for (const c of FURNITURE_CATEGORIES) for (const r of c.rooms) assert.ok(roomKeys.includes(r), `${c.id}: room ${r}`);
});

test('every item is filed under a category with no children, and every such category has items', () => {
  const leaves = leafCategories().map(c => c.id);
  for (const item of items) assert.ok(leaves.includes(item.category), `${item.what} → ${item.category}`);
  for (const leaf of leafCategories()) {
    assert.ok(items.some(i => i.category === leaf.id), `${leaf.id} has nothing in it`);
    assert.ok(leaf.rooms.length > 0, `${leaf.id} belongs in a room`);
  }
});

test('a category knows where it sits', () => {
  assert.deepEqual(categoryPath('sideboards'), ['Furniture', 'Cabinets and storage']);
  assert.deepEqual(categoryPath('furniture'), []);
});
