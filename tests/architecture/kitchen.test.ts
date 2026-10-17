import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FITTINGS, KITCHEN_MENU_KINDS, MENU_KINDS, fittingProduct, hasTrait, type FittingDef } from '../../src/domain/wardrobe/fittings';
import { KITCHEN_UNITS, KITCHEN_UNIT_KEYS, kitchenUnit, type KitchenUnitKey } from '../../src/domain/kitchen/kitchen-units';
import { KITCHEN_PRESETS, createKitchenDesign, duplicateKitchenDesign, kitchenInside, plainStorageFor } from '../../src/domain/kitchen/kitchen-design';
import { FURNITURE, furnitureKind, furnitureModule } from '../../src/domain/furniture/furniture';
import { createEditorState } from '../../src/application/projects/editor-state';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { parseProject, serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import type { EditorScene } from '../../src/application/projects/editor-scene';

/**
 * Kitchen cabinets are a furniture module. These tests walk every kitchen unit, preset and fitting
 * through the places that must know about it, and check that wardrobes are unchanged by it.
 */
const defs = FITTINGS as readonly FittingDef[];
const kitchenDefs = defs.filter(f => f.kitchen);

test('furniture · every module is listed once and old designs are wardrobes', () => {
  assert.deepEqual(FURNITURE.map(m => m.key), ['wardrobe', 'kitchen']);
  const old = createEditorState();
  assert.equal(furnitureKind(old), 'wardrobe', 'a design without a product is a wardrobe');
  assert.equal(furnitureModule(old).key, 'wardrobe');
  assert.deepEqual(furnitureModule(old).sizes(old), { w: [80, 400], h: [180, 280], d: [15, 80] }, 'wardrobe limits are the ones the editor always used');
  assert.deepEqual([...furnitureModule(old).fittingKinds(old)], [...MENU_KINDS]);
});

test('kitchen fittings · each names units that exist and fits inside at least one of them', () => {
  assert.ok(kitchenDefs.length >= 8);
  for (const f of kitchenDefs) {
    assert.equal(fittingProduct(f.key), 'kitchen');
    assert.ok(f.kitchen!.units.length, `${f.key}: names its units`);
    for (const unit of f.kitchen!.units) assert.ok(KITCHEN_UNIT_KEYS.includes(unit), `${f.key}: unknown unit ${unit}`);
    const room = f.kitchen!.units.map(u => kitchenUnit(u)).some(u => f.min <= kitchenInside(u.sizes.h[1]) && f.minWidth <= u.sizes.w[1] && f.minDepth <= u.sizes.d[1]);
    assert.ok(room, `${f.key}: fits inside one of its units`);
    assert.ok(KITCHEN_MENU_KINDS.includes(f.key as never), `${f.key}: offered in the kitchen Add item menu`);
    assert.ok(!MENU_KINDS.includes(f.key as never), `${f.key}: not offered in a wardrobe`);
  }
  for (const k of MENU_KINDS) assert.equal(fittingProduct(k), 'wardrobe', `${k}: wardrobe kinds stay wardrobe kinds`);
});

test('kitchen units · defaults are inside their limits and their plain storage fills them', () => {
  for (const u of KITCHEN_UNITS) {
    for (const axis of ['w', 'h', 'd'] as const) {
      const [lo, hi] = u.sizes[axis];
      assert.ok(lo <= u[axis] && u[axis] <= hi, `${u.key}: default ${axis} within limits`);
    }
    const design = createKitchenDesign(u.key);
    assert.equal(design.product, 'kitchen');
    assert.equal(design.unit, u.key);
    assert.deepEqual(furnitureModule(design).sizes(design), u.sizes);
    const total = design.secs[0]!.reduce((s, it) => s + it.h, 0);
    assert.ok(Math.abs(total - kitchenInside(u.h)) < .01, `${u.key}: storage fills the inside (${total})`);
  }
});

test('kitchen presets · contents fit their unit, within each fitting limit, and are allowed there', () => {
  for (const p of KITCHEN_PRESETS) {
    const design = createKitchenDesign(p.unit, p.key), module = furnitureModule(design);
    const total = design.secs[0]!.reduce((s, it) => s + it.h, 0);
    if (!p.parts.length) assert.equal(total, 0, `${p.key}: a plain unit starts empty, ready for Add item`);
    else assert.ok(Math.abs(total - kitchenInside(design.h)) < .05, `${p.key}: fills the inside (${total} of ${kitchenInside(design.h)})`);
    for (const it of design.secs[0]!) {
      const def = defs.find(f => f.key === it.k)!;
      assert.ok(def.min <= it.h && it.h <= def.max, `${p.key}/${it.k}: height ${it.h} within ${def.min}-${def.max}`);
      assert.ok(module.allows(it.k, design), `${p.key}/${it.k}: allowed in a ${p.unit} unit`);
      assert.ok(design.w >= def.minWidth && design.d >= def.minDepth, `${p.key}/${it.k}: fits the default size`);
    }
  }
});

test('kitchen module · each unit offers only the fittings that fit it', () => {
  for (const unit of KITCHEN_UNIT_KEYS) {
    const design = createKitchenDesign(unit), offered = furnitureModule(design).fittingKinds(design);
    assert.ok(offered.length >= 3, `${unit}: offers a choice`);
    for (const k of offered) assert.ok((defs.find(f => f.key === k)!.kitchen!.units as readonly string[]).includes(unit));
  }
  const upper = createKitchenDesign('upper');
  assert.equal(furnitureModule(upper).allows('sink', upper), false, 'no sink in a wall cabinet');
  assert.equal(furnitureModule(upper).allows('drawer', upper), false, 'no wardrobe drawer in a kitchen');
});

test('duplicating a unit keeps its size and look and replaces appliances with plain storage at the same height', () => {
  for (const p of KITCHEN_PRESETS) {
    const design = { ...createKitchenDesign(p.unit, p.key), w: 80, fin: 'Graphite' as const };
    const copy = furnitureModule(design).duplicate(design);
    assert.equal(copy.w, 80); assert.equal(copy.fin, 'Graphite'); assert.equal(copy.unit, p.unit);
    assert.ok(copy.secs[0]!.every(it => !hasTrait(it.k, 'appliance')), `${p.key}: no appliance is copied`);
    const before = design.secs[0]!.reduce((s, it) => s + it.h, 0), after = copy.secs[0]!.reduce((s, it) => s + it.h, 0);
    assert.ok(Math.abs(before - after) < .05, `${p.key}: same filled height (${before} → ${after})`);
    assert.ok(copy.secs[0]!.every(it => furnitureModule(copy).allows(it.k, copy)), `${p.key}: replacements are allowed in the unit`);
    if (!design.secs[0]!.some(it => hasTrait(it.k, 'appliance'))) assert.deepEqual(copy.secs, design.secs, `${p.key}: plain storage is copied as it is`);
  }
  assert.deepEqual(plainStorageFor({ k: 'oven', h: 60 }, 'base').map(it => [it.k, it.h]), [['pan', 30], ['pan', 30]]);
  assert.deepEqual(plainStorageFor({ k: 'hob', h: 14 }, 'base').map(it => it.k), ['cutlery']);
  assert.deepEqual(plainStorageFor({ k: 'sink', h: 72 }, 'base').map(it => it.k), ['cupboard']);
  // A pinned appliance's replacement stays where it was.
  const pinned = { ...createKitchenDesign('base', 'cooking') };
  pinned.secs[0] = [{ k: 'oven', h: 60, y: 10 }];
  assert.deepEqual(duplicateKitchenDesign(pinned).secs[0]!.map(it => [it.k, it.y]), [['pan', 10], ['pan', 40]]);
});

test('a kitchen unit saves and reopens as the same unit; a wardrobe saves without a product', () => {
  const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 3, wardrobes: [
    { id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() },
    { id: 2, name: 'Wall cabinet 2', x: 200, y: 142, z: 0, angle: 0, state: { ...createKitchenDesign('upper' as KitchenUnitKey), sel: 0, item: -1, divider: -1, space: null, open: false } },
  ] };
  const document = sceneToProject(createProject('p', 'Kitchen'), scene);
  assert.equal('product' in document.wardrobes[0]!, false, 'wardrobes save as before');
  assert.equal(document.wardrobes[1]!.product, 'kitchen');
  assert.equal(document.wardrobes[1]!.unit, 'upper');
  const reopened = projectToScene(deserializeProject(serializeProject(document)))!;
  assert.equal(reopened.wardrobes[1]!.state.product, 'kitchen');
  assert.equal(reopened.wardrobes[1]!.state.unit, 'upper');
  assert.equal(reopened.wardrobes[1]!.y, 142);
  assert.equal(reopened.wardrobes[0]!.state.product, undefined);
  const broken = structuredClone(document) as unknown as { wardrobes: { unit?: string; product?: string }[] };
  delete broken.wardrobes[1]!.product;
  assert.throws(() => parseProject(broken), /names its unit/);
});
