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
  assert.deepEqual(furnitureModule(old).sizes(old), { w: [80, 600], h: [180, 300], d: [15, 90] }, 'wardrobe limits');
  assert.deepEqual([...furnitureModule(old).fittingKinds(old)], [...MENU_KINDS]);
});

test('kitchen fittings · each names units that exist and fits inside at least one of them', () => {
  assert.ok(kitchenDefs.length >= 8);
  for (const f of kitchenDefs) {
    assert.equal(fittingProduct(f.key), 'kitchen');
    assert.ok(f.kitchen!.units.length, `${f.key}: names its units`);
    for (const unit of f.kitchen!.units) assert.ok(KITCHEN_UNIT_KEYS.includes(unit), `${f.key}: unknown unit ${unit}`);
    const room = f.kitchen!.units.map(u => kitchenUnit(u)).some(u => f.min <= kitchenInside(u.sizes.h[1], u.key as KitchenUnitKey) && f.minWidth <= u.sizes.w[1] && f.minDepth <= u.sizes.d[1]);
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
    if (kitchenUnit(u.key).fixture) { assert.deepEqual(design.secs[0], [], `${u.key}: a sink or hob holds nothing`); continue; }
    const total = design.secs[0]!.reduce((s, it) => s + it.h, 0);
    assert.ok(Math.abs(total - kitchenInside(u.h, u.key)) < .01, `${u.key}: storage fills the inside (${total})`);
  }
});

test('kitchen presets · contents fit their unit, within each fitting limit, and are allowed there', () => {
  for (const p of KITCHEN_PRESETS) {
    const design = createKitchenDesign(p.unit, p.key), module = furnitureModule(design);
    const total = design.secs[0]!.reduce((s, it) => s + it.h, 0);
    if (!p.parts.length) assert.equal(total, 0, `${p.key}: a plain unit starts empty, ready for Add item`);
    else assert.ok(Math.abs(total - kitchenInside(design.h, p.unit)) < .05, `${p.key}: fills the inside (${total} of ${kitchenInside(design.h, p.unit)})`);
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
    if (kitchenUnit(unit).fixture) continue; // a sink or hob has no inside to fit things in
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

test('kitchen Add item · every kitchen fitting is offered inside a unit it fits, and nothing else is', async () => {
  const { kitchenSuggestions } = await import('../../src/presentation/editor/kitchen-suggestions');
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const offered = new Set<string>();
  for (const unit of KITCHEN_UNIT_KEYS) {
    // The plain unit of each kind starts empty (its preset has the unit's key).
    const design = { ...createKitchenDesign(unit, unit), sel: 0, item: -1, divider: -1, space: null, open: false };
    assert.equal(design.secs[0]!.length, 0);
    const { list, intent } = kitchenSuggestions(design, createWardrobeGeometry(() => design));
    assert.match(intent, /Inside the/);
    for (const card of list) {
      if (card.k === 'divider') continue;
      assert.equal(fittingProduct(card.k), 'kitchen', `${unit}: ${card.k} is a kitchen fitting`);
      if (card.fit) offered.add(card.k);
    }
  }
  for (const f of kitchenDefs) assert.ok(offered.has(f.key), `${f.key}: fits an empty unit of one of its kinds`);
});

test('wall units · a lift-up cabinet and a microwave unit, at their own size, with a microwave offered in wall and tall units', () => {
  const lift = createKitchenDesign('upper', 'lift'), micro = createKitchenDesign('upper', 'microwave');
  assert.deepEqual([lift.w, lift.h, lift.unit], [80, 40, 'upper']);
  assert.deepEqual(lift.secs[0]!.map(it => it.k), ['flap']);
  assert.deepEqual([micro.w, micro.h], [60, 48]);
  assert.deepEqual(micro.secs[0]!.map(it => it.k), ['microwave']);
  for (const unit of ['upper', 'tall'] as const) {
    const design = createKitchenDesign(unit);
    assert.ok(furnitureModule(design).allows('microwave', design), `a microwave goes in a ${unit} unit`);
  }
  const base = createKitchenDesign('base');
  assert.equal(furnitureModule(base).allows('microwave', base), false, 'not in a base unit under the worktop');
});

test('cargo pull-outs · a slim base unit and a tall one, with the cargo allowed in base and tall units only', () => {
  const base = createKitchenDesign('base', 'cargo'), tall = createKitchenDesign('tall', 'cargo-tall');
  assert.equal(base.w, 30); assert.deepEqual(base.secs[0]!.map(it => it.k), ['cargo']);
  assert.equal(tall.w, 40); assert.deepEqual(tall.secs[0]!.map(it => it.k), ['cargo', 'cupboard']);
  const upper = createKitchenDesign('upper');
  assert.equal(furnitureModule(upper).allows('cargo', upper), false, 'not in a wall cabinet');
});

test('built-in appliances · each has a unit prepared for it', async () => {
  for (const [preset, kind] of [['dishwasher', 'dishwasher'], ['fridge-under', 'fridge'], ['hood', 'hood'], ['microwave', 'microwave'], ['oven-under', 'oven']] as const) {
    const p = KITCHEN_PRESETS.find(x => x.key === preset)!, design = createKitchenDesign(p.unit, p.key);
    assert.ok(design.secs[0]!.some(it => it.k === kind), `${preset} holds a ${kind}`);
  }
  assert.equal(createKitchenDesign('tall', 'fridge-tall').h, 190);
  assert.deepEqual(createKitchenDesign('tall', 'fridge-tall').secs[0]!.map(it => it.k), ['fridge'], 'a tall fridge-freezer has no cupboard above it');
});

test('a wall unit has no plinth: its bottom board is its lower edge, a floor unit keeps the 8 cm plinth', async () => {
  const { createWardrobeGeometry } = await import('../../src/domain/geometry/wardrobe-geometry.js');
  const { plinthOf } = await import('../../src/domain/wardrobe/carcass');
  const floor = (unit: KitchenUnitKey, preset?: string) => { const d = { ...createKitchenDesign(unit, preset), sel: 0, item: -1, divider: -1, space: null, open: false }; return { d, g: createWardrobeGeometry(() => d) }; };
  const wall = floor('upper', 'lift'), base = floor('base', 'cargo');
  assert.equal(plinthOf(wall.d), 0); assert.equal(plinthOf(base.d), 8);
  assert.equal(wall.g.interiorFloor(), 1.8); assert.equal(base.g.interiorFloor(), 9.8);
  assert.equal(wall.g.computeLayout(0)[0]!.y0, 1.8, 'the first fitting stands on the bottom board of the wall unit');
  assert.equal(wall.g.itemMeasurements(0, 0)!.gapBelow, 0, 'and nothing is left under it');
  assert.ok(Math.abs(wall.d.secs[0]!.reduce((s, it) => s + it.h, 0) - (wall.d.h - 3.6)) < .05, 'the fittings fill the whole inside, 3.6 cm of boards less than the height');
});

test('a sink and a hob are placed on their own on a worktop, sized by themselves, never part of a cabinet', async () => {
  const { isFixture } = await import('../../src/domain/kitchen/kitchen-units');
  const { kitchenSpans } = await import('../../src/domain/kitchen/kitchen-runs');
  for (const key of ['sink-top', 'hob-top'] as const) {
    const unit = kitchenUnit(key), design = createKitchenDesign(key, key);
    assert.ok(isFixture(design), `${key} is a fixture`);
    assert.equal(unit.elevation, 90, `${key}: its underside is the worktop's top (86 cm unit and 4 cm worktop)`);
    assert.ok(!unit.worktop && !unit.plinth, `${key}: no worktop or plinth of its own`);
    assert.ok(unit.sizes.w[1] > 100 && unit.sizes.w[0] < 50, `${key}: any width a person wants`);
    assert.equal(KITCHEN_PRESETS.filter(p => p.unit === key).length, 1, `${key}: one card`);
  }
  const shelf = kitchenUnit('shelf'), shelfDesign = createKitchenDesign('shelf', 'shelf');
  assert.ok(isFixture(shelfDesign), 'a wall shelf is a fixture: a board with no inside');
  assert.ok(shelf.elevation > 0 && shelf.sizes.w[1] === 400 && shelf.sizes.d[0] <= 15, 'hangs on the wall, wide and shallow when wanted');
  assert.equal(KITCHEN_PRESETS.filter(p => p.unit === 'shelf').length, 1, 'one card');
  assert.ok(!isFixture(createKitchenDesign('base')));
  const base = { id: 1, name: 'B', x: 0, y: 0, z: 0, angle: 0, state: { ...createKitchenDesign('base'), sel: 0, item: -1, divider: -1, space: null, open: false } };
  const sink = { id: 2, name: 'S', x: 0, y: 90, z: 0, angle: 0, state: { ...createKitchenDesign('sink-top'), sel: 0, item: -1, divider: -1, space: null, open: false } };
  assert.deepEqual(kitchenSpans([base, sink] as never).filter(s => s.kind === 'worktop').map(s => s.units), [[1]], 'the worktop belongs to the cabinet, not the sink');
  assert.equal(KITCHEN_PRESETS.filter(p => (p.parts as readonly (readonly [string, number])[]).some(([k]) => k === 'sink' || k === 'hob')).length, 0, 'no cabinet comes with a sink or hob');
});

test('door and handle side · wardrobe doorHang and kitchen item hinge control 2D drawings, 3D pivots and persistence', async () => {
  const { createDesignCommands } = await import('../../src/application/commands/design-commands');
  const { piecefronts } = await import('../../src/domain/drawings/fronts');
  const { renderCabinetDoors } = await import('../../src/presentation/viewport/door-renderer');
  const THREE = await import('three');
  const wardrobe = createEditorState();
  wardrobe.w = 100; wardrobe.n = 1; wardrobe.doors = 'hinged';
  const wCmd = createDesignCommands(() => wardrobe);
  assert.equal(piecefronts(wardrobe).fronts[0]!.hinge, 'left', 'single wardrobe door defaults to left hinge');
  wCmd.setDoorHang('right');
  assert.equal(wardrobe.doorHang, 'right');
  assert.equal(piecefronts(wardrobe).fronts[0]!.hinge, 'right', 'doorHang flips wardrobe door hinge to the right');
  const group = new THREE.Group(), mat = new THREE.MeshStandardMaterial();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: unknown, parent: { add(o: unknown): void } = group) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m as THREE.Material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const pivots = renderCabinetDoors(wardrobe, [96.4], group, box as never, (() => new THREE.Mesh()) as never, { M: () => mat }, mat, mat);
  assert.equal(pivots.length, 1);
  assert.ok(pivots[0]!.position.x > 0, 'right-hung wardrobe door pivots on its right edge');
  assert.equal(pivots[0]!.userData.t, 1.6, 'and swings open to the right');

  // Kitchen cabinet and item-level hinge override:
  const base = { ...createKitchenDesign('base'), sel: 0, item: 0, divider: -1, space: null, open: false };
  const kCmd = createDesignCommands(() => base);
  assert.equal(piecefronts(base).fronts[0]!.hinge, 'left', 'a 60 cm base door hinges on the left by default');
  kCmd.setDoorHang('right');
  assert.equal(piecefronts(base).fronts[0]!.hinge, 'right', 'cabinet doorHang sets the default hinge side');
  kCmd.editItem(0, 0, { hinge: 'left' });
  assert.equal(base.secs[0]![0]!.hinge, 'left');
  assert.equal(piecefronts(base).fronts[0]!.hinge, 'left', 'item hinge overrides the cabinet default');

  // Persistence round-trip for both wardrobe doorHang and kitchen item hinge:
  const scene: EditorScene = { activeWardrobe: 1, nextWardrobeId: 3, wardrobes: [
    { id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state: wardrobe },
    { id: 2, name: 'Base 2', x: 150, y: 0, z: 0, angle: 0, state: base },
  ] };
  const reopened = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('p', 'Hinges'), scene))))!;
  assert.equal(reopened.wardrobes[0]!.state.doorHang, 'right');
  assert.equal(reopened.wardrobes[1]!.state.doorHang, 'right');
  assert.equal(reopened.wardrobes[1]!.state.secs[0]![0]!.hinge, 'left');
});

test('corner pull-out and filler cover · blind panel + hinged door, kidney mechanism hardware, and 5 cm filler width', async () => {
  const { createKitchenCover, isCoverUnit } = await import('../../src/domain/kitchen/kitchen-design');
  const { piecefronts } = await import('../../src/domain/drawings/fronts');
  const { hardwareList } = await import('../../src/domain/drawings/hardware-list');
  const { placePieces } = await import('../../src/domain/drawings/room-pieces');
  const corner = { ...createKitchenDesign('base', 'corner'), sel: 0, item: 0, divider: -1, space: null, open: false };
  assert.equal(corner.w, 100, 'corner pull-out preset is 100 cm wide');
  assert.equal(corner.secs[0]![0]!.k, 'corner');
  const frontsLeft = piecefronts(corner).fronts;
  assert.equal(frontsLeft.length, 2, 'blind panel and hinged door');
  assert.deepEqual(frontsLeft.map(f => [f.opens, f.hinge]), [['fixed', undefined], ['side', 'right']]);
  corner.secs[0]![0]!.ax = 'r'; corner.secs[0]![0]!.hinge = 'left';
  const frontsRight = piecefronts(corner).fronts;
  assert.deepEqual(frontsRight.map(f => [f.opens, f.hinge]), [['fixed', undefined], ['side', 'left']]);
  assert.ok(frontsRight[0]!.x0 < frontsRight[1]!.x0, 'when hinged on the right, the blind panel sits on the left half');

  const cover = { ...createKitchenCover(corner, 15), sel: 0, item: -1, divider: -1, space: null, open: false };
  assert.equal(isCoverUnit(cover), true);
  assert.equal(cover.w, 15);
  assert.deepEqual(furnitureModule(cover).sizes(cover).w, [5, 150], 'a cover unit can narrow down to 5 cm');
  assert.deepEqual(piecefronts(cover).fronts.map(f => f.opens), ['fixed'], 'a cover has a fixed flush front with no hinges or handle');

  const pieces = placePieces({ pieces: [
    { id: 1, name: 'Corner 1', x: 0, y: 0, z: 0, angle: 0, design: corner },
    { id: 2, name: 'Corner cover 2', x: 100, y: 0, z: 0, angle: 0, design: cover },
  ] });
  const rows = hardwareList(pieces).flatMap(t => t.rows);
  assert.ok(rows.some(r => r[0] === 'Corner pull-out mechanism, two swing trays' && r[2] === '1'), 'lists the corner pull-out mechanism');
  const handles = rows.find(r => r[0] === 'Handle');
  assert.equal(handles?.[2], '1', 'only the corner door leaf takes a handle; the blind panel and cover take none');
});

