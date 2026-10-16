import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial } from 'three';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { roofDividerMesh } from '../../src/presentation/viewport/roof-divider-mesh';
import { PANEL, PLINTH } from '../../src/domain/wardrobe/catalog.js';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createProject } from '../../src/domain/project/project';
import { dividerRoofPatches } from '../../src/domain/wardrobe/shape/roof-divider';

function fixture() {
  const state = { ...createEditorState(), w: 200, h: 240, d: 80, n: 1, sel: 0,
    shape: { template: 'custom' as const, top: [{ x: 0, y: 240 }, { x: 200, y: 240 }], back: [140, 140] } };
  state.secs = [[], [], [], [], [], []];
  return { state, commands: createDesignCommands(() => state), rules: createWardrobeGeometry(() => state) };
}

test('a newly added divider fills the roof across its depth, following the exact underside', () => {
  const { state, commands, rules } = fixture(); commands.addSpaceDivider();
  const divider = state.dividers[0]!; assert.equal(divider.roofFit, true);
  const r = rules.dividerRect(divider), mesh = roofDividerMesh(state, PANEL + r.x0, PANEL + r.x1, PLINTH + PANEL + r.y0, new MeshStandardMaterial());
  const positions = mesh.geometry.attributes.position!;
  let high = 0, rearHigh = 0;
  for (let k = 0; k < positions.count; k++) {
    const y = positions.getY(k), z = positions.getZ(k), underside = 140 - PANEL + (z + 40) * 100 / 80;
    assert.ok(y <= underside + .0001, 'every board vertex stays below the physical roof');
    if (Math.abs(y - (PLINTH + PANEL)) > .001) assert.ok(Math.abs(y - underside) < .0001, 'cut edge contacts the roof');
    high = Math.max(high, y); if (z < -39) rearHigh = Math.max(rearHigh, y);
  }
  assert.ok(high - rearHigh > 95, 'the taller front is filled instead of using the low rear as a flat cap');
  assert.equal(rules.dividerValid(divider, 0), true);
  mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose();
});

test('shortened dividers retain a flat chosen height and automatic fitting survives saved sessions', () => {
  const { state, commands } = fixture(); commands.addSpaceDivider();
  const scene = { wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
  const project = sceneToProject(createProject('roof-divider', 'Roof divider'), scene);
  const restored = projectToScene(deserializeProject(serializeProject(project)));
  assert.ok(restored); assert.equal(restored.wardrobes[0]!.state.dividers[0]!.roofFit, true);
  commands.setDividerHeight(0, 80); assert.equal(state.dividers[0]!.roofFit, false);
  commands.moveDividerTo(0, 50); assert.equal(state.dividers[0]!.roofFit, false);
  assert.equal(state.dividers[0]!.y1! - state.dividers[0]!.y0!, 80);
});

test('dividers below a shelf stop at its underside and fill the roof after moving into open space', () => {
  const { state, commands } = fixture();
  state.dividers.push({ i: 0, orientation: 'horizontal', x0: 0, x1: 196.4, y: 70 });
  state.space = { i: 0, x: 35, y: 30 }; commands.addSpaceDivider();
  const divider = state.dividers[1]!;
  assert.equal(divider.roofFit, false); assert.equal(divider.y1, 70 - PANEL / 2);
  state.dividers[0]!.x1 = 110; commands.moveDividerTo(1, 150);
  assert.equal(state.dividers[1]!.roofFit, true);
});

test('a divider beside a roof step meets the riser underside without intersecting its board', () => {
  const patches = dividerRoofPatches({ template: 'custom', top: [{ x: 0, y: 230 }, { x: 100, y: 230 },
    { x: 100, y: 140 }, { x: 200, y: 140 }] }, 80, 98.5, 99.5);
  assert.ok(patches.length > 0);
  assert.ok(patches.flat().every(p => Math.abs(p.y - (140 - PANEL)) < .001));
});
