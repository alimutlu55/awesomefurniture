import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { cornerReturnJoints, cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { automaticInstallationParts } from '../../src/domain/kitchen/automatic-installation';
import { sidePanelClearance } from '../../src/domain/kitchen/panel-clearance';
import { installationSolid, localSolid } from '../../src/domain/kitchen/installation-parts';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { planInstallationLayout } from '../../src/domain/kitchen/installation-layout';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { cornerJointFindings } from '../../src/domain/drawings/corner-joints';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { sheetPresentation } from '../../src/presentation/drawings/sheet-marks';
import { cornerPlanSetout } from '../../src/domain/drawings/corner-setout';
import { installationDrawingFixture } from '../../scripts/installation-drawing-fixture.mjs';
import { createEditorState } from '../../src/application/projects/editor-state';
import type { EditorCabinet, EditorScene } from '../../src/application/projects/editor-scene';

const layout = (frontThickness = 1.8, cornerStrip = 4, gap = cornerStrip): EditorCabinet[] => [
  { id: 1, name: 'Blind', x: 0, z: 0, y: 0, angle: 0, state: { ...createEditorState(), ...createKitchenDesign('base', 'corner'), w: 102, frontThickness } },
  { id: 2, name: 'Return', x: 22, z: 44 + gap, y: 0, angle: 270, state: { ...createEditorState(), ...createKitchenDesign('base', 'cargo'), cornerStrip } },
];
const inputOf = (boxes: ReturnType<typeof layout>) => ({ pieces: boxes.map(p => ({ ...p, design: p.state })) });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('blind corner allocation includes the overlap exactly once; parts touch without intersecting', () => {
  for (const thickness of [1.8, 1.9, 2.2]) for (const allowance of [4, 5.3]) {
    const boxes = layout(thickness, allowance), before = structuredClone(boxes);
    const joint = cornerReturnJoints(boxes[1]!, boxes)[0]!;
    near(joint.bodyGap, allowance); near(joint.requiredGap, allowance);
    near(joint.frontProjection + joint.stripWidth, allowance);
    near(sidePanelClearance(boxes[1]!, boxes[0], -1), allowance);
    const strip = automaticInstallationParts(boxes).find(p => p.state.unit === 'filler')!;
    near(strip.state.w, allowance - thickness);
    const pieces = placePieces(inputOf(boxes)), blind = pieces.find(p => p.id === 1)!;
    const fronts = pieceBoards(blind, pieces).filter(p => p.stock === 'front');
    const stock = installationSolid(strip), geometry = createCabinetGeometry(() => []);
    for (const front of fronts) assert.equal(geometry.cabinetOverlaps(stock, localSolid(boxes[0]!, front)), false);
    near(stock.z - stock.state.w / 2, 29 + thickness);
    assert.deepEqual(cornerJointFindings(pieces), []);
    assert.deepEqual(boxes, before);
  }
});

test('mirrored, translated and rotated corners retain exact joints and stable detail marks', () => {
  for (const mirror of [-1, 1]) for (const turn of [0, 37, 90, 180, 270]) {
    const a = turn * Math.PI / 180;
    const boxes = layout().map(p => {
      const x = mirror * p.x, angle = mirror < 0 ? -p.angle : p.angle;
      return { ...p, x: 123 + Math.cos(a) * x + Math.sin(a) * p.z, z: -87 - Math.sin(a) * x + Math.cos(a) * p.z, angle: angle + turn };
    });
    const joint = cornerReturnJoints(boxes[1]!, boxes)[0]!;
    near(joint.bodyGap, 4); near(joint.stripWidth, 2.2);
    const pieces = placePieces(inputOf(boxes));
    assert.deepEqual(cornerJointFindings(pieces), []);
    const detail = technicalDrawings(inputOf(boxes)).find(s => s.title === 'Corner K1 / K2')!;
    assert.ok(detail, 'detail exists for both hands');
    assert.deepEqual(sheetPresentation(detail, { project: 'Corner', date: '2026-10-28', total: 1 }).warnings, []);
    assert.deepEqual(technicalDrawings(inputOf([...boxes].reverse())).find(s => s.title === detail.title)!.views, detail.views);
  }
});

test('short, over-spaced and exhausted joints give measured findings without moving a saved layout', () => {
  for (const gap of [2.2, 5.8]) {
    const boxes = layout(1.8, 4, gap), before = structuredClone(boxes);
    const findings = cornerJointFindings(placePieces(inputOf(boxes)));
    assert.equal(findings.length, 1); assert.equal(findings[0]!.severity, 'critical');
    assert.match(findings[0]!.message, /18 mm (is missing|remains unfilled)/);
    assert.equal(validateForManufacture(inputOf(boxes)).ready, false);
    assert.deepEqual(planInstallationLayout(boxes).boxes, before);
    assert.deepEqual(boxes, before);
  }
  const exhausted = layout(5, 4);
  assert.match(cornerJointFindings(placePieces(inputOf(exhausted)))[0]!.message, /no usable return strip/);
  assert.equal(planInstallationLayout(exhausted, [], true).valid, false);
});

test('a manual undersized strip cannot silently suppress the correctly sized automatic strip', () => {
  const boxes = layout();
  boxes.push({ id: 3, name: 'Manual strip', x: 22, z: 32.5, y: 0, angle: 270,
    state: { ...createEditorState(), ...createKitchenDesign('filler'), w: 1 } });
  assert.equal(automaticInstallationParts(boxes).some(p => p.ownerId === 2), false);
  const findings = cornerJointFindings(placePieces(inputOf(boxes)));
  assert.ok(findings.some(f => f.id.endsWith(':stock') && f.message.includes('22 mm return strip')));
});

test('near-square joints project the real thickness and stacked dissimilar fronts cannot leave an unnoticed gap', () => {
  const boxes = layout(1.9);
  boxes[1]!.angle = 269.5;
  const joint = cornerReturnJoints(boxes[1]!, boxes)[0]!;
  assert.ok(joint.frontProjection > 1.9);
  near(joint.frontProjection + joint.stripWidth, 4);
  const stacked = layout();
  stacked[0]!.state.h = 40;
  stacked.push({ ...structuredClone(stacked[0]!), id: 3, y: 40, state: { ...stacked[0]!.state, frontThickness: 2.2 } });
  const findings = cornerJointFindings(placePieces(inputOf(stacked)));
  assert.ok(findings.some(f => f.id.endsWith(':stock')), 'one rectangular strip cannot close both stepped front planes');
});

test('editing thickness updates the butt-joint cut width and rejects an exhausted allowance atomically', () => {
  const scene = { wardrobes: layout(), activeWardrobe: 1, nextWardrobeId: 3 };
  const positions = scene.wardrobes.map(p => [p.x, p.z]);
  const commands = createSceneCommands(() => scene);
  assert.equal(commands.setKitchenConstruction('frontThickness', 1.9), true);
  near(automaticInstallationParts(scene.wardrobes).find(p => p.state.unit === 'filler')!.state.w, 2.1);
  assert.deepEqual(scene.wardrobes.map(p => [p.x, p.z]), positions);
  const before = structuredClone(scene);
  assert.equal(commands.setKitchenConstruction('frontThickness', 4), false);
  assert.deepEqual(scene, before);
});

test('the supplied reference chain remains 580 + 40 + 200 with 18 + 22 only on the corner detail', () => {
  const scene = installationDrawingFixture() as EditorScene;
  const input = { studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) };
  const sheets = technicalDrawings(input, { preset: 'installation' });
  const elevation = sheets.find(s => s.title === 'Elevation A')!;
  const chain = elevation.views.flatMap(v => v.items).find(i => i.kind === 'dims' && i.dir.x === 1 && i.side === -1 && i.row === 0)!;
  assert.equal(chain.kind, 'dims'); if (chain.kind !== 'dims') return;
  assert.deepEqual(chain.stops.slice(0, 4), [0, 580, 620, 820]);
  const planDimensions = sheets[0]!.views.flatMap(v => v.items).filter(i => i.kind === 'dims');
  const main = planDimensions.find(i => i.dir.x === 1 && i.side === -1 && i.stops.length > 4)!;
  assert.deepEqual(main.stops.slice(0, 3), [580, 620, 820], 'plan starts at the return face and measures the full allowance');
  assert.ok(planDimensions.some(i => i.stops.join() === '0,20' && i.origin.y !== main.origin.y), 'local projection has its own dimension line');
  assert.ok(elevation.views.flatMap(v => v.items).some(i => i.kind === 'dims' && i.stops.join() === '0,20' && i.origin.y > 0),
    'local projection is beside the worktop, not on the bottom installation chain');
  assert.equal(planDimensions.some(i => i.stops.slice(1).some((s, k) => s - i.stops[k]! === 22)), false,
    'the return strip cutting width never appears as a separate cabinet-plan interval');
  const detail = sheets.find(s => s.title === 'Corner K1 / K7')!;
  assert.match(detail.legend!.join(' '), /40 allocation = 18 overlap \+ 22 return strip/);
  assert.ok(detail.views[0]!.items.some(i => i.kind === 'dims' && i.stops.join() === '0,18,40'));
  assert.deepEqual(cornerCabinetWidths(scene.wardrobes[0]!, scene.wardrobes).map(s => Math.round((s.to - s.from) * 10)), [400, 40, 580]);
});

test('a submillimetre placement difference cannot bring the strip cutting width back onto the overview', () => {
  const scene = installationDrawingFixture() as EditorScene;
  scene.wardrobes = scene.wardrobes.filter(p => p.id !== 6);
  scene.wardrobes.find(p => p.id === 7)!.x += .004;
  const sheets = technicalDrawings({ studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) }, { preset: 'installation' });
  for (const title of ['Plan', 'Elevation A']) {
    const dimensions = sheets.find(s => s.title === title)!.views.flatMap(v => v.items).filter(i => i.kind === 'dims');
    const prefix = title === 'Plan' ? '580,620,820,' : '0,580,620,820,';
    assert.ok(dimensions.some(i => i.stops.join().startsWith(prefix)), title + ' retains the gross chain');
    assert.equal(dimensions.some(i => i.stops.slice(1).some((s, k) => s - i.stops[k]! === 22)), false);
  }
});

test('the local projection follows the actual shared worktop when the next cabinet is deeper', () => {
  const scene = installationDrawingFixture() as EditorScene;
  const next = scene.wardrobes.find(p => p.id === 2)!;
  next.state.d += 2; next.x += 1;
  const pieces = placePieces({ studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) });
  assert.ok(cornerPlanSetout(pieces).some(i => i.kind === 'dims' && i.stops.join() === '0,40'),
    '20 mm deeper neighbouring body plus 20 mm overhang reaches 40 mm beyond the corner body');
});

test('a saved 22 mm corner shows a plain 40 allocation on the overview without altering its pose or hiding its clash', () => {
  const scene = installationDrawingFixture() as EditorScene;
  scene.wardrobes = scene.wardrobes.filter(p => p.id !== 6);
  for (const id of [7, 8, 9]) scene.wardrobes.find(p => p.id === id)!.x -= 1.8;
  const before = structuredClone(scene);
  const input = { studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) };
  const sheets = technicalDrawings(input, { preset: 'installation' });
  for (const title of ['Plan', 'Elevation A']) {
    const sheet = sheets.find(s => s.title === title)!;
    assert.ok(sheet.views.flatMap(v => v.items).some(i => i.kind === 'dims' && Object.values(i.labels ?? {}).includes('40')));
    const paper = sheetPresentation(sheet, { project: 'Existing corner', date: '2026-10-28', total: sheets.length });
    assert.ok(paper.marks.some(m => m.kind === 'text' && m.font === 'figure' && m.text === '40'));
    assert.equal(paper.marks.some(m => m.kind === 'text' && m.font === 'figure' && /required/.test(m.text)), false);
    assert.equal(paper.marks.some(m => m.kind === 'text' && m.font === 'figure' && m.text === '22'), false);
  }
  assert.ok(validateForManufacture(input).findings.some(f => f.id.startsWith('corner:') && f.message.includes('18 mm is missing')));
  assert.deepEqual(scene, before, 'overview annotations never move saved furniture or remove a configured panel');
});

test('parallel, elevated and unrelated neighbours create no corner detail', () => {
  for (const change of [{ angle: 0 }, { y: 200 }, { x: 300 }]) {
    const boxes = layout(); Object.assign(boxes[1]!, change);
    assert.deepEqual(cornerJointFindings(placePieces(inputOf(boxes))), []);
    assert.equal(technicalDrawings(inputOf(boxes)).some(s => s.title.startsWith('Corner ')), false);
  }
});

test('open corners check both independently configured legs but emit one detail per pair', () => {
  const boxes = layout();
  boxes[0]!.state.w = 60;
  boxes[1]!.state.w = 60; boxes[1]!.x = 64.8; boxes[1]!.z = 64.8;
  const pieces = placePieces(inputOf(boxes));
  assert.equal(cornerReturnJoints(boxes[0]!, boxes)[0]!.blind, false);
  assert.deepEqual(cornerJointFindings(pieces), []);
  assert.equal(technicalDrawings(inputOf(boxes)).filter(s => s.title.startsWith('Corner ')).length, 1);
  const withoutFirstLeg = pieces.filter(p => p.attachedTo !== 1);
  const withoutSecondLeg = pieces.filter(p => p.attachedTo !== 2);
  for (const incomplete of [withoutFirstLeg, withoutSecondLeg])
    assert.ok(cornerJointFindings(incomplete).some(f => f.id.endsWith(':stock')));
});
