import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticInstallationParts } from '../../src/domain/kitchen/automatic-installation';
import { cornerCabinetWidths } from '../../src/domain/kitchen/corner-widths';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import type { EditorScene } from '../../src/application/projects/editor-scene';

const unit = (id: number, x = 0, z = 0, angle = 0, preset = 'cargo') => ({ id, name: 'Cabinet', x, y: 0, z, angle,
  state: { ...createEditorState(), ...createKitchenDesign('base', preset) } });
const layout = (preset: string) => [
  { ...unit(1, 0, 0, 0, 'corner'), state: { ...unit(1).state, ...createKitchenDesign('base', 'corner'), w: 102 } },
  unit(2, 22, 48, 270, preset),
];

test('both perpendicular cabinets receive 40 mm strips for cargo, drawers, cupboard and corner fittings', () => {
  for (const preset of ['cargo', 'drawers', 'base', 'corner']) {
    const boxes = layout(preset), before = structuredClone(boxes);
    // Keep the return's near end exactly 40 mm off the blind cabinet's front for any preset width.
    boxes[1]!.z = 33 + boxes[1]!.state.w / 2;
    const widths = cornerCabinetWidths(boxes[0]!, boxes);
    assert.deepEqual(widths.map(s => Math.round((s.to - s.from) * 10)), [400, 40, 580]);
    const parts = automaticInstallationParts(boxes), strip = parts.find(p => p.ownerId === 2 && p.state.unit === 'filler')!;
    assert.equal(strip.state.w, 4);
    assert.equal(strip.state.h, boxes[1]!.state.h);
    assert.equal(strip.state.d, boxes[1]!.state.d);
    assert.equal(cornerCabinetWidths(boxes[1]!, boxes).filter(s => s.strip).length, 0, 'return front keeps its nominal width');
    assert.equal(boxes[0]!.state.w, before[0]!.state.w);
    const fronts = piecefronts(boxes[0]!.state, widths).fronts;
    assert.equal(fronts.filter(f => f.installation).length, 1);
    assert.equal(fronts.find(f => f.installation)!.x1 - fronts.find(f => f.installation)!.x0, 4);
  }
});

test('a straight run gets two 18 mm external ends, no middle panels; adding/removing a unit recomputes ends', () => {
  const a = unit(1, 0, 0, 0, 'base'), b = unit(2, 60, 0, 0, 'base');
  const ends = automaticInstallationParts([a, b]);
  assert.deepEqual(ends.map(p => [p.ownerId, p.side, p.state.w]), [[1, -1, 1.8], [2, 1, 1.8]]);
  assert.ok(Math.abs(ends[0]!.x + 30.9) < 1e-8);
  assert.equal(automaticInstallationParts([a]).length, 2);
  const pieces = placePieces({ pieces: [a, b].map(p => ({ ...p, design: p.state })) });
  const panels = pieces.filter(p => p.id < 0);
  assert.deepEqual(panels.map(p => p.mark), ['P1L', 'P2R']);
  panels.forEach(p => assert.deepEqual(pieceBoards(p, pieces).map(b => b.cut), [{ length: 86, width: 58, thickness: 1.8 }]));
});

test('strip and panel defaults, custom values and construction settings survive save/reopen and undo checkpointing', () => {
  const boxes = layout('cargo'), scene: EditorScene = { wardrobes: boxes, activeWardrobe: 2, nextWardrobeId: 3 };
  let undo = 0; const commands = createSceneCommands(() => scene, { checkpoint: () => { undo++; } });
  assert.equal(commands.setKitchenConstruction('cornerStrip', 2.5), true);
  assert.equal(commands.setKitchenConstruction('endPanelThickness', 2.2), true);
  assert.equal(undo, 2);
  const project = sceneToProject(createProject('construction', 'Construction'), scene);
  const restored = projectToScene(deserializeProject(serializeProject(project)))!;
  const parts = automaticInstallationParts(restored.wardrobes).filter(p => p.ownerId === 2);
  assert.equal(parts.find(p => p.state.unit === 'filler')!.state.w, 2.5);
  assert.equal(parts.find(p => p.state.unit === 'end-panel')!.state.w, 2.2);
  // Old projects stored zero for the previous optional strip; these now use the required default.
  boxes[0]!.state.cornerStrip = 0;
  assert.equal(cornerCabinetWidths(boxes[0]!, boxes).find(s => s.strip)!.to - cornerCabinetWidths(boxes[0]!, boxes).find(s => s.strip)!.from, 4);
});

test('an added End/Separator pane inherits a shaped wardrobe side and all selected finish/construction settings', () => {
  const a = unit(1); delete a.state.product; delete a.state.unit;
  a.state.w = 180; a.state.h = 240; a.state.d = 64; a.state.frontThickness = 2.2; a.state.fin = 'Walnut';
  a.state.shape = { template: 'custom', top: [{ x: 0, y: 160 }, { x: 180, y: 240 }], back: [150, 225] };
  const scene: EditorScene = { wardrobes: [a], activeWardrobe: 1, nextWardrobeId: 2 };
  const pane = createSceneCommands(() => scene).addKitchenUnit('end-panel', { beside: true })!;
  assert.ok(pane);
  assert.deepEqual([pane.state.w, pane.state.h, pane.state.d, pane.state.frontThickness, pane.state.fin], [1.8, 240, 64, 2.2, 'Walnut']);
  assert.deepEqual(pane.state.materials, a.state.materials);
  assert.deepEqual(pane.state.shape, { template: 'custom', top: [{ x: 0, y: 240 }, { x: 1.8, y: 240 }], back: [225, 225] });
  assert.ok(Math.abs(pane.x - 90.9) < 1e-8);
  assert.equal(automaticInstallationParts(scene.wardrobes).length, 0, 'manual panes never receive extra finish panes');
});

test('external panels consume physical clearance; exact cabinet contact replaces the two facing finish panels', () => {
  const a = unit(1, 0, 0, 0, 'base'), b = unit(2, 62, 0, 0, 'base');
  const collision = createCabinetGeometry(() => [a, b]);
  assert.equal(collision.cabinetCollides(a), false, 'one shared 18 mm pane fits in a 20 mm gap');
  assert.equal(collision.cabinetCollides({ ...b, x: 60 }), false, 'a new cabinet at direct contact closes the run');
});

test('two ordinary cabinet fronts meeting at an inside corner receive separate strips on both ends', () => {
  const a = unit(1, 0, 0, 0, 'base'), b = unit(2, 59, 59, 270, 'base');
  const strips = automaticInstallationParts([a, b]).filter(p => p.state.unit === 'filler');
  assert.deepEqual(strips.map(p => [p.ownerId, p.side, p.state.w]), [[1, 1, 4], [2, -1, 4]]);
});

test('moving an assembly stops its actual end panel at the wall, and joining a run removes facing panels', () => {
  const a = unit(1, 0, 0, 0, 'base'), wall = { id: 'wall:test', x: 60, z: 0, y: 0, angle: 0, state: { w: 10, h: 270, d: 200 } };
  const collision = createCabinetGeometry(() => [a], () => [wall]);
  assert.ok(Math.abs(collision.safeCabinetTranslation(a, { x: 100, y: 0, z: 0 }).x - 23.2) < .001);
  const b = unit(2, 120, 0, 0, 'base'), join = createCabinetGeometry(() => [a, b]);
  assert.ok(Math.abs(join.safeCabinetTranslation(a, { x: 60, y: 0, z: 0 }).x - 60) < .001);
});


test('a roomless plan dimensions both 18 mm ends and the additive 40 mm corner strip beside their parts', () => {
  const boxes = layout('cargo'), pieces = boxes.map(p => ({ ...p, design: p.state }));
  const plan = technicalDrawings({ pieces }, { preset: 'installation' })[0]!;
  const widths = plan.views[0]!.items.flatMap(i => i.kind === 'dims' && i.stops.length === 2 ? [i.stops[1]] : []);
  assert.equal(widths.filter(w => w === 18).length, 2);
  assert.equal(widths.filter(w => w === 40).length, 1, 'the occupied strip is not repeated as an empty gap');
  assert.ok(widths.includes(300), 'cargo nominal width is still 300 mm');
});
