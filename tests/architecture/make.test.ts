import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { cabinetBoards } from '../../src/domain/drawings/cabinet-boards';
import { bandedEdges, cutWithBand, makePiece } from '../../src/domain/make/make-parts';
import { apartOffset, partMeasures, pieceMeasures, thinAxis } from '../../src/domain/make/make-measures';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import type { DrawingInput } from '../../src/domain/drawings/room-pieces';
import { alone, goldenWardrobes, welcomeSpaces } from './rule-fixtures';

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

test('every figure shows the length of what it measures, and a shelf\'s height stands beside that shelf', async () => {
  const { partMeasures, pieceMeasures: all } = await import('../../src/domain/make/make-measures');
  const mp = piece({ ...wardrobe, secs: [[{ k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] });
  for (const m of [...all(mp), ...mp.parts.flatMap(p => partMeasures(p))]) assert.ok(Math.abs(m.length - Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1], m.b[2] - m.a[2])) < 1e-9);
  const shelf = mp.parts.filter(p => p.name === 'Shelf').sort((a, b) => b.boards.length - a.boards.length)[0]!;
  assert.ok(shelf.boards.length >= 3, 'several shelves of one part');
  const heights = partMeasures(shelf).filter(m => m.ordinate);
  assert.deepEqual(heights.map(m => m.b[1]).sort((a, b) => a - b), shelf.boards.map(b => b.y0).sort((a, b) => a - b), 'one height for each shelf, to its underside');
  const svg = marksSvg(mp, { ...marksState, selected: shelf.n }, camera, () => [0, 0, 0], text, { w: 900, h: 900 });
  let found = 0;
  for (const m of heights) {
    const label = [...svg.matchAll(/<rect class="make-tag" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/><text[^>]*>([^<]+)<\/text>/g)].find(x => x[5] === text(m.length));
    if (!label) continue;
    found++;
    const mid = Number(label[2]) + Number(label[4]) / 2, at = (camera([m.b[0] + m.offset[0], m.b[1], m.b[2]]) as [number, number])[1];
    assert.ok(Math.abs(mid - at) < 8, `the figure ${label[5]} stands level with its shelf (${mid.toFixed(1)} vs ${at.toFixed(1)})`);
  }
  assert.ok(found >= heights.length - 1, `the heights are written (${found} of ${heights.length})`);
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

test('a column of fronts is measured across once, and every front up its own side', async () => {
  const { pieceMeasures: all } = await import('../../src/domain/make/make-measures');
  const mp = piece({ ...wardrobe, doors: 'none', secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 25 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] });
  const fronts = mp.parts.filter(p => p.stock === 'front'), measures = all(mp).filter(m => m.part !== undefined);
  assert.ok(fronts.length >= 2, 'two drawer fronts of different heights');
  const across = measures.filter(m => m.a[1] === m.b[1]), up = measures.filter(m => m.a[0] === m.b[0]);
  assert.equal(new Set(across.map(m => `${m.a[0]},${m.b[0]}`)).size, across.length, 'one width a column');
  for (const f of fronts) assert.ok(up.some(m => Math.abs(m.length - (f.boards[0]!.y1 - f.boards[0]!.y0)) < 1e-9), `${f.name} ${f.n} has its height`);
});

test('a sloped top, falling or rising, is measured along its slope, through its thickness and up to each end', () => {
  for (const top of [[{ x: 0, y: 220 }, { x: 100, y: 160 }], [{ x: 0, y: 160 }, { x: 100, y: 220 }]]) {
    const mp = piece({ ...wardrobe, doors: 'none', shape: { template: 'sloped', top } as EditorDesign['shape'] }), part = mp.parts.find(p => p.name === 'Top')!, b = part.boards[0]!;
    const lengths = partMeasures(part).map(m => Math.round(m.length * 10) / 10), heights = partMeasures(part).filter(m => m.ordinate).map(m => Math.round(m.b[1] * 10) / 10).sort();
    assert.equal(thinAxis(b), 'y');
    for (const want of [b.cut.length, b.cut.thickness, b.z1 - b.z0]) assert.ok(lengths.includes(Math.round(want * 10) / 10), `${want} among ${lengths}`);
    const ends = [0, 100].map(x => Math.round((x === 0 ? b.outline![0]! : b.outline![1]!).y * 10) / 10).sort();
    assert.deepEqual(heights, ends, 'the underside at each end');
    assert.ok(heights[1]! - heights[0]! > 55, 'its ends at their own heights');
    assert.ok(mp.fittings.filter(f => f.boards.includes(part.ids[0]!)).length >= 9, 'screwed down into the sides and the partition');
  }
});

test('Make moves the editor\'s own camera only through the editor\'s camera controller, never a camera of its own', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = 'src/presentation/make', files = readdirSync(dir).filter(f => /\.ts$/.test(f) && !f.endsWith('.d.ts'));
  for (const f of files) {
    const code = readFileSync(`${dir}/${f}`, 'utf8');
    assert.doesNotMatch(code, /new THREE\.(Perspective|Orthographic)Camera|OrbitControls|TrackballControls/, `${f} makes no camera or controls of its own`);
    // The camera is read (where it looks from), never set: its pose, lens and gestures stay the editor's.
    assert.doesNotMatch(code, /\bcam(era)?\.(position|quaternion|rotation|up)\.(set|copy|add|lerp)|\bcam(era)?\.(fov|near|far|zoom)\s*=|\bcam(era)?\.lookAt\(/, `${f} never moves the camera itself`);
  }
  // Every shot, glide and framing goes through the controller the rest of the editor uses.
  const view = readFileSync(`${dir}/make-view.ts`, 'utf8');
  for (const call of ['cameraTransition', 'cameraSample', 'fittedCamera', 'frameBox', 'frameWardrobe']) assert.match(view, new RegExp(`ports\\.camera\\.${call}\\b`), call);
});

test('a back larger than a stock sheet is split over the partition nearest the middle; each piece fits and is fixed to it', async () => {
  const { STOCK } = await import('../../src/domain/make/make-cut-layout');
  const { cutLayout } = await import('../../src/domain/make/make-cut-layout');
  const wide: EditorDesign = { ...createInitialDesign(), w: 240, h: 230, n: 3, wt: [1, 1, 1] };
  const usable = { l: STOCK.length - 2 * STOCK.trim, w: STOCK.width - 2 * STOCK.trim };
  const backs = cabinetBoards(wide).filter(b => b.stock === 'back');
  assert.equal(backs.length, 2, 'two back parts');
  for (const b of backs) assert.ok(Math.round(b.cut.length * 10) <= usable.l && Math.round(b.cut.width * 10) <= usable.w, JSON.stringify(b.cut));
  const partitions = cabinetBoards(wide).filter(b => b.name === 'Partition'), seam = backs[0]!.x1;
  assert.equal(backs[1]!.x0, seam, 'the pieces meet');
  assert.ok(partitions.some(p => p.x0 < seam && p.x1 > seam), 'over a partition');
  assert.ok(Math.abs(backs[0]!.x0 - 1.8) < .01 && Math.abs(backs[1]!.x1 - 238.2) < .01, 'between the sides');
  for (const back of ['nailed', 'grooved'] as const) {
    const mp = piece({ ...wide, construction: { joints: 'confirmat', back } }), ids = mp.boards.flatMap((b, i) => b.stock === 'back' ? [i] : []);
    const partition = mp.boards.findIndex(b => b.name === 'Partition' && b.x0 < seam && b.x1 > seam);
    if (back === 'nailed') for (const id of ids) assert.ok(mp.fittings.some(f => f.kind === 'nail' && f.boards[0] === id && f.boards[1] === partition), 'each piece nailed to the partition');
    else assert.equal(mp.grooves.filter(g => g.board === partition).length, 2, 'the partition is grooved for both pieces');
  }
  assert.deepEqual(cutLayout(piece(wide).parts).oversize, [], 'the cut layout places both backs');
  assert.equal(cabinetBoards({ ...createInitialDesign(), w: 100 }).filter(b => b.stock === 'back').length, 1, 'a 100 cm wardrobe keeps one back');
});

test('a top, base and plinth rails longer than a sheet are split over partitions too, with a bearer under each rail joint', () => {
  const wide: EditorDesign = { ...createInitialDesign(), w: 320, h: 230, n: 4, wt: [1, 1, 1, 1] };
  const boards = cabinetBoards(wide), named = (name: string) => boards.filter(b => b.name === name);
  const fits = (b: { cut: { length: number } }) => Math.round(b.cut.length * 10) <= 2780;
  for (const name of ['Top', 'Base', 'Back']) {
    assert.equal(named(name).length, 2, name + ' in two');
    assert.ok(named(name).every(fits), name + ' pieces fit the sheet');
  }
  assert.equal(named('Plinth rail').length, 4, 'front and rear rails in two');
  const seam = named('Base')[0]!.x1, partition = named('Partition').find(p => p.x0 < seam && p.x1 > seam)!;
  assert.ok(partition, 'the base joint is under a partition');
  assert.ok(named('Plinth bearer').some(b => b.x0 < seam && b.x1 > seam), 'a bearer under the rail joint');
  assert.equal(named('Plinth bearer').length, 3);
  const mp = piece(wide), base = mp.boards.flatMap((b, i) => b.name === 'Base' ? [i] : []), at = mp.boards.findIndex(b => b.name === 'Partition' && b.x0 === partition.x0);
  for (const id of base) assert.ok(mp.fittings.some(f => f.boards.includes(id) && f.boards.includes(at)), 'the partition is fixed to both base pieces');
  const regular = cabinetBoards({ ...createInitialDesign(), w: 200, n: 2, wt: [1, 1] });
  assert.deepEqual(['Top', 'Base', 'Back', 'Plinth rail', 'Plinth bearer'].map(n => regular.filter(b => b.name === n).length), [1, 1, 1, 2, 2], 'a 2 m wardrobe is unchanged');
});

test('drawers behind hinged doors buy no handles: handles go on the doors only, and the hardware list agrees', async () => {
  const { hardwareList } = await import('../../src/domain/drawings/hardware-list');
  const { placePieces } = await import('../../src/domain/drawings/room-pieces');
  const { innerFrontBehindDoor } = await import('../../src/domain/drawings/fronts');
  const handles = (design: EditorDesign) => piece(design).buy.filter(l => l.kind === 'handle').reduce((s, l) => s + l.qty, 0);
  const listed = (design: EditorDesign) => hardwareList(placePieces({ pieces: [{ id: 7, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] }))
    .flatMap(t => t.rows).filter(r => r[0] === 'Handle').reduce((s, r) => s + Number(r[2]), 0);
  const doors = cabinetBoards(wardrobe).filter(b => b.stock === 'door').length, drawers = cabinetBoards(wardrobe).filter(b => b.name === 'Drawer front');
  assert.equal(doors, 2);
  assert.equal(handles(wardrobe), doors, 'one handle per door, none on the drawers');
  assert.equal(listed(wardrobe), doors, 'the hardware list buys the same');
  assert.ok(drawers.every(b => b.note === 'finger grip'), 'each drawer front behind the doors is drawn with a finger grip');
  assert.equal(innerFrontBehindDoor(wardrobe, { k: 'drawer' }), true);
  const open: EditorDesign = { ...wardrobe, doors: 'none' };
  assert.equal(innerFrontBehindDoor(open, { k: 'drawer' }), false);
  assert.equal(handles(open), 2, 'without doors the drawers keep their handles');
  assert.equal(listed(open), 2);
  assert.ok(cabinetBoards(open).filter(b => b.name === 'Drawer front').every(b => b.note === undefined));
});

// Auto design makes no drilling warnings: the app's own designs pass its own drilling check in Make.
const drillingFindings = (input: DrawingInput) => input.pieces.flatMap(p => (makePiece(input, p.id)?.findings ?? []).map(f => ({ piece: p.name, part: f.board, kind: f.kind, gap: f.gap })));

test('every golden wardrobe opens in Make with no drilling finding', () => {
  for (const [name, design] of goldenWardrobes()) for (const doors of ['none', 'hinged'] as const)
    assert.deepEqual(drillingFindings(alone({ ...design, doors })), [], name + ', doors ' + doors);
});

test('every welcome space opens in Make with no drilling finding', () => {
  for (const [name, input] of welcomeSpaces()) {
    assert.deepEqual(drillingFindings(input), [], name);
    const hinged = { ...input, pieces: input.pieces.map(p => ({ ...p, design: { ...p.design, doors: 'hinged' as const } })) };
    assert.deepEqual(drillingFindings(hinged), [], name + ', hinged doors');
  }
});

test('a runner screw never lands on a shelf connector, in hand-made layouts too', () => {
  // Shelves joined by connectors through a partition, and drawers on runners screwed to the same partition.
  const design: EditorDesign = { ...createInitialDesign(), w: 126, n: 3, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged', secs: [
    [{ k: 'folded', h: 20 }, { k: 'folded', h: 31 }, { k: 'sdrawer', h: 28 }],
    [{ k: 'sdrawer', h: 15 }, { k: 'drawer', h: 27 }, { k: 'drawer', h: 16 }],
    [{ k: 'shelf', h: 13 }, { k: 'shelf', h: 27 }, { k: 'sdrawer', h: 29 }], [], [], []] };
  assert.deepEqual(piece(design).findings.map(f => f.kind + ' ' + f.gap), []);
});
