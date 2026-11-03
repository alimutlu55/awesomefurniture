import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { createMakeFittings } from '../../src/presentation/make/make-fittings-3d';
import { assemblyTimeline, playhead, fittedAt } from '../../src/domain/make/make-timeline';
import { drawerBoardOffset } from '../../src/domain/make/drawer-installation';

for(const unit of ['base','tall'] as const) test(`${unit} cargo: waiting mechanisms leave the cabinet stage empty`,()=>{
 const piece=makePiece({pieces:[{id:1,name:'Cargo',x:0,y:0,z:0,angle:0,design:createKitchenDesign(unit,unit==='tall'?'cargo-tall':'cargo')}]},1)!;
 const root=new THREE.Group(), hosts=piece.boards.map(()=>new THREE.Group());
 const rest=(i:number)=>{const b=piece.boards[i]!;return new THREE.Vector3((b.x0+b.x1)/2-piece.size.w/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2-piece.size.d/2);};
 const layer=createMakeFittings(0);layer.build(piece,i=>hosts[i],rest,root);
 const tl=assemblyTimeline(piece),ph=playhead(tl,0);
 layer.only(()=>false,i=>fittedAt(tl,ph,i,piece.fittings[i]!.kind));
 layer.motion(i=>drawerBoardOffset(piece,tl,ph,i));root.updateMatrixWorld(true);
 for(const mesh of root.children.filter(m=>m.visible)) {
  const box=new THREE.Box3().setFromObject(mesh);
  assert.ok(box.min.z>piece.size.d/2,`waiting hardware reaches cabinet depth: ${box.min.z}`);
 }
 layer.dispose();
});

import { cargoFittedAt } from '../../src/domain/make/cargo-installation';
for(const [unit,preset] of [['base','cargo'],['tall','cargo-tall']] as const) test(`${unit}: frame insertion is continuous and baskets are fitted before cabinet insertion`,()=>{
 const piece=makePiece({pieces:[{id:1,name:'Cargo',x:0,y:0,z:0,angle:0,design:createKitchenDesign(unit,preset)}]},1)!;
 const tl=assemblyTimeline(piece),frame=piece.fittings.findIndex(f=>f.size?.startsWith('cargo frame:'));
 const step=tl.steps[tl.itemStep[frame]!]!;
 assert.equal(cargoFittedAt(piece,tl,playhead(tl,step.place[0]),frame),0);
 assert.equal(cargoFittedAt(piece,tl,playhead(tl,(step.place[0]+step.place[1])/2),frame),.5);
 assert.equal(cargoFittedAt(piece,tl,playhead(tl,step.place[1]),frame),1);
 const root=new THREE.Group(),hosts=piece.boards.map(()=>new THREE.Group());
 const rest=(i:number)=>{const b=piece.boards[i]!;return new THREE.Vector3((b.x0+b.x1)/2-piece.size.w/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2-piece.size.d/2);};
 const layer=createMakeFittings(0);layer.build(piece,i=>hosts[i],rest,root);
 const basketStep=tl.steps[piece.steps.findIndex(s=>s.stage==='cargo-baskets')]!;
 for(const interval of [step,basketStep]) {
  let previous=new Map<number,THREE.Vector3>();
  const samples=Math.ceil((interval.end-interval.place[0])/.01);
  for(let k=0;k<=samples;k++){
   const ph=playhead(tl,interval.place[0]+(interval.end-interval.place[0])*k/samples);
   layer.only(()=>false,i=>cargoFittedAt(piece,tl,ph,i));layer.motion(i=>drawerBoardOffset(piece,tl,ph,i));
   const positions=new Map(root.children.filter(m=>m.visible).map(m=>[m.id,m.position.clone()]));
   for(const [id,v] of positions) if(previous.has(id)) assert.ok(v.distanceTo(previous.get(id)!)<2,`time=${ph.t} interval=${interval.place} mesh=${id} delta=${v.distanceTo(previous.get(id)!)} from=${previous.get(id)!.toArray()} to=${v.toArray()}`);
   previous=positions;
  }
 }
 const front=piece.boards.findIndex(b=>b.name==='Cargo front');
 assert.ok(hosts[front]!.children.filter(m=>m instanceof THREE.Group && m.children.length===4).length===piece.fittings.filter(f=>f.size==='cargo front bracket').length,'brackets travel on the door mesh');
 const baskets=piece.fittings.map((f,i)=>f.size?.startsWith('cargo basket:')?i:-1).filter(i=>i>=0);
 assert.ok(baskets.length>=2);
 for(const i of baskets)assert.ok(tl.itemStep[i]!<piece.steps.findIndex(s=>s.stage==='drawers'));
 const runner=piece.fittings.find(f=>f.runner)!;
 for(const id of runner.runner!.fixed)assert.ok(['Base','Top'].includes(piece.boards[id]!.name),'bottom mount and upper guide use horizontal stock');
 layer.dispose();
});

test('loaded chassis inserts from 600 mm ahead to home only along the runner axis',()=>{
 const piece=makePiece({pieces:[{id:1,name:'Cargo',x:0,y:0,z:0,angle:0,design:createKitchenDesign('base','cargo')}]},1)!;
 const tl=assemblyTimeline(piece),s=tl.steps[piece.steps.findIndex(s=>s.stage==='drawers')]!;
 const front=piece.boards.findIndex(b=>b.name==='Cargo front');
 const start=drawerBoardOffset(piece,tl,playhead(tl,s.place[0]),front);
 const mid=drawerBoardOffset(piece,tl,playhead(tl,(s.place[0]+s.place[1])/2),front);
 const end=drawerBoardOffset(piece,tl,playhead(tl,s.place[1]),front);
 assert.deepEqual(start,[0,0,60]);assert.deepEqual(mid,[0,0,30]);assert.deepEqual(end,[0,0,0]);
});
