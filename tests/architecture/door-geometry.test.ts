import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabinetDoorAreas } from '../../src/domain/wardrobe/door-layout';
import { PANEL, PLINTH } from '../../src/domain/wardrobe/catalog.js';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** Door leaves: where their edges fall on the carcass, for every overlay and reveal. Centimetres. */

const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);
function doors(change: Partial<EditorState> = {}) {
  const state = createEditorState();
  Object.assign(state, { doors: 'hinged', dividers: [] }, change);
  return { state, areas: cabinetDoorAreas(state, createWardrobeGeometry(() => state).widths()) };
}

test('full overlay: leaves cover both outer sides and meet on the partitions\' centre lines', () => {
  const { state, areas } = doors({ w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1] });
  const [a, b] = areas, bay = (200 - 3 * PANEL) / 2;
  close(a!.x0, .1, 'left edge half a reveal inside the left face');
  close(b!.x1, state.w - .1, 'right edge half a reveal inside the right face');
  close(a!.x1, PANEL + bay + PANEL / 2 - .1, 'left leaf stops half a reveal short of the partition\'s centre');
  close(b!.x0, PANEL + bay + PANEL / 2 + .1, 'right leaf starts half a reveal past it');
  close(a!.x1 - a!.x0, b!.x1 - b!.x0, 'equal bays get equal leaves');
  close(a!.y0, PLINTH + .2, 'one reveal above the plinth');
});

import { doorFit, doorTop, fittingDepthOf } from '../../src/domain/wardrobe/door-layout';
import { DOOR } from '../../src/domain/wardrobe/carcass';
import { piecefronts } from '../../src/domain/drawings/fronts';
import { cuttingList } from '../../src/domain/drawings/cutting-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { pieceBoards } from '../../src/domain/drawings/unit-detail';
import { makePiece } from '../../src/domain/make/make-parts';
import { constructionDetails } from '../../src/domain/drawings/construction-details';
import type { DesignFronts } from '../../src/domain/wardrobe/front-styles';

const twoBays = (fronts?: DesignFronts) => doors({ w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1], ...(fronts ? { fronts } : {}) });
const bay = (200 - 3 * PANEL) / 2, partition = PANEL + bay + PANEL / 2;

test('default fronts: the leaves are where they were (slab, full overlay, 2 mm), to 0.1 mm', () => {
  const plain = twoBays(), explicit = twoBays({ style: 'slab', overlay: 'full', reveal: 2 });
  assert.deepEqual(explicit.areas, plain.areas);
  const [a, b] = plain.areas;
  for (const [got, want, what] of [[a!.x0, .1, 'left'], [a!.x1, partition - .1, 'seam'], [b!.x0, partition + .1, 'seam'], [b!.x1, 199.9, 'right'], [a!.y0, PLINTH + .2, 'bottom']] as const)
    assert.ok(Math.abs(got - want) < .01, `${what}: ${got} ≠ ${want}`);
  const fit = doorFit(plain.state);
  assert.deepEqual({ ...fit }, { reveal: .2, inset: false, showing: 0, standoff: DOOR.standoff, inside: 0 });
  close(doorTop(plain.state, 10, 20)[0]!.y, plain.state.h - .2, 'one reveal under the top');
});

test('a 3 mm reveal widens every gap', () => {
  const { state, areas: [a, b] } = twoBays({ reveal: 3 });
  close(a!.x0, .15, 'half a reveal inside the left face');
  close(b!.x1, 200 - .15, 'and the right');
  close(b!.x0 - a!.x1, .3, 'one reveal between leaves');
  close(a!.y0, PLINTH + .3, 'one reveal above the plinth');
  close(doorTop(state, 10, 20)[0]!.y, state.h - .3, 'one reveal under the top');
});

test('half overlay covers half of each side board', () => {
  const { areas: [a, b] } = twoBays({ overlay: 'half' });
  close(a!.x0, PANEL / 2 + .1, 'half the left side shows');
  close(b!.x1, 200 - PANEL / 2 - .1, 'half the right side shows');
  close(b!.x0 - a!.x1, .2, 'leaves still meet on the partition');
});

test('inset leaves sit inside the carcass faces, flush with its front, and the inside stops behind them', () => {
  const { state, areas: [a, b] } = twoBays({ overlay: 'inset', reveal: 3 });
  close(a!.x0, PANEL + .3, 'a reveal from the left side\'s inner face');
  close(a!.x1, PANEL + bay - .3, 'a reveal short of the partition');
  close(b!.x0, PANEL + bay + PANEL + .3, 'a reveal past it');
  close(b!.x1, 200 - PANEL - .3, 'a reveal from the right side');
  close(a!.y0, PLINTH + PANEL + .3, 'a reveal above the base board');
  close(doorTop(state, a!.x0, a!.x1)[0]!.y, state.h - PANEL - .3, 'a reveal under the top board');
  const fit = doorFit(state), t = 1.8;
  close(fit.standoff, -t / 2, 'its face is flush with the carcass front');
  close(fittingDepthOf(state).z1, state.d - 1.4 - t, 'fittings stop as far behind the door as they stop behind the front');
});

/** Door leaves as each consumer has them: piecefronts, the cut boards and the cutting list (mm), and Make's parts. */
function leafSizes(state: ReturnType<typeof doors>['state']) {
  const input = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: state }] }, pieces = placePieces(input);
  const fronts = piecefronts(state).fronts.filter(f => f.name === 'Door').map(f => Math.round((f.x1 - f.x0) * 10));
  const boards = pieceBoards(pieces[0]!, pieces).filter(b => b.stock === 'door');
  const cut = boards.map(b => Math.round((b.x1 - b.x0) * 10));
  const list = cuttingList(pieces).flatMap(t => t.rows).filter(r => r[1] === 'Door').flatMap(r => Array(Number(r[2])).fill([Number(r[3]), Number(r[4])]));
  const make = makePiece(input, 1)!.parts.filter(p => p.stock === 'door').flatMap(p => p.boards.map(() => [Math.round(p.cut.length * 10), Math.round(p.cut.width * 10)]));
  return { fronts, cut, list, make, boards };
}

test('reveal and overlay sizes agree in fronts, the cutting list and Make', () => {
  for (const fronts of [undefined, { reveal: 3 }, { overlay: 'half' }, { overlay: 'inset', reveal: 4 }] as (DesignFronts | undefined)[]) {
    const { state } = twoBays(fronts), sizes = leafSizes(state), what = JSON.stringify(fronts ?? 'default');
    assert.equal(sizes.fronts.length, 2, what);
    assert.deepEqual(sizes.cut, sizes.fronts, what + ': cut boards');
    const widths = (rows: number[][]) => rows.map(r => Math.min(...r)).sort();
    assert.deepEqual(widths(sizes.list), [...sizes.fronts].sort(), what + ': cutting list');
    assert.deepEqual(widths(sizes.make), [...sizes.fronts].sort(), what + ': Make');
  }
  const inset = leafSizes(twoBays({ overlay: 'inset', reveal: 3 }).state);
  assert.deepEqual(inset.fronts, [Math.round((bay - .6) * 10), Math.round((bay - .6) * 10)], 'inset leaves are the bay less a reveal each side');
});

test('inset doors close: no shelf, fitting board or drawer front reaches the door', () => {
  const { state } = twoBays({ overlay: 'inset' });
  state.secs[0] = [{ k: 'drawer', h: 22 }, { k: 'shelf', h: 30 }] as never;
  const pieces = placePieces({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: state }] });
  const boards = pieceBoards(pieces[0]!, pieces), door = boards.find(b => b.stock === 'door')!;
  for (const b of boards.filter(b => b.stock !== 'door' && b.name !== 'Side' && b.name !== 'Partition' && b.name !== 'Top' && b.name !== 'Base'))
    assert.ok(b.z1 <= door.z0 - .3 + 1e-9, `${b.name} reaches ${b.z1}, the door's back is at ${door.z0}`);
});

test('D4 draws the chosen overlay and reveal', () => {
  const titles = (fronts?: DesignFronts) => constructionDetails(placePieces({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: twoBays(fronts).state }] }))
    .flat().map(v => v.title).filter(t => t.startsWith('D4'));
  assert.deepEqual(titles(), ['D4 Shelf and door · 18mm · Full overlay, 2 mm reveal']);
  assert.deepEqual(titles({ overlay: 'inset', reveal: 3 }), ['D4 Shelf and door · 18mm · Inset, 3 mm reveal']);
});
