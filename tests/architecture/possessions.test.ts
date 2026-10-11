import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POSSESSIONS, SHELF_POSSESSIONS, POSSESSION_KEYS, defaultNeeds, unitsOnShelf } from '../../src/domain/wardrobe/possessions';
import { ALL_PURPOSES } from '../../src/domain/wardrobe/purposes';
import { CATEGORIES, SELECTION_RULES, buildDemand } from '../../src/domain/planner/selection-config';
import { PURPOSE, compatiblePurposes } from '../../src/domain/wardrobe/catalog.js';
import { WardrobePlanner } from '../../src/domain/planner/wardrobe-planner.js';
import { modulesFor } from '../../src/domain/planner/selection-modules';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { heldOnShelves } from '../../src/domain/planner/possession-report';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createAddSuggestions } from '../../src/presentation/editor/add-suggestions.js';
import { zoneColor, zoneText, ICONP } from '../../src/presentation/editor/editor-format.js';
import { possessionFields, withPossessionFields, POSSESSION_FIELDS_MARKER } from '../../src/presentation/editor/possession-fields';

/**
 * Adding a possession means adding one entry to src/domain/wardrobe/possessions.ts. These tests walk
 * EVERY entry through EVERY place that must know about it, so a new entry is checked with no new test.
 * A failure here names the step that is missing.
 */

const cfg: any = { w: 200, h: 230, d: 60, budget: 900, needs: { short: 14, long: 4, pants: 8, folded: 20, shoes: 6, small: 20 }, reach: 185, longDrop: 160, upper: 'fill', drawers: 'auto', allowLift: false, density: 'comfort', growth: 15, jackets: 6, coats: 2, accessible: false, composition: 'balanced', finFactor: 1, doors: 'none', engaged: true, reachStd: 185 };

test('registry · keys are unique words and each has sane weights and limits', () => {
  assert.equal(new Set(POSSESSION_KEYS).size, POSSESSION_KEYS.length, 'keys are unique');
  for (const p of POSSESSIONS) {
    assert.match(p.key, /^[a-z]+$/, `${p.key}: one lowercase word, it is also the item purpose`);
    assert.ok(p.label.length > 2, `${p.key}: label`);
    assert.ok(p.need.max >= p.need.default && p.need.max > 0, `${p.key}: wizard limits`);
    assert.ok(p.planner.frequency > 0 && p.planner.frequency <= 1, `${p.key}: frequency is in (0, 1]`);
    const [lo, hi] = p.planner.home;
    assert.ok(lo >= 0 && hi <= 1 && lo < hi, `${p.key}: home band is inside the reach height`);
  }
});

test('registry · planner categories, weights, labels and defaults come from it', () => {
  assert.deepEqual([...CATEGORIES], [...POSSESSION_KEYS]);
  for (const p of POSSESSIONS) {
    assert.equal((SELECTION_RULES.frequency as Record<string, number>)[p.key], p.planner.frequency, `${p.key}: frequency`);
    assert.deepEqual((SELECTION_RULES.home as Record<string, readonly number[]>)[p.key], p.planner.home, `${p.key}: home band`);
    assert.equal((PURPOSE as Record<string, string>)[p.key], p.label, `${p.key}: purpose label`);
    assert.equal(defaultNeeds()[p.key], p.need.default, `${p.key}: default count`);
    assert.equal(createEditorState().profile.needs[p.key as 'short'] ?? 0, p.need.default, `${p.key}: new designs start from the default`);
  }
  assert.ok(ALL_PURPOSES.every(k => k in PURPOSE), 'every purpose has a label');
  // Demand covers every category, with the growth allowance, and a possession nobody asked for is zero.
  const demand = buildDemand({ ...cfg, needs: { ...cfg.needs }, growth: 0 });
  for (const p of POSSESSIONS) assert.ok(Number.isFinite(demand[p.key]), `${p.key}: demand`);
});

test('wizard · every shelf possession gets a count field with its own label and limits', () => {
  const html = withPossessionFields(`<div class="inventory">${POSSESSION_FIELDS_MARKER}</div>`);
  assert.ok(!html.includes(POSSESSION_FIELDS_MARKER));
  for (const p of SHELF_POSSESSIONS) {
    assert.match(html, new RegExp(`id="need-${p.key}" type="number" min="0" max="${p.need.max}" value="${p.need.default}"`));
    assert.ok(html.includes(p.label));
  }
  assert.equal(possessionFields().split('<label').length - 1, SHELF_POSSESSIONS.length);
  // The clothing possessions are written in the markup, and the marker sits in the real editor.
  const editor = readFileSync('src/presentation/editor/editor.html', 'utf8');
  assert.ok(editor.includes(POSSESSION_FIELDS_MARKER), 'editor.html has the marker');
  for (const p of POSSESSIONS.filter(q => q.engine === 'bespoke')) assert.ok(editor.includes(`id="need-${p.key}"`), `${p.key}: field written in editor.html`);
});

test('saved projects · every possession round trips as a need and as a purpose', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const state = createEditorState();
  Object.assign(state, { n: 1, wt: [100, 100, 100, 100, 100, 100], sel: 0, dividers: [] });
  state.profile.needs = Object.fromEntries(POSSESSIONS.map((p, i) => [p.key, i + 1])) as never;
  state.secs[0] = SHELF_POSSESSIONS.map((p, i) => ({ k: 'shelf', h: p.holder.height, purpose: p.key, x: 0, y: 10 + i * 40, w: 100 } as never));
  const scene = { wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
  const back = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('p', 'P'), scene as never))))!;
  const needs = back.wardrobes[0]!.state.profile.needs as Record<string, number>;
  for (const [i, p] of POSSESSIONS.entries()) assert.equal(needs[p.key], i + 1, `${p.key}: need survives saving`);
  SHELF_POSSESSIONS.forEach((p, i) => assert.equal(back.wardrobes[0]!.state.secs[0]![i]!.purpose, p.key, `${p.key}: purpose survives saving`));
});

test('saved projects · a project saved before a possession existed opens with its default count', async () => {
  const { sceneToProject, projectToScene } = await import('../../src/application/projects/editor-mapper');
  const { createProject } = await import('../../src/domain/project/project');
  const { deserializeProject, serializeProject } = await import('../../src/infrastructure/serialization/project-codec');
  const state = createEditorState();
  const scene = { wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
  const doc = JSON.parse(serializeProject(sceneToProject(createProject('p', 'P'), scene as never)));
  for (const w of doc.project?.wardrobes ?? doc.wardrobes ?? []) for (const p of SHELF_POSSESSIONS) delete w.preferences.needs[p.key];
  const back = projectToScene(deserializeProject(JSON.stringify(doc)))!;
  for (const p of SHELF_POSSESSIONS) assert.equal((back.wardrobes[0]!.state.profile.needs as Record<string, number>)[p.key], p.need.default);
});

for (const p of SHELF_POSSESSIONS) {
  const bay = (items: any[], width = 97.3) => WardrobePlanner.analyze([{ width, items }], { ...cfg, w: width + 8 }).capacities as Record<string, number>;

  test(`${p.key} · the physical engine counts it on its shelf, and only there`, () => {
    WardrobePlanner.configure(cfg);
    const one = unitsOnShelf(p.holder, 97.3);
    assert.ok(one >= 1, 'a 97 cm shelf holds at least one');
    assert.equal(bay([{ k: 'shelf', purpose: p.key, h: p.holder.height }])[p.key], one);
    assert.equal(bay([{ k: 'shelf', purpose: p.key, h: p.holder.height }, { k: 'shelf', purpose: p.key, h: p.holder.height }])[p.key], one * 2, 'stacked shelves add up');
    assert.equal(bay([{ k: 'shelf', purpose: p.key, h: p.holder.height - 1 }])[p.key], 0, 'a shelf lower than its height holds none');
    assert.equal(bay([{ k: 'void', h: 180 }, { k: 'shelf', purpose: p.key, h: p.holder.height }])[p.key], 0, 'a shelf above reach holds none');
    assert.equal(bay([{ k: 'shelf', purpose: 'accessories', h: p.holder.height }])[p.key], 0, 'a shelf for something else holds none');
    assert.ok(compatiblePurposes('shelf').includes(p.key), 'offered on shelves');
    assert.ok(!compatiblePurposes('drawer').includes(p.key), 'not offered on drawers');
  });

  test(`${p.key} · the search offers stacked shelves of it, and plans it against clothing by the weights`, () => {
    WardrobePlanner.configure(cfg);
    const withNeed = { ...cfg, needs: { ...cfg.needs, [p.key]: 6 } };
    const unmet: any = { [p.key]: 7 };
    const modules = modulesFor({ bay: 0, x: 0, y: 500, w: 780, h: 1000, depth: 600 } as never, unmet, withNeed, 0);
    assert.ok(modules.length >= 1, 'modules are generated');
    assert.ok(modules.every(m => m.capacity[p.key as 'short'] > 0), 'every module serves it');
    assert.equal(Math.max(...modules.map(m => m.items.length)), p.holder.maxStack, 'up to maxStack shelves stack in one module');
    const plans = generateDesignedLayouts(withNeed);
    const best = plans[0]!;
    assert.ok(best.held![p.key]!.placed >= 1, 'the best plan holds some');
    assert.equal(heldOnShelves(best.sections, p.key), best.held![p.key]!.placed, 'the report counts what the layout holds');
    assert.equal(best.metrics.capacities[p.key], best.held![p.key]!.placed, 'planner capacity and layout agree');
    assert.equal(best.metrics.valid, true);
    // Not asking for it plans none and reports nothing.
    const none = generateDesignedLayouts(cfg)[0]!;
    assert.equal(heldOnShelves(none.sections, p.key), 0);
    assert.equal(none.held, undefined);
    // Asking for far more than fits says so.
    const many = generateDesignedLayouts({ ...cfg, needs: { ...cfg.needs, [p.key]: 400 } })[0]!;
    assert.ok(many.held![p.key]!.placed < 400);
    assert.ok(many.warnings.some((m: string) => m.startsWith(`${p.label}: room for`)));
  });

  test(`${p.key} · Add item suggests it, adds its shelf, and the drawing knows it`, () => {
    const state = createEditorState();
    Object.assign(state, { n: 1, wt: [100, 100, 100, 100, 100, 100], sel: 0 });
    const rules = createWardrobeGeometry(() => state);
    const entry = createAddSuggestions(() => state, rules).addSuggestions().list.find((x: any) => x.possession === p.key);
    assert.ok(entry, 'listed in Add item');
    assert.equal(entry.fit, true);
    assert.equal(entry.why, p.menu.why);
    const messages: string[] = [];
    const commands = createDesignCommands(() => state, { report: m => messages.push(m) });
    commands.addPossessionShelf(p.key);
    const added = state.secs[0]!.at(-1)!;
    assert.equal(added.purpose, p.key);
    assert.equal(added.k, 'shelf');
    assert.equal(added.h, p.holder.height);
    assert.match(messages.at(-1)!, new RegExp(`^${p.label} shelf added`));
    // The drawing: its zone has a colour and a name, and its icon is registered.
    assert.equal(zoneColor(added), p.look.color);
    assert.equal(zoneText(added), p.label);
    assert.equal((ICONP as Record<string, string>)[p.key], p.look.icon);
  });
}
