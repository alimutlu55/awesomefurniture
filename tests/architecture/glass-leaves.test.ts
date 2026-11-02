import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { cuttingList } from '../../src/domain/drawings/cutting-list';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { makePiece } from '../../src/domain/make/make-parts';
import { designerPalettes } from '../../src/domain/materials/designer-palettes';
import { decorCode, getDecor } from '../../src/domain/materials/decor-catalog';
import { frontsProblems } from '../../src/domain/wardrobe/front-styles';
import { hinge } from '../../src/domain/wardrobe/hinges';
import type { EditorScene, EditorState } from '../../src/application/projects/editor-scene';

/** Glass and mirror (P1-16): a front material any style that allows it can use, per leaf, hanging on glass hinges with
 * nothing drilled; designs with glass doors open as they were. */

const MIRROR = 'agc-glass-mirox-silver-mnge';
const scene = (state: EditorState): EditorScene => ({ wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 });
const save = (s: EditorScene) => serializeProject(sceneToProject(createProject('p', 'P'), s));
const input = (design: EditorState): DrawingInput => ({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] });
function wardrobe(change: Partial<EditorState> = {}) {
  const s = createEditorState();
  Object.assign(s, { w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged', secs: [[], [], [], [], [], []] }, change);
  return s;
}

test('designs with glass doors open and save unchanged', () => {
  const glassPalette = designerPalettes.find(p => getDecor(p.materials.frontDecorId).category === 'glass_mirror');
  const states = [wardrobe({ doors: 'glass' }), ...(glassPalette ? [wardrobe({ doors: 'glass', materials: structuredClone(glassPalette.materials) })] : [])];
  for (const state of states) {
    const json = save(scene(state)), back = projectToScene(deserializeProject(json))!.wardrobes[0]!.state;
    assert.equal(back.doors, 'glass');
    assert.equal(save(projectToScene(deserializeProject(json))!), json);
    // Every leaf of a glass-door cabinet is glass: clamp hinges, nothing drilled.
    const rows = hardwareList(placePieces(input(back))).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!));
    assert.deepEqual(rows.map(r => r[0]), [hinge('glass').name]);
    assert.deepEqual(makePiece(input(back), 1)!.holes.filter(h => h.kind === 'cup'), []);
  }
});

test('one mirror leaf among wood ones hangs on glass hinges, alone, and is cut from mirror', () => {
  const s = wardrobe({ fronts: { leaves: { '0.0.0': { decor: MIRROR } } } }), pieces = placePieces(input(s));
  const rows = hardwareList(pieces).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!)).map(r => [r[0], Number(r[2])]);
  assert.deepEqual(rows.sort(), [[hinge('glass').name, 5], [hinge('standard').name, 15]].sort(), 'glass hinges for the mirror leaf only');
  const piece = makePiece(input(s), 1)!, doors = piece.boards.map((b, i) => ({ b, i })).filter(({ b }) => b.stock === 'door');
  const mirror = doors.filter(({ b }) => b.decorId === MIRROR);
  assert.equal(mirror.length, 1);
  assert.ok(Math.abs(mirror[0]!.b.z1 - mirror[0]!.b.z0 - getDecor(MIRROR).thicknessMm / 10) < 1e-9, 'at the mirror\'s thickness');
  assert.deepEqual(piece.holes.filter(h => h.board === mirror[0]!.i), [], 'nothing drilled in the mirror');
  assert.ok(doors.filter(({ i }) => i !== mirror[0]!.i).every(({ i }) => piece.holes.some(h => h.board === i && h.kind === 'cup')), 'the wood leaves keep their cups');
  const cut = cuttingList(pieces).flatMap(t => t.rows).filter(r => r[1] === 'Door' && r[6]!.includes(decorCode(getDecor(MIRROR))));
  assert.equal(cut.length, 1, 'the cutting list lists the mirror leaf in mirror');
});

test('a leaf\'s decor must be a front decor its style allows', () => {
  assert.deepEqual(frontsProblems({ leaves: { '0.0': { decor: MIRROR } } }), []);
  assert.match(frontsProblems({ style: 'shaker', leaves: { '0.0': { decor: MIRROR } } }).join(), /shaker front cannot be made in/);
  assert.match(frontsProblems({ leaves: { '0.0': { decor: 'nope' } } }).join(), /not a front decor/);
});
