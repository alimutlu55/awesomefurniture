import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FITTINGS, FITTING_KINDS, MENU_KINDS, plannerLimits, type FittingDef } from '../../src/domain/wardrobe/fittings';
import { GENERAL_PURPOSES, PURPOSES, ALL_PURPOSES } from '../../src/domain/wardrobe/purposes';
import { ZONE_PRIORITY } from '../../src/domain/wardrobe/zone-style';
import { MODS, PURPOSE, ADD_ORDER, compatiblePurposes, itemName } from '../../src/domain/wardrobe/catalog.js';
import { zoneColor, zoneText, ICONP } from '../../src/presentation/editor/editor-format.js';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createAddSuggestions } from '../../src/presentation/editor/add-suggestions.js';

/**
 * Adding a fitting kind or a general purpose means adding one entry to fittings.ts or purposes.ts.
 * These tests walk EVERY entry through EVERY place that must know about it. A failure names the
 * entry and the step that is missing.
 */

const defs = FITTINGS as readonly FittingDef[];
const priorities = new Set<number>(Object.values(ZONE_PRIORITY));

test('fittings · keys, codes and sizes are valid', () => {
  assert.equal(new Set(FITTING_KINDS).size, FITTING_KINDS.length, 'kinds are unique');
  assert.equal(new Set(defs.map(f => f.code)).size, defs.length, 'one-letter codes are unique');
  for (const f of defs) {
    assert.match(f.key, /^[a-z]+$/, `${f.key}: one lowercase word, it is saved in projects`);
    assert.match(f.code, /^[A-Z0-9]$/, `${f.key}: code is one capital letter or digit`);
    assert.ok(f.min <= f.height && f.height <= f.max, `${f.key}: default height is between min and max`);
    assert.ok(f.price >= 0 && f.minWidth >= 0 && f.minDepth >= 0, `${f.key}: price and sizes are not negative`);
  }
});

test('fittings · every kind that shows its own front says how it opens, for the drawings', () => {
  for (const f of defs) {
    const front = (f.traits as readonly string[]).includes('front');
    assert.equal(f.opens !== undefined, front, `${f.key}: ${front ? 'give it opens: how its front opens' : 'opens is only for kinds with the front trait'}`);
  }
});

test('fittings · purposes they offer exist, and every purpose is offered somewhere', () => {
  for (const f of defs) {
    assert.ok(f.purposes.includes(f.purpose), `${f.key}: its starting purpose is one it offers`);
    for (const p of f.purposes) assert.ok(ALL_PURPOSES.includes(p), `${f.key}: offers unknown purpose ${p}`);
    assert.deepEqual(compatiblePurposes(f.key).slice(0, f.purposes.length), [...f.purposes], `${f.key}: the inspector offers its purposes`);
  }
  const offered = new Set(FITTING_KINDS.flatMap(k => compatiblePurposes(k)));
  for (const p of ALL_PURPOSES) assert.ok(offered.has(p), `purpose ${p}: no fitting kind offers it, so nobody can choose it`);
});

test('fittings · the catalogue and the planner limits come from the registry', () => {
  for (const f of defs) {
    const m = (MODS as Record<string, { n: string; h: number; mn: number; mx: number; w: number; d: number; p: number; k: string; purpose: string }>)[f.key]!;
    assert.deepEqual([m.n, m.h, m.mn, m.mx, m.w, m.d, m.p, m.k, m.purpose], [f.name, f.height, f.min, f.max, f.minWidth, f.minDepth, f.price, f.code, f.purpose], `${f.key}: catalogue entry`);
    const l = plannerLimits()[f.key]!, p = f.planner ?? {};
    assert.deepEqual(l, [p.min ?? f.min, p.max ?? f.max, p.minWidth ?? f.minWidth, p.minDepth ?? f.minDepth, p.height ?? f.height, f.price], `${f.key}: planner limits`);
    assert.ok(itemName({ k: f.key }).length > 0, `${f.key}: has a name`);
  }
});

test('fittings · Add item menu: order is unique and every menu kind is suggested', () => {
  const orders = defs.filter(f => f.menu).map(f => f.menu!.order);
  assert.equal(new Set(orders).size, orders.length, 'menu orders are unique');
  assert.deepEqual([...ADD_ORDER], [...MENU_KINDS]);
  const state = createEditorState();
  Object.assign(state, { n: 1, wt: [100, 100, 100, 100, 100, 100], sel: 0 });
  const listed = new Set(createAddSuggestions(() => state, createWardrobeGeometry(() => state)).addSuggestions().list.map((x: { k: string }) => x.k));
  for (const k of MENU_KINDS) assert.ok(listed.has(k), `${k}: missing from Add item`);
});

test('fittings · every kind and every purpose it offers has a zone colour, label and icon', () => {
  for (const f of defs) {
    assert.ok(priorities.has(f.zone.priority), `${f.key}: zone priority must be one of ZONE_PRIORITY`);
    assert.match(f.zone.color ?? '', /^#[0-9a-f]{6}$/, `${f.key}: zone colour`);
    assert.equal((ICONP as Record<string, string>)[f.key], f.icon, `${f.key}: icon is registered`);
    for (const purpose of compatiblePurposes(f.key)) {
      const it = { k: f.key, purpose, h: 20 };
      assert.match(zoneColor(it), /^#[0-9a-f]{6}$/, `${f.key}/${purpose}: zone colour`);
      assert.ok(zoneText(it).length > 0, `${f.key}/${purpose}: zone label`);
    }
  }
});

test('purposes · keys are unique words with labels, and zone priorities are named levels', () => {
  assert.equal(new Set(ALL_PURPOSES).size, ALL_PURPOSES.length, 'purposes are unique');
  for (const p of PURPOSES) {
    assert.match(p.key, /^[a-z]+$/, `${p.key}: one lowercase word, it is saved in projects`);
    assert.equal((PURPOSE as Record<string, string>)[p.key], p.label, `${p.key}: label`);
    if (p.zone) assert.ok(priorities.has(p.zone.priority), `${p.key}: zone priority must be one of ZONE_PRIORITY`);
  }
  assert.ok(GENERAL_PURPOSES.length > 0);
});

test('saved projects · every fitting kind with every purpose it offers survives saving', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const state = createEditorState();
  Object.assign(state, { n: 1, wt: [100, 100, 100, 100, 100, 100], sel: 0, dividers: [] });
  const items = defs.flatMap(f => compatiblePurposes(f.key).map(purpose => ({ k: f.key, purpose, h: f.height })));
  state.secs[0] = items as never;
  const scene = { wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
  const back = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('p', 'P'), scene as never))))!;
  const saved = back.wardrobes[0]!.state.secs[0]!.map(it => [it.k, it.purpose]);
  assert.deepEqual(saved, items.map(it => [it.k, it.purpose]));
});
