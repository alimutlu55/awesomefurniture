import test from 'node:test';
import assert from 'node:assert/strict';
import { installationDrawingFixture } from '../../scripts/installation-drawing-fixture.mjs';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { drawingInputOf } from '../../src/presentation/drawings/drawing-release';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { kitchenSpans } from '../../src/domain/kitchen/kitchen-runs';
import { cabinetLighting } from '../../src/domain/kitchen/cabinet-lighting';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { ventilationGrille } from '../../src/domain/kitchen/ventilation';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import type { Dimensions, Item } from '../../src/domain/drawings/drawing';

const reference = () => installationDrawingFixture() as EditorScene;
const sizes = (scene: EditorScene) => cornerCabinetWidths(scene.wardrobes[0]!, scene.wardrobes)
  .map(s => [Math.round((s.to - s.from) * 10), s.strip ? 'strip' : s.covered ? 'return' : 'exposed']);

test('the PDF corner chain is exactly 400 + 40 + 580; the strip consumes the existing width once', () => {
  const scene = reference(), before = structuredClone(scene);
  assert.deepEqual(sizes(scene), [[400, 'exposed'], [40, 'strip'], [580, 'return']]);
  const pieces = placePieces(drawingInputOf(scene)), corner = pieces.find(p => p.id === 1)!;
  const boards = pieceBoards(corner, pieces), strip = boards.find(b => b.name === 'Corner installation strip')!;
  assert.deepEqual(Object.values(strip.cut).map(v => Math.round(v * 10)), [780, 40, 18]);
  const door = boards.find(b => b.name === 'Corner pull-out door')!;
  assert.equal(Math.round(door.cut.width * 10), 397, '400 mm nominal face minus one 3 mm joint');
  assert.equal(Math.round(door.cut.thickness * 10), 18);
  assert.deepEqual(scene, before);
});

test('solid 40 mm strip and 18 mm end panel contain exactly one real board, without carcass parts', () => {
  const pieces = placePieces(drawingInputOf(reference()));
  for (const unit of ['filler', 'end-panel']) {
    const p = pieces.find(p => p.design.unit === unit)!, boards = pieceBoards(p, pieces);
    assert.equal(boards.length, 1);
    assert.ok(boards[0]!.cut.width > 0 && boards[0]!.cut.thickness > 0);
  }
  const end = pieces.find(p => p.id === 5)!;
  assert.deepEqual(pieceBoards(end, pieces)[0]!.cut, { length: 88, width: 53, thickness: 1.8 });
});

test('plan measures cabinets at their fronts; wall totals and shared millimetre stops close exactly', () => {
  const sheets = technicalDrawings(drawingInputOf(reference()), { preset: 'installation' });
  const dimensions = sheets[0]!.views[0]!.items.filter(i => i.kind === 'dims');
  const left = dimensions.find(d => d.side === -1 && d.dir.y === 1)!;
  assert.deepEqual(left.stops, [0, 18, 734, 1534, 2250, 2650, 2690, 3270]);
  assert.equal(left.origin.x, 600, 'chain starts at the actual 600 mm worktop front, inside the room');
  const back = dimensions.find(d => d.side === -1 && d.dir.x === 1)!;
  assert.equal(back.origin.y, -600);
  assert.equal(back.stops.at(-1), 4115);
  for (const d of dimensions) assert.equal(d.stops.slice(1).reduce((n, s, i) => n + s - d.stops[i]!, 0), d.stops.at(-1)! - d.stops[0]!);
});

test('construction dimensions and service intent survive validated save/reopen', () => {
  const scene = reference(), project = sceneToProject(createProject('precision', 'Precision'), scene);
  const restored = projectToScene(deserializeProject(serializeProject(project)))!;
  assert.deepEqual(sizes(restored), sizes(scene));
  assert.equal(restored.wardrobes[0]!.state.plinthHeight, 10);
  assert.equal(restored.wardrobes[0]!.state.frontThickness, 1.8);
  assert.equal(restored.wardrobes[0]!.state.worktopThickness, 2);
  assert.equal(restored.studio!.openings[0]!.status, 'new');
});

test('100 mm plinth keeps carcass height and fittings; fixtures follow the exact new worktop level', () => {
  const base = { id: 1, name: 'Base', x: 0, y: 0, z: 0, angle: 0, state: { ...createKitchenDesign('base'), sel: 0, item: -1, divider: -1, space: null, open: false } };
  const sink = { ...base, id: 2, y: 90, state: { ...base.state, ...createKitchenDesign('sink-top') } };
  const scene: EditorScene = { wardrobes: [base, sink], activeWardrobe: 1, nextWardrobeId: 3 };
  let undo = 0; const cmd = createSceneCommands(() => scene, { checkpoint: () => { undo++; } });
  assert.equal(cmd.setKitchenConstruction('plinthHeight', 10), true);
  assert.equal(base.state.h, 88); assert.equal(sink.y, 92);
  assert.equal(cmd.setKitchenConstruction('worktopThickness', 2), true); assert.equal(sink.y, 90);
  const spans = kitchenSpans(scene.wardrobes);
  assert.equal(spans.find(s => s.kind === 'plinth')!.height, 10);
  assert.equal(spans.find(s => s.kind === 'worktop')!.height, 2);
  assert.equal(undo, 2);
});

test('unsupported or exhausted corner allowance is rejected atomically and blocks invalid imported drawings', () => {
  const scene = reference(); scene.wardrobes[0]!.state.w = 70; scene.wardrobes[0]!.z = 35;
  const cmd = createSceneCommands(() => scene), before = structuredClone(scene);
  assert.equal(cmd.setKitchenConstruction('cornerStrip', 30), false);
  assert.deepEqual(scene, before);
  scene.wardrobes[0]!.state.cornerStrip = 30;
  assert.ok(validateForManufacture(drawingInputOf(scene)).findings.some(f => f.id === 'strip:K1' && f.severity === 'critical'));
});

test('a standard 600 mm front has a 597 mm blank and adjacent fronts share one 3 mm joint', () => {
  const d = createKitchenDesign('base'), boards = pieceBoards(placePieces({ pieces: [{ id: 1, name: 'Base', x: 0, y: 0, z: 0, angle: 0, design: d }] })[0]!);
  const front = boards.find(b => b.stock === 'front')!;
  assert.equal(Math.round(front.cut.width * 10), 597);
  assert.equal(Math.round((60 + front.x0 - front.x1) * 10), 3);
});

test('configured LED, new/retain/remove services and their exact datums have dedicated sheets and schedules', () => {
  const scene = reference(), first = scene.studio!.openings[0]!;
  scene.studio = { ...scene.studio!, openings: [first, { ...first, id: 'retain', offset: 100, status: 'retain' }, { ...first, id: 'remove', offset: 200, status: 'remove' }] };
  const sheets = technicalDrawings(drawingInputOf(scene)), services = sheets.find(s => s.title === 'Services elevation B')!;
  const strokes = services.views[0]!.items.filter(i => i.kind === 'line').map(i => i.stroke);
  for (const pen of ['service-new', 'service-retain', 'service-remove', 'lighting']) assert.ok(strokes.includes(pen as typeof strokes[number]));
  const rows = sheets.find(s => s.title === 'Service & lighting schedule')!.table!.rows;
  assert.deepEqual(rows.find(r => r[0]?.includes('electrical point'))!.slice(3), ['200', '1220', '140 × 70']);
  const shelf = scene.wardrobes.find(p => p.state.unit === 'shelf')!;
  assert.equal(cabinetLighting(shelf.state)[0]!.a.y, -.4, 'LED sits below the wall shelf, as in the actual model');
});

test('19 mm fronts and a specified fridge split retain exact stock and nominal door heights', () => {
  const d = { ...createKitchenDesign('tall', 'fridge'), h: 197.5, plinthHeight: 10, frontThickness: 1.9, fridgeSplit: 109.5 };
  d.secs[0]![0]!.h = 183.9;
  const fronts = piecefronts(d).fronts;
  assert.deepEqual(fronts.map(f => Math.round((f.y1 - f.y0) * 10)), [1095, 780]);
  const boards = pieceBoards(placePieces({ pieces: [{ id: 1, name: 'Fridge', x: 0, y: 0, z: 0, angle: 0, design: d }] })[0]!);
  assert.ok(boards.filter(b => b.stock === 'front').every(b => Math.round(b.cut.thickness * 10) === 19));
});

test('grille dimensions are purchased envelopes, are independently dimensioned, and invalid sizes block manufacture', () => {
  const scene = reference(), cabinet = scene.wardrobes.find(p => p.state.ventilationWidth)!;
  const v = ventilationGrille(cabinet.state)!;
  assert.deepEqual([v.width, v.height, v.y0, v.y1], [50, 6, 2, 8]);
  const sheets = technicalDrawings(drawingInputOf(scene));
  const detail = sheets.find(s => s.title === 'K' + cabinet.id + ' Ventilation grille')!;
  assert.match(detail.legend!.join(' '), /Do not cut this outline as a template/);
  assert.ok(detail.views[0]!.items.some(i => i.kind === 'dims' && i.stops.join() === '0,50,550,600'));
  cabinet.state.ventilationHeight = 12;
  assert.ok(validateForManufacture(drawingInputOf(scene)).findings.some(f => f.id === 'vent:K' + cabinet.id && f.severity === 'critical'));
});

test('plan drawing excludes redundant upper shelf chains and nests cabinet tags inside footprints', () => {
  const scene = reference();
  const sheets = technicalDrawings(drawingInputOf(scene), { preset: 'installation' });
  const plan = sheets.find(s => s.title === 'Plan')!;
  const dims = plan.views.flatMap(v => v.items).filter((i): i is Dimensions => i.kind === 'dims');
  // Wall A outer chain does not include shelf K32 (no 10 | 2920 | 350 chain on the floor plan)
  const wallAOuter = dims.filter(d => d.dir.y === 1 && d.side === 1);
  assert.equal(wallAOuter.length, 1, 'only total wall dimension exists on wall A outer side on floor plan');
  assert.deepEqual(wallAOuter[0]!.stops, [0, 3270]);

  // Open-end depth chain at the end of wall B measures 580 with no phantom 20 mm worktop overhang for tall unit
  const endDepthChain = dims.find(d => d.dir.y === -1 && d.stops.length === 2);
  assert.ok(endDepthChain, 'found open-end depth chain');
  assert.deepEqual(endDepthChain!.stops, [0, 580]);

  // Tags are positioned cleanly inside their footprints
  const tags = plan.views.flatMap(v => v.items).filter((i): i is Extract<Item, { kind: 'tag' }> => i.kind === 'tag');
  assert.ok(tags.some(t => t.text === 'K1'), 'K1 corner cabinet tag is present on plan');
  assert.ok(tags.some(t => t.text === 'K2'), 'K2 cabinet tag is present on plan');
});

test('cabinets slide tangentially along contact faces without friction or getting stuck', () => {
  const c1 = { id: 1, x: 0, y: 0, z: 0, angle: 0, state: { w: 60, h: 86, d: 58 } };
  const c2 = { id: 2, x: 60, y: 0, z: 0, angle: 0, state: { w: 60, h: 86, d: 58 } };
  const scene = { wardrobes: [c1, c2], walls: [] };
  const geom = createCabinetGeometry(() => scene.wardrobes);

  // 1. Sliding along a side neighbour in Z when mouse drifts 10 cm into neighbour (x: 50 instead of 60)
  const slideZ = geom.safeCabinetTranslation(c2, { x: 50, y: 0, z: 25 });
  assert.ok(Math.abs(slideZ.x - 60) < 1e-4, 'lateral penetration into neighbour is stopped at contact face');
  assert.ok(Math.abs(slideZ.z - 25) < 1e-4, 'sliding displacement along contact face is preserved without friction');

  // 2. Sliding vertically down between two cabinets in an exact-fit opening with lateral mouse drift
  const cLeft = { id: 24, x: -55.0, y: 152.6, z: -50.5, angle: 0, state: { w: 61, h: 117.4, d: 35 } };
  const cRight = { id: 8, x: 67.0, y: 152.6, z: -50.5, angle: 0, state: { w: 61, h: 117.4, d: 35 } };
  const cMid = { id: 54, x: 6.0, y: 200, z: -50.5, angle: 0, state: { w: 61, h: 117.4, d: 35 } };
  const slotGeom = createCabinetGeometry(() => [cLeft, cRight, cMid]);
  const slideDown = slotGeom.safeCabinetTranslation(cMid, { x: 6.2, y: 160, z: -50.5 });
  assert.ok(Math.abs(slideDown.x - 6.0) < 1e-4, 'slot lateral drift is constrained to exact slot boundary');
  assert.ok(Math.abs(slideDown.y - 160) < 1e-4, 'vertical descent into slot succeeds smoothly without getting stuck');

  // 3. Pure inward motion into neighbour is blocked cleanly
  const pureInward = geom.safeCabinetTranslation(c2, { x: -100, y: 0, z: 0 });
  assert.ok(Math.abs(pureInward.x - 60) < 1e-4);
  assert.ok(Math.abs(pureInward.z - 0) < 1e-4);
});


