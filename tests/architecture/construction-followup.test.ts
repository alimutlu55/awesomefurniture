import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { makePiece, makeParts } from '../../src/domain/make/make-parts';
import type { Board } from '../../src/domain/drawings/cabinet-boards';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { cuttingList } from '../../src/domain/drawings/cutting-list';
const design = {...createInitialDesign(),w:100,h:220,d:60,n:1,wt:[1],secs:[[]]};
const input = (d=design) => ({pieces:[{id:1,name:'Audit',x:0,y:0,z:0,angle:0,design:d}]});
const exact = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-8,`expected ${b} mm, actual ${a} mm`);
for (const back of ['nailed','grooved'] as const) test(`${back}: back engages real 6 mm machining on all four edges`,()=>{
 const m=makePiece(input({...design,construction:{joints:'confirmat',back}} as typeof design),1)!;
 const b=m.boards.find(b=>b.name==='Back')!, base=m.boards.find(b=>b.name==='Base')!;
 [b.x0,b.x1,b.y0,b.y1,b.z0,b.z1].forEach((v,i)=>exact(v*10,[12,988,92,2188,back==='nailed'?0:6,back==='nailed'?6:12][i]!));
 exact(b.cut.length*10,2096);exact(b.cut.width*10,976);exact(base.z0*10,0);exact(base.cut.width*10,595);
 assert.equal(m.grooves.length,4);
 for(const g of m.grooves) assert.ok(g.hi.every((v,i)=>v>g.lo[i]!),'machining has positive volume');
 const top=m.grooves.find(g=>m.boards[g.board]!.name==='Top')!;
 top.hi.map((v,i)=>(v-top.lo[i]!)*10).forEach((v,i)=>exact(v,[976,6,6][i]!));
 if(back==='grooved') assert.equal(m.fittings.filter(f=>f.kind==='nail').length,0);
 else assert.ok(m.fittings.some(f=>f.kind==='nail'));
});
const board:Board={name:'Shelf',stock:'carcass',x0:0,x1:50,y0:0,y1:1.8,z0:0,z1:40,cut:{length:50,width:40,thickness:1.8},edges:'—'};
test('100.01 and 100.04 mm hole locations are different machining',()=>{
 const holes=[10.001,10.004].map((x,i)=>({board:i,kind:'dowel' as const,at:[x,1.8,10] as [number,number,number],axis:1 as const,sign:-1 as const,d:8,depth:12}));
 assert.equal(makeParts([board,board],design,holes).length,2);
});
test('technical cutting list includes the same drawer-box boards as construction',()=>{
 const d={...design,secs:[[{k:'drawer' as const,h:22}]]},inp=input(d as typeof design),m=makePiece(inp,1)!;
 const rows=cuttingList(placePieces(inp)).flatMap(t=>t.rows);
 assert.equal(rows.reduce((s,r)=>s+Number(r[2]),0),m.boards.length);
 assert.ok(rows.some(r=>r[1]==='Box bottom'));
});

import { hardwareList } from '../../src/domain/drawings/hardware-list';
test('technical hardware includes modeled connectors and nails with identical quantities',()=>{
 const m=makePiece(input(),1)!,rows=hardwareList(placePieces(input())).flatMap(t=>t.rows);
 for(const [kind,label] of [['confirmat','Connector screw'],['nail','Nail']] as const) {
  assert.equal(rows.filter(r=>r[0]===label).reduce((s,r)=>s+Number(r[2]),0),m.buy.filter(b=>b.kind===kind).reduce((s,b)=>s+b.qty,0));
 }
});
test('different back machining keeps parts separate even with identical stock and bores',()=>{
 const machining=(z:number)=>[{outline:[{x:0,y:0},{x:50,y:0},{x:50,y:.6},{x:0,y:.6}],z0:z,z1:z+.6,kind:'groove' as const}];
 assert.equal(makeParts([{...board,machining:machining(0)},{...board,machining:machining(.6)}],design).length,2);
});

import { drillingChecks } from '../../src/domain/make/make-assembly';
test('blind edge bore cannot travel 501 mm through a 500 mm board',()=>{
 const holes=[{board:0,kind:'pilot' as const,at:[0,.9,10] as [number,number,number],axis:0 as const,sign:1 as const,d:5,depth:501}];
 assert.ok(drillingChecks([board],holes).some(f=>f.kind==='breakout'));
});
test('a connector mouth outside its named board is rejected',()=>{
 const holes=[{board:0,kind:'connector' as const,at:[-1,1.8,10] as [number,number,number],axis:1 as const,sign:-1 as const,d:7,depth:0}];
 assert.ok(drillingChecks([board],holes).some(f=>f.kind==='edge'));
});
test('a cup wholly inside the bounding box must still clear the sloped material edge',()=>{
 const door:Board={...board,name:'Door',stock:'door',x1:50,y1:50,z1:1.8,outline:[{x:0,y:0},{x:50,y:0},{x:50,y:20},{x:0,y:50}],cut:{length:50,width:50,thickness:1.8}};
 const holes=[{board:0,kind:'cup' as const,at:[45,22,0] as [number,number,number],axis:2 as const,sign:1 as const,d:35,depth:13}];
 assert.ok(drillingChecks([door],holes).some(f=>f.kind==='edge'));
});

import { cutLayout, STOCK } from '../../src/domain/make/make-cut-layout';
test('1 mm banding: cut layout and cut schedule use the same 498 × 398 mm blank',()=>{
 const p=makeParts([{...board,edges:'L2 W2'}],design);
 const placed=cutLayout(p,STOCK,1).sheets[0]!.parts[0]!;
 exact(placed.l,498);exact(placed.w,398);
});
test('technical cut sizes preserve fractional millimetres for each complete construction part',()=>{
 const d={...design,secs:[[{k:'drawer' as const,h:22.15}]]},inp=input(d as typeof design),m=makePiece(inp,1)!;
 const rows=cuttingList(placePieces(inp)).flatMap(t=>t.rows);
 assert.equal(rows.length,m.parts.length);
 rows.forEach((r,i)=>{const p=m.parts[i]!;exact(Number(r[3]),p.cut.length*10);exact(Number(r[4]),p.cut.width*10);exact(Number(r[5]),p.cut.thickness*10);assert.equal(Number(r[2]),p.boards.length);});
});

test('380 mm grooved wardrobe: 300 mm runners leave real rear clearance behind the inner front',()=>{
 const d={...design,d:38,secs:[[{k:'drawer' as const,h:22}]],construction:{joints:'confirmat' as const,back:'grooved' as const}},m=makePiece(input(d as typeof design),1)!;
 const sides=m.boards.filter(b=>b.name==='Box side'),back=m.boards.find(b=>b.name==='Box back')!;assert.equal(sides.length,2);
 // The box is as deep as its runners: the sides from the back, which is as wide as the box, to the front.
 for(const b of sides){exact((b.z1-back.z0)*10,300);exact((b.z0-back.z1)*10,0);}
 assert.ok(back.z0*10>=22);
 assert.equal(m.buy.find(b=>b.kind==='runner')!.size,'300');
});

import { constructionCases } from './construction-cases';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { boreMaterial } from '../../src/domain/make/bore-material';
for(const [name,d] of constructionCases) for(const back of ['nailed','grooved'] as const) for(const joints of JOINT_SYSTEMS) test(`material matrix: ${name}/${back}/${joints}`,()=>{
 const m=makePiece({pieces:[{id:1,name,x:0,y:0,z:0,angle:0,design:{...d,construction:{back,joints}}}]},1);
 if(!m)return;
 for(const h of m.holes) assert.deepEqual(boreMaterial(m.boards[h.board]!,h),[],`${m.boards[h.board]!.name} ${h.kind} at ${h.at.map(v=>v*10)} mm`);
 assert.equal(m.parts.reduce((n,p)=>n+p.boards.length,0),m.boards.length);
});

import { partOperations } from '../../src/domain/make/part-operations';
import { cutListCsv } from '../../src/presentation/make/make-export';
test('machining export preserves local millimetre volumes and full drill axes',()=>{
 const m=makePiece(input({...design,construction:{joints:'confirmat',back:'grooved'}} as typeof design),1)!;
 const p=m.parts.find(p=>p.name==='Top')!,ops=partOperations(m,p);
 assert.deepEqual(ops.machining,[{kind:'groove',outline:[[12,0],[988,0],[988,6],[12,6]],z:[6,12]}]);
 const h=m.holes.find(h=>h.board===p.ids[0])!;
 const b=p.boards[0]!;
 assert.deepEqual(ops.holes[0],{kind:h.kind,at:h.at.map((v,i)=>Number(((v-[b.x0,b.y0,b.z0][i]!)*10).toPrecision(12))),axis:h.axis,sign:h.sign,diameter:h.d,depth:h.depth});
 const csv=cutListCsv(m,()=>'',0);
 assert.ok(csv.includes('Local machining mm'));
 assert.ok(csv.includes(JSON.stringify(ops).replace(/"/g,'""')));
});

test('an 8 mm edge bore centred 1 mm from the face breaks out by 3 mm',()=>{
 const findings=boreMaterial(board,{board:0,kind:'dowel',at:[0,.1,10],axis:0,sign:1,d:8,depth:25});
 assert.deepEqual(findings,[{kind:'edge',gap:-3}]);
});

import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
test('a 100 mm front-to-back roof difference cannot be released as complete construction',()=>{
 const d={...design,shape:{template:'custom' as const,top:[{x:0,y:220},{x:100,y:220}],back:[210,210]}};
 const v=validateForManufacture(input(d as typeof design));
 assert.equal(v.ready,false);
 const f=v.findings.find(f=>f.id.startsWith('compound-roof:'))!;
 assert.equal(f.severity,'critical');assert.equal(f.measured,100);assert.equal(f.limit,0);
});
