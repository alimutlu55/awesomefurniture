import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { KITCHEN_PRESETS, createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import type { KitchenUnitKey } from '../../src/domain/kitchen/kitchen-units';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { cutLayout } from '../../src/domain/make/make-cut-layout';
import { buildModel } from '../../src/domain/engine/build-model';
import { passport, allParts } from '../../src/domain/engine/passport';
import { shelfSag, SAG_LIMIT } from '../../src/domain/engine/physics/structure';
import { substrateOf } from '../../src/domain/engine/physics/substrate';
import { evaluate, RULE_PACKS } from '../../src/domain/engine/rules/rule-packs';
import { BUILDER_PROFILES } from '../../src/domain/engine/catalog/builder-profiles';
import { quote, QUOTE_GROUPS } from '../../src/domain/engine/catalog/quote';
import { perEuro } from '../../src/domain/engine/catalog/price-list';
import { inspect } from '../../src/domain/engine/inspect';
import { PURPOSES } from '../../src/domain/wardrobe/purposes';
import { POSSESSIONS } from '../../src/domain/wardrobe/possessions';

/** A planned wardrobe as Auto design leaves it (as the golden tests make it), regular or shaped. */
function planned(template?: 'sloped' | 'stepped'): EditorDesign {
  const state = createEditorState();
  if (template) {
    const start = createFromTemplate(template, { w: state.w, h: state.h, maxN: 6 });
    Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
  }
  const best = generateDesignedLayouts(createWardrobeGeometry(() => state).plannerConfig())[0];
  if (best) createDesignCommands(() => state).applyProposal(best as never);
  return state as unknown as EditorDesign;
}
const one = (design: EditorDesign): DrawingInput => ({ pieces: [{ id: 4, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] });
const kitchens = KITCHEN_PRESETS.map(p => createKitchenDesign(p.unit as KitchenUnitKey, p.key));
const wardrobes = { regular: planned(), sloped: planned('sloped'), stepped: planned('stepped'), initial: createInitialDesign() };
const wide = (secs: EditorDesign['secs'], w = 124, h = 220): EditorDesign => ({ ...createInitialDesign(), w, h, d: 60, n: 1, wt: [1], secs });

test('engine · the build model is made of exactly the boards the drawings and the cutting list use', () => {
  for (const design of [...Object.values(wardrobes), ...kitchens]) {
    const input = one(design), model = buildModel(input), placed = placePieces(input);
    for (const built of model.pieces) {
      const cut = pieceBoards(placed.find(p => p.id === built.piece.id)!, placed);
      assert.deepEqual(built.make.boards.slice(0, cut.length), cut, 'the model starts with the cutting list\'s boards, in order');
    }
  }
});

test('engine · a builder profile lowers every piece to its joints and back; the outside of the piece stays', () => {
  const input = one(wardrobes.regular);
  for (const profile of BUILDER_PROFILES) {
    const model = buildModel(input, { construction: profile.construction });
    assert.deepEqual(model.pieces[0]!.make.construction, profile.construction);
    // The outside of the piece is the same; inside, a grooved back sits further in, so shelves and partitions follow it.
    const outside = (m: typeof model) => m.pieces[0]!.make.boards.filter(b => b.name === 'Side' || b.name === 'Top').map(b => b.cut);
    assert.deepEqual(outside(model), outside(buildModel(input)));
    assert.notEqual(model.revision, buildModel(input).revision);
  }
});

test('engine · what is kept stands on the board under it, and its weight follows its purpose in the registry', () => {
  const model = buildModel(one(wide([[{ k: 'shelf', h: 35, purpose: 'folded' }, { k: 'shelf', h: 35, purpose: 'linen' }]], 80)));
  const piece = model.pieces[0]!, linen = piece.contents.find(c => c.purpose === 'linen')!;
  assert.equal(linen.carried.kind, 'boards');
  const share = linen.carried.kind === 'boards' ? linen.carried.shares[0]! : null, board = piece.make.boards[share!.board]!;
  assert.equal(board.name, 'Shelf');
  assert.ok(Math.abs(board.y1 - linen.box.y0) < 2.5, 'its board is the one under it');
  const load = PURPOSES.find(p => p.key === 'linen')!.load;
  assert.ok('kgPerM2' in load);
  assert.ok(Math.abs(share!.kg - load.kgPerM2 * (board.x1 - board.x0) * (board.z1 - board.z0) / 1e4) < 1e-9);
});

test('engine · every purpose and possession says how heavy it is', () => {
  for (const p of [...PURPOSES, ...POSSESSIONS]) {
    const value = 'kgPerM2' in p.load ? p.load.kgPerM2 : p.load.kgPerMetre;
    assert.ok(Number.isFinite(value) && value >= 0, p.key);
  }
});

test('engine · shelf sag is a beam on two supports: it grows with the fourth power of the span and falls with the cube of the thickness', () => {
  const b = (t: number) => ({ name: 'Shelf', stock: 'carcass' as const, x0: 0, x1: 80, y0: 0, y1: t, z0: 0, z1: 50, cut: { length: 80, width: 50, thickness: t }, edges: 'L1' });
  const sag = (span: number, t = 1.8, kg = 0) => shelfSag(b(t), span, kg, 'unknown-decor');
  assert.ok(Math.abs(sag(80) / sag(40) - 16) < 1e-9);
  // Under its own weight alone the load grows with the thickness, so sag falls with its square; what is kept on it adds sag
  // that falls with the cube.
  assert.ok(Math.abs(sag(80, 1.8) / sag(80, 3.6) - 4) < 1e-9);
  assert.ok(Math.abs((sag(80, 1.8, 10) - sag(80, 1.8)) / (sag(80, 3.6, 10) - sag(80, 3.6)) - 8) < 1e-9);
  assert.equal(substrateOf('unknown-decor', 1.8).key, 'chipboard');
  assert.equal(substrateOf('unknown-decor', .3).key, 'hdf');
  // An 80 cm, 18 mm chipboard shelf under folded clothes stays inside the limit; at 120 cm it does not.
  const folded = (span: number) => sag(span, 1.8, 30 * span / 100 * .5) / (span * 10 * SAG_LIMIT);
  assert.ok(folded(80) < 1 && folded(120) > 1);
});

test('engine · rule packs: the manufacturing check is shown whole, with severities mapped and a fix for the bay', () => {
  const input = one(wide([[{ k: 'shelf', h: 35, purpose: 'linen' }, { k: 'short', h: 106 }]]));
  const model = buildModel(input), e = evaluate(model), check = validateForManufacture(input);
  const manufacturing = e.findings.filter(f => f.pack === 'manufacturing');
  assert.equal(manufacturing.length, check.findings.length);
  assert.equal(manufacturing.filter(f => f.severity === 'blocking').length, check.findings.filter(f => f.severity === 'critical').length);
  assert.equal(e.ready, check.ready);
  const span = manufacturing.find(f => f.id.includes('shelf-span'))!, split = span.fixes.find(f => f.action.kind === 'split-bay')!.action;
  assert.deepEqual(split, { kind: 'split-bay', piece: 4, bay: 0 }, 'the fix splits the bay the shelf spans');
  assert.deepEqual(e.findings.map(f => f.severity), [...e.findings.map(f => f.severity)].sort((a, b) => ['blocking', 'warning', 'advice'].indexOf(a) - ['blocking', 'warning', 'advice'].indexOf(b)));
  assert.deepEqual(evaluate(buildModel(input)).findings, e.findings, 'deterministic');
  assert.deepEqual(RULE_PACKS.map(p => p.key), ['manufacturing', 'drilling', 'buildability', 'engineering']);
});

test('engineering · a heavy shelf, a long rail and an overloaded pull-down rail are reported with a fix', () => {
  const sag = evaluate(buildModel(one(wide([[{ k: 'shelf', h: 35, purpose: 'linen' }, { k: 'shelf', h: 35, purpose: 'linen' }, { k: 'short', h: 106 }]]))));
  assert.ok(sag.findings.some(f => f.pack === 'engineering' && f.id.startsWith('engineering:shelf-sag') && f.fixes.some(x => x.action.kind === 'split-bay')));
  const rail = evaluate(buildModel(one(wide([[{ k: 'long', h: 160 }]], 134))));
  assert.ok(rail.findings.some(f => f.id.startsWith('engineering:rail-span') && f.severity === 'warning'));
  const lift = evaluate(buildModel(one(wide([[{ k: 'lift', h: 100, purpose: 'long' }]], 104, 240))));
  assert.ok(lift.findings.some(f => f.id.startsWith('engineering:lift-load') && f.title.includes('% of its limit')));
});

test('engine · default designs carry what is planned for them: no engineering warning', () => {
  for (const design of [...Object.values(wardrobes), ...kitchens]) {
    const e = evaluate(buildModel(one(design)));
    assert.deepEqual(e.findings.filter(f => f.pack === 'engineering' && f.severity !== 'advice').map(f => f.title), []);
  }
});

test('passport · counts what Make builds and lays out', () => {
  const model = buildModel(one(wardrobes.regular)), p = passport(model), parts = allParts(model);
  assert.equal(p.parts, model.pieces.reduce((s, q) => s + q.make.parts.length, 0));
  assert.equal(p.boards, model.pieces.reduce((s, q) => s + q.make.boards.length, 0));
  assert.equal(p.holes, model.pieces[0]!.make.holes.length);
  assert.equal(p.sheets, cutLayout(parts).sheets.length);
  assert.ok(p.yield > 0 && p.yield <= 1);
  assert.ok(p.kg > 20 && p.assemblyMinutes > 30);
  assert.equal(p.hardwareCount, model.pieces[0]!.make.buy.reduce((s, b) => s + b.qty, 0));
});

test('quote · lines add up, services follow the profile, currencies convert at the credits\' rates', () => {
  const input = one(wardrobes.regular);
  const quotes = BUILDER_PROFILES.map(p => quote(buildModel(input, { construction: p.construction }), p, 'eur'));
  for (const q of quotes) {
    assert.ok(Math.abs(q.total - q.lines.reduce((s, l) => s + l.total, 0)) < .05);
    assert.ok(Math.abs(q.total - QUOTE_GROUPS.reduce((s, g) => s + q.groups[g], 0)) < .05);
    assert.ok(q.groups.boards > 0 && q.groups.hardware > 0);
  }
  const [diy, shop, workshop] = quotes;
  assert.ok(!diy!.lines.some(l => l.label === 'CNC drilling') && shop!.lines.some(l => l.label === 'CNC drilling'));
  assert.equal(diy!.groups.labour, 0);
  assert.ok(workshop!.groups.labour > 0 && workshop!.ownMinutes === 0 && diy!.ownMinutes > shop!.ownMinutes);
  assert.ok(diy!.total < workshop!.total);
  const pln = quote(buildModel(input, { construction: BUILDER_PROFILES[0].construction }), BUILDER_PROFILES[0], 'pln');
  assert.ok(Math.abs(pln.total / diy!.total - perEuro('pln')) < .01);
});

test('inspect · one call gives the model, passport, findings and a quote per profile', () => {
  const r = inspect(one(kitchens[3]!), { currency: 'pln' });
  assert.equal(r.quotes.length, BUILDER_PROFILES.length);
  assert.equal(r.evaluation.revision, r.model.revision);
  assert.ok(r.quotes.every(q => q.currency === 'pln'));
});
