import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { assemblyTimeline } from '../../src/domain/make/make-timeline';
import { entryOf } from '../../src/domain/make/make-fixing';
import { drawerBoardOffset } from '../../src/domain/make/drawer-installation';
import { cargoPulloutGeometry, cargoTierCount, cargoBasketWidth } from '../../src/domain/kitchen/cargo-pullout';
import { stagingLayout, hardwareStagingLayout } from '../../src/domain/make/make-staging';
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

  // Verify chassis fitting is held in drawers stage
  const drawersStep = piece.steps.find(s => s.stage === 'drawers')!;
  assert.ok(drawersStep.fittings.some(f => f.kind === 'support' && f.size?.includes('cargo')));

  // Verify timeline and travel test animation
  const tl = assemblyTimeline(piece);
  assert.ok(tl.duration > 20, 'timeline duration is positive');
  const testStepTime = tl.steps[testIdx]!;
  assert.ok(testStepTime.end > testStepTime.start, 'drawer-test has duration');

  const frontIndex = piece.boards.findIndex(b => b.name === 'Cargo front');
  const testMid = (testStepTime.place[0] + testStepTime.place[1]) / 2;
  const offset = drawerBoardOffset(piece, tl, { step: testIdx, t: testMid } as any, frontIndex);
  assert.ok(offset[2] >= 20, 'cargo slides forward during drawer-test');
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

test('cargo staging · all cargo materials (runners, frame, baskets, brackets) are staged on the floor in initial chapter', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);
  const stagedBoards = stagingLayout(piece, 0);
  const stagedHw = hardwareStagingLayout(piece, stagedBoards, 0);

  // Check that hardware items exist in the staging layout
  assert.ok(stagedHw.size >= 4, 'hardware staging includes runners, chassis frame, baskets, and brackets');

  // Verify runners staged on the floor
  const runnerIdx = piece.fittings.findIndex(f => f.kind === 'runner');
  assert.ok(runnerIdx >= 0 && stagedHw.has(runnerIdx));
  const runnerStaged = stagedHw.get(runnerIdx)!;
  assert.ok(runnerStaged.at[1] >= 0 && runnerStaged.at[1] <= 10, 'runners rest on the floor');
  assert.ok(runnerStaged.at[2] >= piece.size.d + 30, 'runners are in the staging area in front of the cabinet');

  // Verify chassis frame staged on the floor
  const frameIdx = piece.fittings.findIndex(f => f.kind === 'support' && f.size?.includes('cargo frame'));
  assert.ok(frameIdx >= 0 && stagedHw.has(frameIdx));
  const frameStaged = stagedHw.get(frameIdx)!;
  assert.ok(frameStaged.at[1] >= 0 && frameStaged.at[1] <= 10, 'cargo frame rests on the floor');

  // Verify baskets staged on the floor
  const basketIdx = piece.fittings.findIndex(f => f.kind === 'rail' && f.size?.includes('cargo basket'));
  assert.ok(basketIdx >= 0 && stagedHw.has(basketIdx));
  const basketStaged = stagedHw.get(basketIdx)!;
  assert.ok(basketStaged.at[1] >= 0 && basketStaged.at[1] <= 15, 'cargo baskets rest on the floor');

  // Verify brackets staged on the floor
  const bracketIdx = piece.fittings.findIndex(f => (f.kind === 'bracket' || f.kind === 'plate') && f.size?.includes('cargo'));
  assert.ok(bracketIdx >= 0 && stagedHw.has(bracketIdx));
});

test('cargo smooth motion in fronts stage · zero jumping when cargo opens to receive door', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);
  const tl = assemblyTimeline(piece);
  const frontsIdx = piece.steps.findIndex(s => s.stage === 'fronts');
  assert.ok(frontsIdx >= 0, 'fronts step exists');
  const s = tl.steps[frontsIdx]!;
  const frontIdx = piece.boards.findIndex(b => b.name === 'Cargo front');
  assert.ok(frontIdx >= 0);

  // Before place[0]: offset must be exactly 0 (door lying on floor, chassis closed)
  const tBefore = s.place[0] - 0.2;
  const offBefore = drawerBoardOffset(piece, tl, { step: frontsIdx, t: tBefore } as any, frontIdx);
  assert.equal(offBefore[2], 0, 'cargo does not open before door placement starts (no jumping)');

  // During place phase: offset must be continuous and strictly increasing from 0 to motion.by
  let prevZ = 0;
  for (let step = 1; step <= 5; step++) {
    const tPlace = s.place[0] + (s.place[1] - s.place[0]) * (step / 5);
    const offPlace = drawerBoardOffset(piece, tl, { step: frontsIdx, t: tPlace } as any, frontIdx);
    assert.ok(offPlace[2] >= prevZ, 'offset increases monotonically during placing');
    // Ensure smooth gradient, no huge delta
    assert.ok(offPlace[2] - prevZ <= 15, 'no discontinuous jump during placing');
    prevZ = offPlace[2];
  }

  // During fix phase: offset must stay fully extended
  const tFixMid = (s.fix[0] + s.fix[1]) / 2;
  const offFix = drawerBoardOffset(piece, tl, { step: frontsIdx, t: tFixMid } as any, frontIdx);
  assert.ok(offFix[2] >= 30, 'cargo is fully extended while brackets are fastened to frame');

  // After fix[1]: offset must smoothly close back to 0
  const tEnd = s.end - 0.05;
  const offEnd = drawerBoardOffset(piece, tl, { step: frontsIdx, t: tEnd } as any, frontIdx);
  assert.ok(offEnd[2] <= 5, 'cargo smoothly returns home after fixing');
});

test('cargo chassis & bracket alignment · zero gap and exact co-location', () => {
  const d = 55;
  const geo = cargoPulloutGeometry(15, 9.8, 26.4, 74, d);
  assert.equal(geo.brackets.length, 2);

  for (const br of geo.brackets) {
    // Height of bracket must match horizontal arms in the frame
    const matchingCrossbars = geo.frame.crossbars.filter(c => Math.abs((c.y0 + c.y1) / 2 - br.y) < 0.2);
    assert.ok(matchingCrossbars.length >= 1, `bracket at y=${br.y} has matching horizontal arms in chassis frame`);

    // The crossbar tongue must reach exactly the door panel back face at z = d
    const maxCrossbarZ1 = Math.max(...matchingCrossbars.map(c => c.z1));
    assert.ok(maxCrossbarZ1 >= d, 'frame horizontal arm reaches door back panel with 0mm mismatch');

    // Screws are centered within bracket plate
    for (const s of br.screws) {
      assert.ok(Math.abs(s[0] - 15) <= 2.5, 'bracket screws are within bracket plate width');
    }
  }
});

test('cargo front brackets · bracket and pilot screws share unified fix groups entering along Z', () => {
  const baseDesign = createKitchenDesign('base', 'cargo');
  const piece = make(baseDesign);
  const frontsIdx = piece.steps.findIndex(s => s.stage === 'fronts');
  assert.ok(frontsIdx >= 0);
  const step = piece.steps[frontsIdx]!;

  // Cargo brackets must have kind: plate (so as not to collide with wall bracket roof tests)
  const brackets = step.items.filter(i => piece.fittings[i]!.size?.includes('cargo front bracket'));
  assert.equal(brackets.length, 2, '2 front brackets for base cargo');
  for (const b of brackets) {
    assert.equal(piece.fittings[b]!.kind, 'plate');
  }

  // All brackets and front-fixing screws must have direction [0, 0, 1] through the door panel
  const frontIdx = piece.boards.findIndex(b => b.name === 'Cargo front');
  for (const i of step.items) {
    const f = piece.fittings[i]!;
    if (f.kind === 'plate' || (f.kind === 'screw' && f.purpose === 'drawer-front')) {
      const e = entryOf(piece, i);
      assert.ok(e, 'entry exists');
      assert.deepEqual(e.dir, [0, 0, 1], 'enters along +Z into the door back');
      assert.equal(e.board, frontIdx, 'mounted to cargo door');
    }
  }

  // Bracket and its screws must be co-located in the same fix groups
  const tl = assemblyTimeline(piece);
  const s = tl.steps[frontsIdx]!;
  const bracketFixes = s.fixes.filter(f => f.items.some(i => piece.fittings[i]!.size?.includes('cargo front bracket')));
  assert.equal(bracketFixes.length, 2, 'exactly 2 bracket fix groups (top and bottom)');
  for (const fix of bracketFixes) {
    const hasBracket = fix.items.some(i => piece.fittings[i]!.kind === 'plate');
    const hasScrews = fix.items.some(i => piece.fittings[i]!.kind === 'screw');
    assert.ok(hasBracket && hasScrews, 'each bracket fix group includes both the bracket plate and its fixing screws');
    assert.equal(fix.before, false, 'fastened to the door in the cabinet');
  }
});

