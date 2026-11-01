import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { cabinetBoards } from '../../src/domain/drawings/cabinet-boards';
import { bandedEdges, cutWithBand, makePiece } from '../../src/domain/make/make-parts';
import { apartOffset, partMeasures, pieceMeasures, thinAxis } from '../../src/domain/make/make-measures';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';

// A two-bay wardrobe with drawers and shelves in one bay, a long hang under a shelf in the other, and hinged doors.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const piece = (design: EditorDesign) => makePiece({ pieces: [{ id: 7, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] }, 7)!;

test('every board of the piece is in exactly one numbered part, numbered 1, 2, 3… in build order', () => {
  const mp = piece(wardrobe), boards = cabinetBoards(wardrobe);
  assert.deepEqual(mp.parts.map(p => p.n), mp.parts.map((_, i) => i + 1));
  // The cutting list's boards, then the drawer boxes Make adds for the runners.
  assert.deepEqual(mp.boards.slice(0, boards.length), boards);
  assert.ok(mp.boards.slice(boards.length).every(b => b.note === 'drawer box'));
  assert.equal(mp.parts.reduce((s, p) => s + p.boards.length, 0), mp.boards.length);
  assert.equal(mp.parts[0]!.name, boards[0]!.name);
  const mm = (c: { length: number; width: number; thickness: number }) => [c.length, c.width, c.thickness].map(v => Math.round(v * 10));
  for (const p of mp.parts) for (const b of p.boards) assert.deepEqual(mm(b.cut), mm(p.cut), `part ${p.n} groups boards of one size`);
});

test('identical boards are one part counted together; the two sides of a plain wardrobe are one part of two', () => {
  const sides = piece(createInitialDesign()).parts.filter(p => p.name === 'Side');
  assert.equal(sides.length, 1);
  assert.equal(sides[0]!.boards.length, 2);
});

test('each part says which decor it is cut from', () => {
  for (const p of piece(wardrobe).parts) assert.ok(p.decorId.length > 0, p.name);
});

test('edge banding comes off the cut size on the banded edges only', () => {
  assert.deepEqual(bandedEdges('L2 W2'), { long: 2, short: 2 });
  assert.deepEqual(bandedEdges('L1'), { long: 1, short: 0 });
  assert.deepEqual(bandedEdges('—'), { long: 0, short: 0 });
  const cut = { length: 211.8, width: 49.8, thickness: 1.6 };
  assert.deepEqual(cutWithBand({ cut, edges: 'L2 W2' }, 1), { length: 211.6, width: 49.6, thickness: 1.6 });
  assert.deepEqual(cutWithBand({ cut, edges: 'L1' }, 2), { length: 211.8, width: 49.6, thickness: 1.6 });
  assert.deepEqual(cutWithBand({ cut, edges: 'L1' }, 0), cut);
});

test('the piece is measured overall first: width, height and depth are rank 1', () => {
  const ranks = pieceMeasures(piece(wardrobe)).filter(m => m.rank === 1).map(m => Math.round(m.length * 10) / 10);
  for (const size of [100, 220, 60]) assert.ok(ranks.includes(size), `rank 1 has ${size}`);
});

test('bay widths and the boards between them add up to the width, measured face to face', () => {
  const mp = piece(wardrobe), boards = mp.parts.flatMap(p => p.boards);
  const posts = boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'x' && b.y1 - b.y0 > 66);
  const bays = pieceMeasures(mp).filter(m => m.rank === 2 && m.a[1] === m.b[1] && m.a[2] === m.b[2] && m.a[0] !== m.b[0] && m.part === undefined);
  const total = bays.reduce((s, m) => s + m.length, 0) + posts.reduce((s, b) => s + b.x1 - b.x0, 0);
  assert.equal(Math.round(total * 10) / 10, 100);
});

test('clear heights up a bay never run through a board', () => {
  const mp = piece(wardrobe), boards = mp.parts.flatMap(p => p.boards);
  for (const m of pieceMeasures(mp).filter(m => m.rank === 2 && m.a[0] === m.b[0] && m.a[1] !== m.b[1] && m.part === undefined)) {
    const [y0, y1] = [m.a[1], m.b[1]], x = m.a[0];
    const crossed = boards.filter(b => thinAxis(b) === 'y' && b.x0 <= x && b.x1 >= x && b.y0 > y0 + .01 && b.y1 < y1 - .01 && b.stock !== 'door' && b.stock !== 'front');
    assert.equal(crossed.length, 0, `${y0}–${y1} crosses ${crossed.map(b => b.name)}`);
  }
});

test('every front is measured, and its measurements say which front they belong to', () => {
  const mp = piece(wardrobe), fronts = mp.parts.filter(p => p.stock === 'door' || p.stock === 'front');
  assert.ok(fronts.length > 0);
  for (const p of fronts) assert.equal(pieceMeasures(mp).filter(m => m.part === p.n).length, 2, p.name);
});

test('a picked part is measured along its own length, width and thickness', () => {
  for (const part of piece(wardrobe).parts) {
    const lengths = partMeasures(part).map(m => Math.round(m.length * 10) / 10);
    for (const size of [part.cut.length, part.cut.width, part.cut.thickness]) assert.ok(lengths.includes(Math.round(size * 10) / 10), `${part.name} ${size}`);
  }
});

test('taken apart, the sides go opposite ways, the back goes behind, fronts come forward and the top goes up', () => {
  const mp = piece(wardrobe), boards = mp.parts.flatMap(p => p.boards), top = Math.max(...boards.map(b => b.y1));
  const of = (name: string) => boards.filter(b => b.name === name).map(b => apartOffset(b, mp.size, top));
  const sides = of('Side');
  assert.ok(sides[0]![0] < 0 && sides[1]![0] > 0);
  assert.ok(of('Back')[0]![2] < 0);
  assert.ok(of('Door').every(o => o[2] > 0));
  assert.ok(of('Top')[0]![1] > 0);
});

test('a kitchen unit and a sloped wardrobe are taken apart too', () => {
  const kitchen = piece(createKitchenDesign('base'));
  assert.ok(kitchen.parts.length > 3);
  assert.ok(pieceMeasures(kitchen).some(m => m.rank === 1));
  const sloped = piece({ ...wardrobe, shape: { template: 'sloped', top: [{ x: 0, y: 220 }, { x: 100, y: 160 }] } as EditorDesign['shape'] });
  assert.ok(sloped.parts.some(p => p.boards.some(b => b.outline)));
  assert.ok(sloped.parts.length > 3);
});

// The marks: drawn over the editor's view in screen pixels, every label clear of every other.
import { marksSvg, type Projector } from '../../src/presentation/make/make-marks';
import { partSheetSvg } from '../../src/presentation/make/make-sheet';

const text = (cm: number) => String(Math.round(cm * 10) / 10);
/** A plain view from the front and a little to the side and above, 3 px per centimetre, as a camera would give. */
const camera: Projector = p => [80 + p[0] * 3 + p[2] * 1.1, 760 - p[1] * 3 + p[2] * .9];
const marksState = { measures: true, numbers: false, apart: 0, solidFronts: true, selected: null as number | null };
const labels = (svg: string) => [...svg.matchAll(/<rect class="make-tag" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
  .map(m => [Number(m[1]), Number(m[2]), Number(m[1]) + Number(m[3]), Number(m[2]) + Number(m[4])] as const);

test('the piece is measured overall on screen: its width, height and depth are written', () => {
  const svg = marksSvg(piece(wardrobe), marksState, camera, () => [0, 0, 0], text, { w: 900, h: 900 });
  for (const size of ['100', '220', '60']) assert.ok(svg.includes(`>${size}</text>`), size);
});

test('no two labels overlap, for the whole piece, for every part picked, and taken apart', () => {
  const mp = piece(wardrobe);
  for (const state of [marksState, { ...marksState, apart: 1 }, ...mp.parts.map(p => ({ ...marksState, selected: p.n }))]) {
    const boxes = labels(marksSvg(mp, state, camera, () => [0, 0, 0], text, { w: 900, h: 900 }));
    assert.ok(boxes.length > 0);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      assert.ok(!(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]), `labels ${i} and ${j} overlap (part ${state.selected})`);
    }
  }
});

test('a point behind the camera is left out rather than drawn wrongly', () => {
  const behind: Projector = p => p[0] > 50 ? false : [p[0], p[1]];
  assert.doesNotThrow(() => marksSvg(piece(wardrobe), marksState, behind, () => [0, 0, 0], text, { w: 900, h: 900 }));
});

test('a part sheet gives the finished size and the cut size with the banding taken off', () => {
  const door = piece(wardrobe).parts.find(p => p.name === 'Door')!, svg = partSheetSvg(door, text, 'Oak', 1);
  assert.ok(svg.includes(`${text(door.cut.length)} × ${text(door.cut.width)} × ${text(door.cut.thickness)}`));
  assert.ok(svg.includes(`✂ ${text(door.cut.length - .2)} × ${text(door.cut.width - .2)}`));
});
