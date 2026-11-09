import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { makePiece, type MakePiece } from '../../src/domain/make/make-parts';
import { connectorStations, findJoints, hi, isTilted, lo } from '../../src/domain/make/make-joints';
import { drillingChecks, flatHoles } from '../../src/domain/make/make-assembly';
import { constructionOf, JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { thinAxis } from '../../src/domain/make/make-measures';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// A two-bay wardrobe with drawers and shelves in one bay, a long hang in the other, and hinged doors; and kitchen units.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const designs: Record<string, EditorDesign> = {
  wardrobe, plain: createInitialDesign(), base: createKitchenDesign('base'), upper: createKitchenDesign('upper'), tall: createKitchenDesign('tall'),
  drawers: createKitchenDesign('base', 'drawers'),
  // Fixed shelves level either side of the partition: joined to it from both faces at the same heights.
  level: { ...wardrobe, secs: [[{ k: 'shelf', h: 40 }, { k: 'shelf', h: 40 }], [{ k: 'shelf', h: 40 }, { k: 'shelf', h: 40 }]] },
  sloped: { ...wardrobe, shape: { template: 'sloped', top: [{ x: 0, y: 220 }, { x: 100, y: 160 }] } as EditorDesign['shape'] },
};
const input = (design: EditorDesign, y = 0) => ({ pieces: [{ id: 7, name: 'W', x: 0, y, z: 0, angle: 0, design }] });
const make = (design: EditorDesign, y = 0) => makePiece(input(design, y), 7)!;
const qty = (mp: MakePiece, kind: string) => mp.buy.filter(b => b.kind === kind).reduce((s, b) => s + b.qty, 0);
/** The drawing set's hardware list for the same piece, by the words its lines start with. */
const listed = (design: EditorDesign, item: RegExp, y = 0) => hardwareList(placePieces(input(design, y))).flatMap(t => t.rows)
  .filter(r => item.test(r[0]!)).reduce((s, r) => s + Number(r[2]), 0);

test('every carcass board is joined to another; sides meet the top and the base edge to face', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), joints = findJoints(mp.boards);
    mp.boards.forEach((b, i) => {
      if (b.stock !== 'carcass' || b.note === 'adjustable' || isTilted(b)) return;
      assert.ok(joints.some(j => j.face === i || j.edge === i), `${name}: ${b.name} is joined`);
    });
    const side = mp.boards.findIndex(b => b.name === 'Side'), top = mp.boards.findIndex(b => b.name === 'Top');
    if (side >= 0 && top >= 0 && !isTilted(mp.boards[top]!)) assert.ok(joints.some(j => (j.face === side && j.edge === top) || (j.face === top && j.edge === side)), name);
  }
});

test('connectors stand 5 cm in from each end and no more than 30 cm apart', () => {
  for (const length of [10, 30, 56, 100, 213]) {
    const s = connectorStations(length);
    if (length >= 12) { assert.equal(s[0], 5); assert.ok(Math.abs(s.at(-1)! - (length - 5)) < 1e-9); }
    s.slice(1).forEach((x, i) => assert.ok(x - s[i]! <= 30 + 1e-9));
  }
});

test('hinges, runners, rails, shelf pins and handles are counted as the drawing set counts them', () => {
  for (const [name, design] of Object.entries(designs)) {
    const y = name === 'upper' ? 142 : 0, mp = make(design, y);
    // Under a slope a door's hinges go only as high as the upright it hangs from.
    assert.equal(qty(mp, 'hinge'), listed(design, /hinge/i, y), `${name}: hinges`);
    assert.equal(qty(mp, 'plate'), qty(mp, 'hinge'), `${name}: a plate for every hinge`);
    assert.equal(qty(mp, 'runner'), listed(design, /^Drawer runners/, y), `${name}: runner pairs`);
    assert.equal(qty(mp, 'rail'), listed(design, /^Hanging rail/, y), `${name}: rails`);
    assert.equal(qty(mp, 'pin'), listed(design, /^Shelf support/, y), `${name}: shelf pins`);
    assert.equal(qty(mp, 'handle'), listed(design, /^Handle/, y), `${name}: handles`);
    assert.equal(qty(mp, 'leg'), listed(design, /^Adjustable leg/, y), `${name}: legs`);
    assert.equal(qty(mp, 'hanger'), listed(design, /^Cabinet hanger/, y), `${name}: hangers`);
    assert.equal(qty(mp, 'bracket'), listed(design, /^Wall fixing bracket/, y), `${name}: wall brackets`);
  }
});

test('nothing drilled runs into anything else, for every joint system', () => {
  for (const joints of JOINT_SYSTEMS) for (const [name, design] of Object.entries(designs)) {
    const mp = make({ ...design, construction: { joints, back: 'nailed' } });
    assert.deepEqual(drillingChecks(mp.boards, mp.holes), [], `${name} with ${joints}`);
    assert.deepEqual(mp.findings, []);
  }
});

test('the checks find holes running into each other, near an edge, or through the far face', () => {
  const board = { name: 'Shelf', stock: 'carcass' as const, x0: 0, x1: 50, y0: 0, y1: 1.8, z0: 0, z1: 40, cut: { length: 50, width: 40, thickness: 1.8 }, edges: 'L1' };
  const hole = (x: number, z: number, d: number, depth: number) => ({ board: 0, kind: 'dowel' as const, at: [x, 1.8, z] as [number, number, number], axis: 1 as const, sign: -1 as const, d, depth });
  const kinds = (holes: ReturnType<typeof hole>[]) => drillingChecks([board], holes).map(f => f.kind);
  assert.deepEqual(kinds([hole(10, 10, 8, 12), hole(10.5, 10, 8, 12)]), ['clash']);
  assert.deepEqual(kinds([hole(.3, 10, 8, 12)]), ['edge']);
  assert.deepEqual(kinds([hole(10, 10, 8, 17)]), ['breakout']);
  assert.deepEqual(kinds([hole(10, 10, 8, 12), hole(20, 10, 8, 12)]), []);
});

test('drawer boxes sit between the uprights, clear for their runners, behind their fronts and inside the carcass', () => {
  for (const name of ['wardrobe', 'drawers']) {
    const mp = make(designs[name]!), sides = mp.boards.filter(b => b.name === 'Box side');
    assert.ok(sides.length >= 2 && sides.length % 2 === 0, name);
    const carcass = mp.boards.filter(b => b.stock === 'carcass' && b.note !== 'drawer box' && b.note !== 'adjustable');
    for (const box of mp.boards.filter(b => b.note === 'drawer box')) for (const c of carcass) {
      const overlap = [0, 1, 2].every(a => Math.min(hi(box)[a]!, hi(c)[a]!) - Math.max(lo(box)[a]!, lo(c)[a]!) > .01);
      assert.ok(!overlap, `${name}: ${box.name} clear of ${c.name}`);
    }
    for (const s of sides) {
      const gap = Math.min(...carcass.filter(c => thinAxis(c) === 'x' && c.y0 <= s.y0 && c.y1 >= s.y1)
        .map(c => Math.min(Math.abs(s.x0 - c.x1), Math.abs(c.x0 - s.x1))));
      assert.ok(Math.abs(gap - 1.25) < .01, `${name}: 12.5 mm for the runner (${gap})`);
    }
  }
});

test('handed boards are separate parts; boards drilled alike once turned are one part', () => {
  const mp = make(wardrobe);
  assert.equal(mp.parts.filter(p => p.name === 'Side').length, 2, 'a left and a right side');
  // A drawer side has its bottom's groove at its lower edge and its cams on its inner face: a left and a right side,
  // each one part for every drawer of the size.
  const sides = mp.parts.filter(p => p.name === 'Box side');
  assert.equal(sides.length, 2, 'a left and a right drawer side');
  assert.ok(sides.every(p => p.boards.length === mp.drawers.length));
  for (const p of mp.parts) assert.deepEqual(p.ids.map(i => mp.boards[i]), p.boards);
  assert.equal(mp.parts.reduce((s, p) => s + p.ids.length, 0), mp.boards.length);
});

test('assembly steps take every board once, the carcass before the inside and the fronts last', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), seen = mp.steps.flatMap(s => s.boards).sort((a, b) => a - b);
    assert.deepEqual(seen, mp.boards.map((_, i) => i), name);
    assert.equal(mp.steps.reduce((s, st) => s + st.fittings.reduce((t, f) => t + f.qty, 0), 0), mp.fittings.length, `${name}: every fitting in a step`);
    const at = (pred: (b: MakePiece['boards'][number]) => boolean) => mp.steps.findIndex(s => s.boards.some(i => pred(mp.boards[i]!)));
    assert.ok(at(b => b.name === 'Side') < at(b => b.name === 'Top'), `${name}: sides before the top`);
    // The fronts, then the doors in their own chapter: nothing else comes after them. A wardrobe drawer's own front is
    // its box front, built with the box (drawer-box.ts).
    const boxFronts = new Set(mp.drawers.filter(d => d.applied === null).map(d => d.front));
    const fronts = mp.steps.findIndex(s => s.boards.some(i => (mp.boards[i]!.stock === 'door' || mp.boards[i]!.stock === 'front') && !boxFronts.has(i)));
    if (fronts >= 0) assert.ok(mp.steps.slice(fronts + 1).every(s => s.boards.every(i => mp.boards[i]!.stock === 'door')), `${name}: fronts, then doors, last`);
    const doors = at(b => b.stock === 'door');
    if (doors >= 0) assert.ok(mp.steps.slice(doors + 1).every(s => !s.boards.length), `${name}: doors last`);
  }
});

test('the joint system and back fixing change what is drilled, never a board', () => {
  const by = (joints: typeof JOINT_SYSTEMS[number], back: 'nailed' | 'grooved') => make({ ...wardrobe, construction: { joints, back } });
  const confirmat = by('confirmat', 'nailed'), cam = by('cam', 'nailed'), dowel = by('dowel', 'grooved');
  assert.deepEqual(cam.boards, confirmat.boards);
  // Drawer boxes are joined their own way whatever the carcass's joints: count the carcass's.
  const carcass = (m: MakePiece, kind: string) => m.fittings.filter(f => f.kind === kind && !f.purpose?.startsWith('box-')).length;
  // Every joint has its connectors at the same stations whatever joins it: the same number in all three systems.
  const connectors = (m: MakePiece) => carcass(m, 'confirmat') + carcass(m, 'cam') + carcass(m, 'dowel');
  assert.ok(qty(confirmat, 'confirmat') > 0 && carcass(cam, 'cam') > 0 && carcass(dowel, 'dowel') > 0);
  assert.equal(connectors(cam), connectors(confirmat));
  assert.equal(connectors(dowel), connectors(confirmat));
  assert.equal(qty(cam, 'bolt'), qty(cam, 'cam'), 'a bolt for every cam');
  assert.ok(cam.holes.some(h => h.kind === 'cam' && h.d === 15));
  // A joint takes the piece's connector wherever it can be made with it in the build order, and says why where not:
  // a screw whose head would be behind a board already in becomes a dowel, a board with no way onto cams is screwed.
  for (const m of [confirmat, cam, dowel]) {
    assert.equal(m.joints.filter(c => c.stuck).length, 0, 'every joint can be made');
    for (const c of m.joints) assert.equal(c.system !== m.construction.joints, c.instead !== undefined, 'another connector always says why');
  }
  assert.ok(cam.joints.filter(c => c.system === 'cam').length > cam.joints.filter(c => c.system !== 'cam').length, 'cams wherever a board can travel onto them');
  assert.ok(cam.joints.filter(c => c.system !== 'cam').every(c => c.system === 'confirmat' && c.instead === 'captured'));
  assert.ok(confirmat.joints.filter(c => c.system !== 'confirmat').every(c => c.system === 'dowel' && c.access === 'closed'));
  assert.equal(qty(dowel, 'nail'), 0, 'a grooved cabinet back has no nails, and drawer bottoms sit in grooves');
  assert.ok(dowel.grooves.length >= 4, 'the back slides into the boards around it');
  assert.deepEqual(constructionOf({}), { joints: 'confirmat', back: 'nailed' });
  assert.deepEqual(constructionOf({ construction: { joints: 'nope' as never, back: 'grooved' } }), { joints: 'confirmat', back: 'grooved' });
});

test('holes are marked on their board lying flat, inside it', () => {
  const mp = make(wardrobe);
  mp.boards.forEach((b, i) => {
    for (const h of flatHoles(b, mp.holes.filter(x => x.board === i))) {
      assert.ok(h.u >= -.1 && h.u <= b.cut.length * 10 + .1 && h.v >= -.1 && h.v <= b.cut.width * 10 + .1, `${b.name} ${h.kind} at ${h.u}, ${h.v}`);
    }
  });
});

// Saving: the choice is one undo step, written only when it differs from the defaults, and kept by a project round trip.
import { createMakeCommands } from '../../src/application/commands/make-commands';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createProject } from '../../src/domain/project/project';
import type { EditorScene } from '../../src/application/projects/editor-scene';
import { createEditorState } from '../../src/application/projects/editor-state';

test('the joint system and back fixing are one undo step each, saved with the project', () => {
  const scene: EditorScene = { wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state: { ...createEditorState(), ...structuredClone(wardrobe), wt: [1, 1, 1, 1, 1, 1], secs: [...structuredClone(wardrobe.secs), [], [], [], []] } }], activeWardrobe: 1, nextWardrobeId: 2 };
  let checkpoints = 0;
  const commands = createMakeCommands(() => scene, () => { checkpoints++; });
  assert.equal(commands.setConstruction(1, { joints: 'confirmat' }), false, 'the default is no change');
  assert.equal(commands.setConstruction(1, { joints: 'cam' }), true);
  assert.equal(commands.setConstruction(1, { back: 'grooved' }), true);
  assert.equal(checkpoints, 2);
  assert.deepEqual(scene.wardrobes[0]!.state.construction, { joints: 'cam', back: 'grooved' });
  assert.equal(commands.setConstruction(9, { joints: 'dowel' }), false, 'no such piece');
  const restored = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('make', 'Make'), { ...scene, nextWardrobeId: 2 }))))!;
  assert.deepEqual(restored.wardrobes[0]!.state.construction, { joints: 'cam', back: 'grooved' });
  commands.setConstruction(1, { joints: 'confirmat', back: 'nailed' });
  assert.equal(scene.wardrobes[0]!.state.construction, undefined, 'the defaults are not written down');
});

// The cut layout: every board on a stock sheet once, inside its trim, clear of every other by the saw kerf.
import { cutLayout, STOCK } from '../../src/domain/make/make-cut-layout';

test('the cut layout puts every board on a stock sheet once, inside the trim and a kerf apart, grain along the sheet', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), layout = cutLayout(mp.parts);
    const placed = layout.sheets.flatMap(s => s.parts.map(p => p.n)).concat(layout.oversize).sort((a, b) => a - b);
    assert.deepEqual(placed, mp.parts.flatMap(p => p.boards.map(() => p.n)).sort((a, b) => a - b), `${name}: every board once`);
    for (const sheet of layout.sheets) {
      assert.ok(sheet.used > 0 && sheet.used < 1);
      sheet.parts.forEach((a, i) => {
        assert.ok(a.x >= STOCK.trim && a.y >= STOCK.trim && a.x + a.l <= STOCK.length - STOCK.trim && a.y + a.w <= STOCK.width - STOCK.trim, `${name}: part ${a.n} inside`);
        const part = mp.parts.find(p => p.n === a.n)!;
        assert.ok(Math.abs(a.l - (a.turned ? part.cut.width : part.cut.length) * 10) < 1e-8, `${name}: exact length of part ${a.n}`);
        assert.ok(Math.abs(a.w - (a.turned ? part.cut.length : part.cut.width) * 10) < 1e-8, `${name}: exact width of part ${a.n}`);
        assert.equal(Math.round(part.cut.thickness * 10), sheet.thickness, `${name}: part ${a.n} on its own thickness`);
        for (const b of sheet.parts.slice(i + 1)) {
          const apart = a.x + a.l + STOCK.kerf <= b.x || b.x + b.l + STOCK.kerf <= a.x || a.y + a.w + STOCK.kerf <= b.y || b.y + b.w + STOCK.kerf <= a.y;
          assert.ok(apart, `${name}: parts ${a.n} and ${b.n} a kerf apart`);
        }
      });
    }
    assert.ok(layout.band.every(b => b.metres > 0));
  }
  // A grained decor keeps its grain along the sheet; a plain one may turn; a part longer than the sheet is set aside.
  const part = make(wardrobe).parts[0]!, wide = { length: 50, width: 120, thickness: 1.8 };
  assert.equal(cutLayout([{ ...part, decorId: 'egger-h1318-st10', cut: wide }]).sheets[0]!.parts[0]!.turned, false);
  assert.equal(cutLayout([{ ...part, decorId: 'egger-u702-st9', cut: wide }]).sheets[0]!.parts[0]!.turned, true);
  assert.deepEqual(cutLayout([{ ...part, decorId: 'egger-h1318-st10', cut: { length: 300, width: 60, thickness: 1.8 } }]).oversize, [part.n]);
});

// Saving: the drawings as an A3 PDF, the cut list as CSV.
import { cutListCsv, makePdf } from '../../src/presentation/make/make-export';

test('the cut list has a line a part in millimetres and the drawings are one PDF of A3 pages', () => {
  const mp = make(wardrobe), csv = cutListCsv(mp, () => 'Oak, natural', 1).trim().split('\r\n');
  assert.equal(csv.length, mp.parts.length + 1);
  assert.match(csv[0]!, /^Part,Name,Qty,Length mm,Width mm,Thickness mm,Material/);
  const side = mp.parts.find(p => p.name === 'Side')!, row = csv.find(r => r.startsWith(side.n + ',Side,'))!;
  assert.ok(row.includes(',"Oak, natural",'), 'a comma in a value is quoted');
  assert.ok(row.includes(',' + String(Math.round(side.cut.length * 100) / 10) + ','));
  const pdf = new TextDecoder().decode(makePdf(mp, { title: 'Wardrobe', material: () => 'Oak', band: 1, cut: cutLayout(mp.parts) }));
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
  const pages = Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(pdf)![1]);
  assert.equal(pages, Math.ceil(mp.parts.length / 6) + Math.ceil(cutLayout(mp.parts).sheets.length / 2) + 1);
});

test('glass doors hang on clamp hinges: nothing is drilled in them', async () => {
  const { resolveMaterials } = await import('../../src/domain/materials/configured-materials');
  const glassy = { ...wardrobe, materials: { ...resolveMaterials(wardrobe), frontDecorId: 'agc-glass-planibel-grey-float' } } as EditorDesign;
  const mp = make(glassy), doors = mp.boards.map((b, i) => ({ b, i })).filter(({ b }) => b.name === 'Door');
  assert.ok(doors.length > 0);
  assert.ok(!mp.holes.some(h => doors.some(d => d.i === h.board)), 'no holes in the glass');
  assert.equal(qty(mp, 'hinge'), listed(glassy, /hinge/i), 'still as many hinges');
  assert.ok(mp.buy.some(b => b.kind === 'hinge' && b.size === 'glass'));
});
