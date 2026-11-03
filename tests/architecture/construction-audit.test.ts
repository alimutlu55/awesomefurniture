import { constructionCases as cases } from './construction-cases';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { sectionWidths } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { makePiece, makeParts } from '../../src/domain/make/make-parts';
import { cutLayout } from '../../src/domain/make/make-cut-layout';
import { doorTop } from '../../src/domain/wardrobe/door-layout';
import { heightsAt } from '../../src/domain/make/make-measures';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import type { Board } from '../../src/domain/drawings/cabinet-boards';

const make = (design: EditorDesign) => makePiece({ pieces: [{ id: 1, name: 'Audit', x: 0, y: 0, z: 0, angle: 0, design }] }, 1);
// Only arithmetic noise, never manufacturing rounding: 1e-8 mm is far below any physical tolerance.
const exact = (actual: number, expected: number, context: string) => assert.ok(Math.abs(actual - expected) < 1e-8, `${context}: expected ${expected} mm, actual ${actual} mm`);
for (const [name, design] of cases) test(`construction matrix: ${name}`, () => {
  const mp = make(design);
  if (design.unit === 'sink-top' || design.unit === 'hob-top') { assert.equal(mp, null); return; }
  assert.ok(mp);
  if (!['shelf', 'filler', 'end-panel'].includes(design.unit ?? '')) {
    exact(sectionWidths(design).reduce((s, w) => s + w * 10, 0) + (design.n + 1) * 18, design.w * 10, 'bay closure');
  }
  assert.deepEqual(mp.parts.flatMap(p => p.ids).sort((a,b) => a-b), mp.boards.map((_, i) => i));
  for (const b of mp.boards) {
    assert.ok(Object.values(b.cut).every(v => Number.isFinite(v) && v > 0), `${b.name}: positive cut`);
    if (!b.outline) {
      const extents = [(b.x1-b.x0)*10, (b.y1-b.y0)*10, (b.z1-b.z0)*10].sort((a,b) => a-b);
      Object.values(b.cut).map(v => v*10).sort((a,b) => a-b).forEach((v,i) => exact(v, extents[i]!, b.name));
    }
  }
  const layout = cutLayout(mp.parts);
  assert.deepEqual([...layout.sheets.flatMap(s => s.parts.map(p => p.n)), ...layout.oversize].sort((a,b) => a-b), mp.parts.flatMap(p => p.ids.map(() => p.n)).sort((a,b) => a-b));
  for (const sheet of layout.sheets) for (const p of sheet.parts) {
    const cut = mp.parts.find(q => q.n === p.n)!.cut;
    exact(p.l, (p.turned ? cut.width : cut.length)*10, `${name}: cut length`);
    exact(p.w, (p.turned ? cut.length : cut.width)*10, `${name}: cut width`);
    exact(sheet.thickness, cut.thickness*10, `${name}: stock thickness`);
  }
});

test('a 1000 mm sloping wardrobe door retains its roof polygon, not the bounding rectangle', () => {
  const design: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, n: 1, wt: [1], secs: [[]], doors: 'hinged', shape: { template: 'sloped', top: [{x:0,y:220},{x:100,y:160}] } };
  const doors = make(design)!.boards.filter(b => b.stock === 'door');
  assert.ok(doors.length);
  doors.forEach((b,i) => doorTop(design,b.x0,b.x1).forEach((p,j) => exact(p.y*10, [[2197.4,1898.6],[1897.4,1598.6]][i]![j]!, 'literal door roof')));
  for (const b of doors) {
    assert.ok(b.outline, 'sloping door has a machinable outline');
    for (const p of doorTop(design, b.x0, b.x1)) exact(heightsAt(b, p.x)[1]*10, p.y*10, 'door roof');
  }
});
const board: Board = { name:'Shelf', stock:'carcass', x0:0, x1:50, y0:0, y1:1.8, z0:0, z1:40, cut:{length:50,width:40,thickness:1.8}, edges:'—' };
test('parts with 500.1 and 500.4 mm lengths are different parts', () => {
  const boards = [50.01,50.04].map(length => ({...board,x1:length,cut:{...board.cut,length}}));
  assert.equal(makeParts(boards, createInitialDesign()).length, 2);
});
test('blind holes at 10 and 12 mm depth are different machining operations', () => {
  const holes = [10,12].map((depth,i) => ({board:i,kind:'dowel' as const,at:[10,1.8,10] as [number,number,number],axis:1 as const,sign:-1 as const,d:8,depth}));
  assert.equal(makeParts([board,board],createInitialDesign(),holes).length,2);
});

// Exact setout must not put even the mouth of a bore outside the named board.
for (const [name, design] of cases) test(`hole material: ${name}`, () => {
  const mp = make(design);
  if (!mp) return;
  for (const h of mp.holes) {
    const b = mp.boards[h.board]!;
    const [low, high] = heightsAt(b, h.at[0]);
    for (const [v, min, max] of [[h.at[0], b.x0, b.x1], [h.at[1], low, high], [h.at[2], b.z0, b.z1]]) {
      assert.ok(v! >= min! - 1e-9 && v! <= max! + 1e-9, `${name}: ${b.name} ${h.kind}: mouth ${v!*10} mm outside ${min!*10}..${max!*10} mm`);
    }
  }
});

import { partDrilling } from '../../src/presentation/make/make-sheet';
import { flatHoles } from '../../src/domain/make/make-assembly';
test('a shaped door sheet retains every modeled bore at its actual flat coordinates', () => {
  const design: EditorDesign = { ...createInitialDesign(), w:100, h:220, n:1, wt:[1], secs:[[]], doors:'hinged', shape:{template:'sloped',top:[{x:0,y:220},{x:100,y:160}]} };
  const mp = make(design)!;
  for (const part of mp.parts.filter(p => p.stock === 'door')) {
    const holes = mp.holes.filter(h => h.board === part.ids[0]);
    assert.ok(holes.length > 0);
    assert.deepEqual(partDrilling(mp, part).holes, flatHoles(part.boards[0]!, holes));
  }
});

import { plinthOf, fittingDepth, partitionDepth, RAIL_DROP } from '../../src/domain/wardrobe/carcass';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { STOCK } from '../../src/domain/make/make-cut-layout';
for (const [name, design] of cases) test(`carcass and hardware inventory: ${name}`, () => {
  const mp = make(design);
  if (!mp) return;
  for (const b of mp.boards.filter(b => b.name === 'Base')) {
    exact(b.y0*10, plinthOf(design)*10, 'base underside');
    exact(b.y1*10, plinthOf(design)*10+18, 'interior floor');
    exact(b.z0*10,0,'base stock reaches rear; rebate removes back engagement');
    exact((design.d-b.z1)*10,5,'base front setback');
  }
  exact(fittingDepth(design.d).depth*10,design.d*10-20,'fitting depth');
  exact(partitionDepth(design.d).depth*10,design.d*10-11,'partition depth');
  assert.equal(RAIL_DROP*10,60);
  assert.equal(mp.buy.reduce((s,l) => s+l.qty,0),mp.fittings.length);
  assert.deepEqual(mp.steps.flatMap(s => s.boards).sort((a,b) => a-b),mp.boards.map((_,i) => i));
  for (const f of mp.fittings) for (const i of f.boards) assert.ok(mp.boards[i], 'hardware references a board');
  for (const sheet of cutLayout(mp.parts).sheets) for (const [i,a] of sheet.parts.entries()) {
    assert.ok(a.x >= STOCK.trim && a.y >= STOCK.trim && a.x+a.l <= STOCK.length-STOCK.trim && a.y+a.w <= STOCK.width-STOCK.trim);
    for (const b of sheet.parts.slice(i+1)) assert.ok(a.x+a.l+STOCK.kerf <= b.x || b.x+b.l+STOCK.kerf <= a.x || a.y+a.w+STOCK.kerf <= b.y || b.y+b.w+STOCK.kerf <= a.y,'saw kerf');
  }
  for (const joints of JOINT_SYSTEMS) {
    const other = make({...design,construction:{joints,back:'nailed'}})!;
    assert.deepEqual(other.boards,mp.boards,'joint system preserves stock geometry');
    for (const h of other.holes) assert.ok(other.boards[h.board]);
  }
});

for (const [name, design] of cases) test(`wall bracket support: ${name}`, () => {
  const mp = make(design);
  if (!mp) return;
  for (const f of mp.fittings.filter(f => f.kind === 'bracket')) {
    const roof = mp.boards.findIndex(b => b.name === 'Top' && b.x0 <= f.at[0] && b.x1 >= f.at[0]);
    assert.ok(roof >= 0);
    exact(f.at[1]*10,heightsAt(mp.boards[roof]!,f.at[0])[0]*10,'bracket on actual roof underside');
    assert.deepEqual(f.boards,[roof]);
  }
});
