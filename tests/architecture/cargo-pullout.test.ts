import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { cargoPulloutGeometry, cargoTierCount, cargoBasketWidth } from '../../src/domain/kitchen/cargo-pullout';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createProject } from '../../src/domain/project/project';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createItemCommands } from '../../src/application/commands/item-commands';

const make = (design: any) => makePiece({
  pieces: [{ id: 1, name: 'Cabinet', x: 0, y: 0, z: 0, angle: 0, design }]
}, 1)!;

test('cargo tiers and dimensions · standard defaults and narrow 150mm module', () => {
  // Base cargo: 74cm height defaults to 2 tiers
  assert.equal(cargoTierCount(74), 2);
  // Tall cargo: 160cm height defaults to 4 tiers; 200cm defaults to 5 tiers
  assert.equal(cargoTierCount(160), 4);
  assert.equal(cargoTierCount(200), 5);

  // Narrow 150mm cabinet (clear bay ~11.4cm) has a 100mm basket width (Image 5 standard)
  assert.equal(cargoBasketWidth(11.4), 10);
  // Standard 300mm cabinet (clear bay ~26.4cm) has a ~22.4cm basket width
  assert.equal(cargoBasketWidth(26.4), 22.4);

  // Base cargo geometry
  const baseGeo = cargoPulloutGeometry(15, 9.8, 26.4, 74, 55);
  assert.equal(baseGeo.tiers, 2);
  assert.equal(baseGeo.baskets.length, 2);
  assert.equal(baseGeo.isTall, false);
  assert.equal(baseGeo.brackets.length, 2, 'base cargo has 2 front fixing brackets');
  assert.ok(baseGeo.runners.length >= 45, 'runners match depth');

  // Tall cargo geometry
  const tallGeo = cargoPulloutGeometry(20, 9.8, 36.4, 160, 55);
  assert.equal(tallGeo.tiers, 4);
  assert.equal(tallGeo.baskets.length, 4);
  assert.equal(tallGeo.isTall, true);
  assert.equal(tallGeo.brackets.length >= 3, true, 'tall cargo has at least 3 front fixing brackets');
  assert.ok(tallGeo.runners.top !== undefined, 'tall cargo has top guide runner');
});

test('cargo customization · custom tiers, basket style and mounting', () => {
  // Custom tiers on base unit (e.g. 3 tiers for spice pull-out as in Image 4)
  const baseCustom = cargoPulloutGeometry(15, 9.8, 26.4, 74, 55, { tiers: 3, basketStyle: 'solid' });
  assert.equal(baseCustom.tiers, 3);
  assert.equal(baseCustom.baskets.length, 3);
  assert.equal(baseCustom.basketStyle, 'solid');

  // Custom tiers on tall unit (e.g. 5 or 6 tiers for tall pantry larder)
  const tallCustom = cargoPulloutGeometry(20, 9.8, 36.4, 160, 55, { tiers: 5, basketStyle: 'wire', mount: 'bottom' });
  assert.equal(tallCustom.tiers, 5);
  assert.equal(tallCustom.baskets.length, 5);
  assert.equal(tallCustom.basketStyle, 'wire');
});

test('cargo make · cargo does NOT generate wooden drawer boxes (0 non accuracy)', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const basePiece = make(baseDesign);
  const boxBoards = basePiece.boards.filter(b => b.note === 'drawer box' || b.name.startsWith('Box '));
  assert.equal(boxBoards.length, 0, 'cargo must NOT have wooden carcass drawer box boards');

  const tallDesign = createKitchenDesign('tall', 'cargo-tall');
  const tallPiece = make(tallDesign);
  const tallBoxBoards = tallPiece.boards.filter(b => b.note === 'drawer box' || b.name.startsWith('Box '));
  assert.equal(tallBoxBoards.length, 0, 'tall cargo must NOT have wooden carcass drawer box boards');
});

test('cargo make · accurate hardware, runner screws, front door brackets and pilot holes', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);

  // Check hardware list has runners, brackets and screws
  const runners = piece.fittings.filter(f => f.kind === 'runner' || f.runner);
  assert.ok(runners.length >= 1, 'cargo has runner fitting');

  const brackets = piece.fittings.filter(f => (f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo'));
  assert.equal(brackets.length, 2, 'base cargo has 2 front brackets');

  // Check pilot holes drilled into the back of Cargo front for bracket screws
  const frontIndex = piece.boards.findIndex(b => b.name === 'Cargo front');
  assert.ok(frontIndex >= 0);
  const frontHoles = piece.holes.filter(h => h.board === frontIndex && h.kind === 'pilot');
  assert.equal(frontHoles.length, 4, '2 pilot holes per bracket on the front door');
  for (const h of frontHoles) {
    assert.equal(h.d, 2.5);
    assert.equal(h.depth, 10);
    assert.equal(h.sign, 1);
  }

  // System 32 runner holes on the carcass uprights
  const runnerHoles = piece.holes.filter(h => h.kind === 'runner');
  assert.ok(runnerHoles.length >= 2, 'carcass uprights drilled for cargo runners');
});

test('cargo assembly · stages follow drawer-runners -> drawers -> fronts -> drawer-test', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);
  const stages = piece.steps.map(s => s.stage);

  assert.ok(stages.includes('drawer-runners'), 'runners mounted to carcass');
  assert.ok(stages.includes('drawers'), 'cargo frame engaged');
  assert.ok(stages.includes('fronts'), 'front brackets attached to door');
  assert.ok(stages.includes('drawer-test'), 'baskets loaded and travel tested');

  const runnerIdx = stages.indexOf('drawer-runners');
  const drawersIdx = stages.indexOf('drawers');
  const frontsIdx = stages.indexOf('fronts');
  const testIdx = stages.indexOf('drawer-test');

  assert.ok(runnerIdx < drawersIdx, 'runners before frame engagement');
  assert.ok(drawersIdx < frontsIdx, 'frame before front attachment');
  assert.ok(frontsIdx < testIdx, 'front before travel test');
});

test('cargo motions · slides out together with the front door', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);
  const frontIndex = piece.boards.findIndex(b => b.name === 'Cargo front');
  const motion = piece.motions[frontIndex];

  assert.ok(motion && motion.kind === 'slide');
  if (motion && motion.kind === 'slide') {
    assert.ok(motion.by >= 30, 'front slides out at least 30cm');
  }
});

test('cargo technical drawings · inside view renders cargo pullout geometry', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const pf = piecefronts(baseDesign);

  assert.ok(pf.cargoPullouts.length >= 1, 'piecefronts returns cargoPullouts');
  const cargo = pf.cargoPullouts[0]!;
  assert.equal(cargo.tiers, 2);
  assert.equal(cargo.baskets.length, 2);
});

test('cargo hardware list · lists cargo pull-out system and components', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const pieces = placePieces({ pieces: [{ id: 1, name: 'Cargo', x: 0, y: 0, z: 0, angle: 0, design: baseDesign }] });
  const tables = hardwareList(pieces);
  const rows = tables.flatMap(t => t.rows);

  const cargoLine = rows.find(r => r[0]?.includes('Cargo pull-out'));
  assert.ok(cargoLine !== undefined, 'cargo pull-out system listed in hardware table');
});

test('cargo serialization · round-trip preserves tiers, basketStyle, and cargoMount', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  baseDesign.secs[0]![0]!.tiers = 3;
  baseDesign.secs[0]![0]!.basketStyle = 'solid';
  baseDesign.secs[0]![0]!.cargoMount = 'left';

  const scene = { wardrobes: [{ id: 1, name: 'Cargo', x: 0, y: 0, z: 0, angle: 0, state: { ...createEditorState(), ...baseDesign } }], activeWardrobe: 1, nextWardrobeId: 2 };
  const project = sceneToProject(createProject('cargo', 'Cargo'), scene as any);
  const json = serializeProject(project);
  const parsed = deserializeProject(json);
  const restored = projectToScene(parsed)!;

  const item = restored.wardrobes[0]!.state.secs[0]![0]!;
  assert.equal(item.tiers, 3);
  assert.equal(item.basketStyle, 'solid');
  assert.equal(item.cargoMount, 'left');
});

test('cargo commands · editItem updates cargo tiers, basketStyle, and cargoMount', () => {
  const design = { ...createEditorState(), ...createKitchenDesign('base', 'cargo') };
  let reports: string[] = [];
  const effects = {
    changed: () => {},
    milestone: () => {},
    checkpoint: () => {},
    closeInspector: () => {},
    requestUndo: () => {},
    report: (msg: string) => { reports.push(msg); },
  };
  const rules = {
    effectiveMin: () => 10,
    itemFreeAbove: () => 50,
    itemFeasible: () => true,
    itemGeom: () => ({ w: 26.4 }),
    widths: () => [26.4],
    splitFor: () => false,
    newItem: () => ({ k: 'cargo', h: 74 }),
    itemMinW: () => 10,
    sectionLayoutValid: () => true,
  };
  const commands = createItemCommands({
    getDesign: () => design,
    run: (fn: () => void) => fn(),
    effects,
    rules: rules as any,
    callbacks: { addShelfBoard: () => {} } as any,
  });

  // Edit tiers to 3
  commands.editItem(0, 0, { tiers: 3 });
  assert.equal(design.secs[0]![0]!.tiers, 3);

  // Edit basket style to solid
  commands.editItem(0, 0, { basketStyle: 'solid' });
  assert.equal(design.secs[0]![0]!.basketStyle, 'solid');

  // Edit mounting to left
  commands.editItem(0, 0, { cargoMount: 'left' });
  assert.equal(design.secs[0]![0]!.cargoMount, 'left');
});

