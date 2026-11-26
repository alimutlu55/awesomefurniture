import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FITTINGS, type FittingDef } from '../../src/domain/wardrobe/fittings';
import { createKitchenDesign, kitchenInside, KITCHEN_PRESETS } from '../../src/domain/kitchen/kitchen-design';
import { kitchenUnit, type KitchenUnitKey } from '../../src/domain/kitchen/kitchen-units';
import { kitchenFitHeight, smallestFront, takesWholeFront } from '../../src/domain/kitchen/kitchen-fit';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createAddSuggestions } from '../../src/presentation/editor/add-suggestions.js';
import { PANEL } from '../../src/domain/wardrobe/catalog.js';
import type { EditorCabinet, EditorScene } from '../../src/application/projects/editor-scene';
import type { ItemKind } from '../../src/domain/wardrobe/wardrobe';

/**
 * A kitchen unit is closed by its fronts from its bottom board to its top board (domain/kitchen/kitchen-fit.ts):
 * whatever Add item puts in it, no strip of open carcass is left that nothing could fill, whole fronts take the
 * whole unit, and appliances and pull-outs go only in the cabinet widths they are made for.
 */
const kitchenDefs = (FITTINGS as readonly FittingDef[]).filter(f => f.kitchen);
const madeWidth = (def: FittingDef) => Math.min(def.maxWidth ?? 56.4, Math.max(def.minWidth, 56.4));

function unitScene(unitKey: KitchenUnitKey, w: number, h?: number) {
  const design = createKitchenDesign(unitKey, unitKey); // the plain unit: empty, ready for Add item
  const state = { ...design, w, h: h ?? design.h, sel: 0, item: -1, divider: -1, space: null, open: false };
  const cabinet: EditorCabinet = { id: 1, name: 'U1', x: 0, y: kitchenUnit(unitKey).elevation, z: 0, angle: 0, state };
  const scene: EditorScene = { wardrobes: [cabinet], activeWardrobe: 1, nextWardrobeId: 2 };
  const reports: string[] = [];
  const scenes = createSceneCommands(() => scene, { report: m => reports.push(m) });
  const commands = { design: createDesignCommands(() => state, { report: m => reports.push(m) }), setCabinetSize: scenes.setCabinetSize };
  return { state, commands, reports, inside: () => kitchenInside(state.h, unitKey) };
}
const filled = (state: { secs: { h: number }[][] }) => Math.round(state.secs[0]!.reduce((s, it) => s + it.h, 0) * 100) / 100;

test('kitchen fit · every fitting added to an empty unit leaves no strip too low for another front', () => {
  for (const def of kitchenDefs) {
    for (const unitKey of def.kitchen!.units) {
      const width = madeWidth(def) + 2 * PANEL, { state, commands, inside } = unitScene(unitKey, width);
      commands.design.addMod(def.key as ItemKind);
      const items = state.secs[0]!;
      if (def.min > inside()) { assert.equal(items.length, 0, `${def.key} in ${unitKey}: refused when it cannot fit`); continue; }
      assert.equal(items.length, 1, `${def.key} in ${unitKey}: added`);
      const left = inside() - filled(state);
      assert.ok(left < .01 || left >= smallestFront(unitKey) - .01,
        `${def.key} in a ${unitKey} unit leaves ${left.toFixed(2)} cm open, lower than any front (${smallestFront(unitKey)} cm)`);
      if (takesWholeFront(def.key, unitKey) && def.max >= inside()) assert.ok(left < .01, `${def.key}: a whole front fills the ${unitKey} unit`);
    }
  }
});

test('kitchen fit · a cupboard, cargo or corner pull-out in a base unit fills its front, with nothing left open', () => {
  for (const [kind, w] of [['cupboard', 60], ['cargo', 30], ['corner', 100], ['dishwasher', 60], ['sink', 80]] as const) {
    const { state, commands, inside } = unitScene('base', w);
    commands.design.addMod(kind);
    assert.equal(filled(state), inside(), `${kind} fills the ${inside()} cm inside of a ${w} cm base unit`);
  }
  // Drawers stack until the last closes the unit: no 3 cm strip above the top drawer.
  const { state, commands, inside } = unitScene('base', 60);
  for (const kind of ['cutlery', 'pan', 'pan'] as const) commands.design.addMod(kind);
  assert.equal(filled(state), inside());
  assert.deepEqual(state.secs[0]!.map(it => it.k), ['cutlery', 'pan', 'pan']);
});

test('kitchen fit · whole fronts go only into an empty base unit', () => {
  for (const kind of ['dishwasher', 'fridge', 'corner', 'cargo', 'sink'] as const) {
    const def = kitchenDefs.find(f => f.key === kind)!, w = madeWidth(def) + 2 * PANEL;
    const { state, commands, reports } = unitScene('base', w);
    commands.design.addMod('cutlery');
    commands.design.addMod(kind);
    assert.deepEqual(state.secs[0]!.map(it => it.k), ['cutlery'], `${kind} does not stack on a drawer`);
    assert.match(reports.at(-1)!, /takes the whole front/);
  }
  // Higher up, a tall unit stacks them: a fridge under a cupboard, a cargo under a cupboard.
  const { state, commands } = unitScene('tall', 60);
  commands.design.addMod('fridge'); commands.design.addMod('cupboard');
  assert.deepEqual(state.secs[0]!.map(it => it.k), ['fridge', 'cupboard']);
});

test('kitchen fit · appliances and mechanisms go only in the cabinet widths they are made for', () => {
  const refused = (kind: ItemKind, w: number) => {
    const { state, commands } = unitScene('base', w);
    commands.design.addMod(kind);
    return state.secs[0]!.length === 0;
  };
  assert.ok(refused('corner', 60), 'a corner pull-out needs a 90–120 cm blind corner unit');
  assert.ok(!refused('corner', 90) && !refused('corner', 120));
  assert.ok(refused('oven', 100), 'an oven goes in a 60 cm housing, not a 100 cm one');
  assert.ok(refused('dishwasher', 90) && !refused('dishwasher', 45) && !refused('dishwasher', 60), 'dishwashers are 45 or 60 cm');
  assert.ok(refused('cargo', 60) && !refused('cargo', 15) && !refused('cargo', 40), 'a base cargo pull-out is 15–50 cm');
  for (const p of KITCHEN_PRESETS) {
    const design = createKitchenDesign(p.unit, p.key), bay = design.w - 2 * PANEL;
    for (const it of design.secs[0]!) {
      const def = kitchenDefs.find(f => f.key === it.k)!;
      assert.ok(bay <= (def.maxWidth ?? Infinity) + .01, `${p.key}: ${it.k} is made for its ${design.w} cm preset`);
    }
  }
});

test('kitchen fit · Add item cards say why a fitting does not fit', () => {
  const card = (unitKey: KitchenUnitKey, w: number, kind: string, before: ItemKind[] = []) => {
    const { state, commands } = unitScene(unitKey, w);
    for (const k of before) commands.design.addMod(k);
    const geometry = createWardrobeGeometry(() => state as never, () => 0);
    return createAddSuggestions(() => state as never, geometry as never).addSuggestions().list.find(x => x.k === kind)!;
  };
  assert.deepEqual([card('base', 60, 'corner').fit, card('base', 60, 'corner').hint], [false, 'Needs 86 cm width']);
  assert.deepEqual([card('base', 100, 'oven').fit, card('base', 100, 'oven').hint], [false, 'Made up to 57 cm wide']);
  assert.deepEqual([card('base', 60, 'dishwasher', ['cutlery']).fit, card('base', 60, 'dishwasher', ['cutlery']).hint], [false, 'Takes the whole cabinet front']);
  assert.equal(card('base', 60, 'fridge').fit, true, 'an under-counter fridge is a whole 60 cm base unit');
});

test('kitchen fit · resizing a unit keeps its fronts closed and an appliance housing no wider than the appliance', () => {
  const { state, commands, inside } = unitScene('base', 60);
  commands.design.addMod('cutlery'); commands.design.addMod('cupboard');
  assert.equal(filled(state), inside());
  commands.setCabinetSize('h', 95);
  assert.equal(filled(state), inside(), 'a taller unit: the top front grows with it');
  commands.setCabinetSize('h', 80);
  assert.equal(filled(state), inside(), 'a lower unit: the fronts shrink');
  const oven = unitScene('base', 60);
  oven.commands.design.addMod('oven');
  oven.commands.setCabinetSize('w', 90);
  assert.ok(oven.state.w <= 57 + 2 * PANEL + .01, `an oven housing stays an oven housing (${oven.state.w} cm)`);
  assert.match(oven.reports.at(-1)!, /Widest this cabinet can be/);
  // An open shelf the user left above a drawer stays open.
  const open = unitScene('base', 60);
  open.commands.design.addMod('cutlery');
  open.commands.setCabinetSize('h', 95);
  assert.equal(open.state.secs[0]![0]!.h, kitchenFitHeight('cutlery', 'base', 100), 'a drawer under open space keeps its height');
});

test('kitchen fit · a hob\'s drawer sits under the worktop, with pan drawers closing the unit below it', () => {
  const { state, commands, inside } = unitScene('base', 60);
  commands.design.addMod('hob');
  const hob = state.secs[0]![0]!;
  assert.equal(Math.round((hob.y! + hob.h) * 100) / 100, inside(), 'the hob drawer is at the top of the unit');
  commands.design.addMod('pan'); commands.design.addMod('pan');
  assert.deepEqual(state.secs[0]!.map(it => it.k), ['hob', 'pan', 'pan']);
  assert.equal(filled(state), inside(), 'the drawers below close the unit');
});

test('kitchen fit · smallest front and fit height come from the registry', () => {
  assert.equal(smallestFront('base'), Math.min(...kitchenDefs.filter(f => f.kitchen!.units.includes('base' as never)).map(f => f.min)));
  assert.equal(kitchenFitHeight('cupboard', 'base', 74.4), 74.4, 'a 72 cm door closes a 74.4 cm unit');
  assert.equal(kitchenFitHeight('cutlery', 'base', 74.4), 15, 'a drawer keeps its height under open space');
  assert.equal(kitchenFitHeight('oven', 'tall', 120), 60, 'an oven stays 60 cm');
  assert.equal(kitchenFitHeight('dishwasher', 'base', 74.4), 74.4);
});
