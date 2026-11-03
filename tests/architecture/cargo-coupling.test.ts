import test from 'node:test';
import assert from 'node:assert/strict';
import {createKitchenDesign} from '../../src/domain/kitchen/kitchen-design';
import {makePiece} from '../../src/domain/make/make-parts';
import {assemblyTimeline,playhead} from '../../src/domain/make/make-timeline';
import {drawerBoardOffset} from '../../src/domain/make/drawer-installation';
for(const [unit,preset] of [['base','cargo'],['tall','cargo-tall']] as const) test(`${unit}: cargo door and frame use one runner and one coupling geometry`,()=>{
 const m=makePiece({pieces:[{id:1,name:'x',x:0,y:0,z:0,angle:0,design:createKitchenDesign(unit,preset)}]},1)!;
 const front=m.boards.findIndex(b=>b.name==='Cargo front'),motion=m.motions[front]!;
 assert.deepEqual(motion,{kind:'slide',by:35},'500 mm cargo runner gives 350 mm demonstration travel; no 390 mm door travel');
 const frame=m.fittings.find(f=>f.size?.startsWith('cargo frame:'))!;
 assert.ok(frame.cargo,'renderers receive the actual mechanism geometry');
 for(const f of m.fittings.filter(f=>f.size==='cargo front bracket')) {
  assert.ok(frame.cargo.frame.crossbars.some(c=>Math.abs((c.y0+c.y1)/2-f.at[1])<1e-9 && c.z1>=f.at[2]-2.6),'tongue shares the receiver centre and reaches it');
 }
 for(const b of frame.cargo.baskets) for(const z of [b.base.z0+2,b.base.z1-2]) {
  assert.ok(frame.cargo.frame.crossbars.some(c=>c.y1===b.base.y0 && c.x0<=b.base.x0 && c.x1>=b.base.x1 && c.z0<=z && c.z1>=z),'basket rests on both chassis tier supports');
 }
 const tl=assemblyTimeline(m),basket=tl.steps[m.steps.findIndex(s=>s.stage==='cargo-baskets')]!;
 for(const t of [basket.place[0],(basket.place[0]+basket.place[1])/2,basket.place[1]]){
  const offset=drawerBoardOffset(m,tl,playhead(tl,t),front)[2];
  assert.ok(frame.cargo.baskets.every(b=>b.base.z0+offset>=m.size.d+5),'all basket rear hooks stay outside the cabinet during loading');
 }
 assert.ok(m.steps.findIndex(s=>s.stage==='cargo-baskets')<m.steps.findIndex(s=>s.stage==='drawers'));
});

import * as THREE from 'three';
import {createMakeFittings} from '../../src/presentation/make/make-fittings-3d';
for(const [unit,preset] of [['base','cargo'],['tall','cargo-tall']] as const) test(`${unit}: rendered receivers contact frame tongues closed and open`,()=>{
 const m=makePiece({pieces:[{id:1,name:'x',x:0,y:0,z:0,angle:0,design:createKitchenDesign(unit,preset)}]},1)!;
 const root=new THREE.Group(),hosts=m.boards.map(()=>new THREE.Group());
 const rest=(i:number)=>{const b=m.boards[i]!;return new THREE.Vector3((b.x0+b.x1-m.size.w)/2,(b.y0+b.y1)/2,(b.z0+b.z1-m.size.d)/2);};
 hosts.forEach((h,i)=>{h.position.copy(rest(i));root.add(h);});
 const layer=createMakeFittings(0);layer.build(m,i=>hosts[i],rest,root);
 const front=m.boards.findIndex(b=>b.name==='Cargo front'),geo=m.fittings.find(f=>f.size?.startsWith('cargo frame:'))!.cargo!;
 const frame=root.children.find(o=>!hosts.includes(o as THREE.Group) && o.children.length===geo.frame.uprights.length+geo.frame.crossbars.length)!;
 assert.ok(frame);
 for(const offset of [0,35]){
  hosts[front]!.position.copy(rest(front)).z+=offset;
  layer.only(()=>false,()=>1);layer.motion(()=>[0,0,offset]);root.updateMatrixWorld(true);
  const brackets=hosts[front]!.children.filter(o=>o instanceof THREE.Group && o.children.length===4);
  assert.equal(brackets.length,geo.brackets.length);
  for(const bracket of brackets){
   const receiver=new THREE.Box3().setFromObject(bracket.children[1]!);
   assert.ok(frame.children.some(c=>receiver.intersectsBox(new THREE.Box3().setFromObject(c))),'no air gap at any receiver');
  }
 }
 layer.dispose();
});
