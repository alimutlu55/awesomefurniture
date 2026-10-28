const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {designFixture,gestureFixture}=require('./helpers/editor-fixture.cjs');
const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
const context=createWardrobeGeometry(()=>({}));
const g={x0:12,x1:62,bayL:2,bw:100,w:50,h:30,y0:20,y1:50};
const resize=(edge,delta,neighbors=[])=>context.itemEdgeSize(g,edge,delta,neighbors,-1,25,15,40);
test('side resizing keeps opposite edge fixed and stops at bay walls',()=>{
 let q=resize('right',-15);assert.equal(q.w,35);assert.equal(q.x,10);
 q=resize('left',15);assert.equal(q.w,35);assert.equal(q.x,25);
 q=resize('left',-1000);assert.equal(q.x,0);assert.equal(q.w,60);
 q=resize('right',1000);assert.equal(q.x,10);assert.equal(q.w,90);
});
test('width resizing stops at touching neighbours without jumping through them',()=>{
 let q=resize('right',1000,[{x0:75,x1:100,y0:15,y1:40}]);assert.equal(q.w,65);
 q=resize('left',-1000,[{x0:0,x1:5,y0:30,y1:60}]);assert.equal(q.x,5);assert.equal(q.w,55);
 q=resize('right',1000,[{x0:75,x1:100,y0:50,y1:80}]);assert.equal(q.w,90);
});
test('resize clamps to module minimum and height clearance',()=>{
 assert.equal(resize('right',-1000).w,25);
 assert.equal(resize('left',1000).w,25);
 assert.equal(resize('top',1000).h,40);
 assert.equal(resize('top',-1000).h,15);
 assert.equal(resize('top',2.3).h,32.3);
});

test('a fitted item below its catalogue minimum can stay at its current height without jumping',()=>{
 const fitted={...g,h:12,y1:g.y0+12};
 const size=delta=>context.itemEdgeSize(fitted,'top',delta,[],-1,25,15,40).h;
 assert.equal(size(0),12); assert.equal(size(-10),12); assert.equal(size(1.2),13.2);
});

test('bottom resizing preserves fitted heights below the catalogue minimum and grows continuously',()=>{
 const fitted={...g,h:10,y1:g.y0+10};
 const size=delta=>context.itemEdgeSize(fitted,'bottom',delta,[],-1,25,15,30);
 assert.equal(size(0).h,10);
 assert.equal(size(10).h,10);
 assert.equal(size(-1.2).h,11.2);
});
function model(secs){
 const c=vm.createContext({S:{w:104,h:120,n:1,wt:[100],secs:[secs]},update(){},hist:[],redoH:[],G:{}});
 designFixture(c);
 return c;
}

function edgeGestureFixture(items,index=1,design={}){
 const c=model(items);Object.assign(c.S,{d:60,doors:'none',open:true,sel:0,item:index,dividers:[],profile:{longDrop:160},proposal:null},design);
 const {createItemResize}=require('../src/presentation/editor/item-resize.js');
 const history=[],interactionState={},labels={dataset:{}};
 const handle={classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture(){return false}};
 const api=createItemResize({dom:{$:()=>labels},geometry:c,commands:c,
  model:{activeCabinet:()=>({state:c.S}),scene:{activeWardrobe:1},snapshot:()=>JSON.stringify(c.S),restore:s=>{c.S=JSON.parse(s)}},
  picking:{frontPoint:e=>({x:e.clientX/10,y:-e.clientY/10}),screenPoint:p=>({x:p.x*10,y:-p.y*10})},
  camera:{camRelease(){},moveViewOn(){},moveViewOff(){}},cameraState:{tgt:{y:0}},interactionState,
  history:{checkpoint:s=>history.push(s)},shellState:{G:{}},inspector:{update(){},histUI(){},itemUI(){}},
  renderState:{Gr:{localToWorld:p=>p}},callbacks:{cancelMovement(){}}});
 const begin=(edge='bottom')=>api.beginItemEdgeResize({button:0,pointerId:1,pointerType:'touch',clientX:100,clientY:100,preventDefault(){},stopPropagation(){}},edge,handle);
 const move=delta=>api.moveItemEdgeResize({pointerId:1,clientX:100,clientY:100-delta*10});
 return {c,api,begin,move,history,interactionState};
}

test('bottom drag expands into the gap below an item touching its upper neighbor, then reverses and undoes',()=>{
 const {c,api,begin,move,history}=edgeGestureFixture([{k:'drawer',h:20,y:0},{k:'sdrawer',h:10,y:25},{k:'oven',h:60,y:35}]);
 const before=JSON.stringify(c.S),upper=c.itemGeom(0,2),top=c.itemGeom(0,1).y1;
 assert.equal(c.itemGeom(0,1).freeTop,0);
 begin(); move(-2);
 assert.equal(c.S.secs[0][1].h,12);
 assert.ok(Math.abs(c.itemGeom(0,1).y1-top)<1e-9);
 move(-100);
 assert.ok(Math.abs(c.S.secs[0][1].h-15)<1e-9);assert.ok(Math.abs(c.S.secs[0][1].y-20)<1e-9);
 assert.equal(c.itemGeom(0,2).y0,upper.y0);
 move(-2);assert.equal(c.S.secs[0][1].h,12);
 move(0);assert.equal(JSON.stringify(c.S),before,'returning to the start restores stacking intent');
 move(-3);api.finishItemEdgeResize();assert.equal(history.length,1);
 c.S=JSON.parse(history[0]);assert.equal(JSON.stringify(c.S),before);
});

test('bottom snapping cannot jump through a nearby fitting or shelf board',()=>{
 for(const board of [false,true]){
  const {c,api,begin,interactionState}=edgeGestureFixture([{k:'drawer',h:20,y:0},{k:'sdrawer',h:10,y:25},{k:'oven',h:60,y:35}],1,
   board?{dividers:[{i:0,orientation:'horizontal',x0:0,x1:100,y:21.1}]}:{});
  begin();const a=interactionState.itemEdgeGesture;
  const floor=board?22:20;
  // The other item's bottom is within the snap tolerance, but is through the limiting solid.
  const invalid=c.interiorFloor()+floor-.3;
  a.snap.others=[{i:1,j:0,div:true,y0:invalid,y1:invalid+.1}];a.delta=invalid-a.g.y0;
  assert.equal(api.snapItemEdge(a),null,'reject geometrically unreachable snap candidates');
  a.snap.others=[{i:1,j:0,div:true,y0:c.interiorFloor()+floor,y1:c.interiorFloor()+floor+.1}];
  a.delta=c.interiorFloor()+floor-a.g.y0;
  const snap=api.snapItemEdge(a);assert.ok(snap);assert.ok(Math.abs(snap.target.y-floor)<1e-9);
  api.finishItemEdgeResize();
 }
});

test('snaps obey top and side constraints and their guides follow the resolved geometry',()=>{
 const {api,begin,interactionState,c}=edgeGestureFixture([
  {k:'drawer',h:10,w:10,x:0,y:25},{k:'sdrawer',h:10,w:30,x:15,y:25},
  {k:'drawer',h:10,w:10,x:50,y:25},{k:'oven',h:60,w:30,x:15,y:35}]);
 begin('top');let a=interactionState.itemEdgeGesture;
 a.snap.others=[{i:0,div:true,y0:a.g.y1+.2,y1:a.g.y1+.3}];a.delta=.2;
 assert.equal(api.snapItemEdge(a),null,'the catalogue maximum cannot authorize a snap through the upper neighbor');
 api.finishItemEdgeResize();
 begin('right');a=interactionState.itemEdgeGesture;
 a.snap.others=[{i:0,div:true,x0:50.2,x1:50.3}];a.delta=50.2-(a.g.x1-a.g.bayL);
 assert.equal(api.snapItemEdge(a),null,'side snaps cannot pass through the neighbor');
 a.snap.others=[{i:0,div:true,x0:49.95,x1:50}];a.delta=49.95-(a.g.x1-a.g.bayL);
 const snap=api.snapItemEdge(a);assert.ok(snap);
 assert.ok(Math.abs(snap.guide.pos-(a.g.bayL+snap.target.x+snap.target.w))<1e-9,'guide uses the solver result after millimeter rounding');
 assert.equal(c.applyItemEdgeSize(a,snap.target),true);
 api.finishItemEdgeResize();
});

test('bottom resizing uses the actual base and overlapping supports in every bay, independent of item order',()=>{
 for(const design of [{},{product:'kitchen',unit:'upper'}])for(const bay of [0,1]){
  const {c}=edgeGestureFixture([],0,{...design,w:203.6,n:2,wt:[1,1],secs:[[],[]]});
  c.S.secs[bay]=[{k:'shelf',h:20,y:50,w:40,x:20},{k:'drawer',h:20,y:0,w:30,x:30},{k:'drawer',h:30,y:0,w:20,x:65}];
  const geom=c.itemGeom(bay,0),obstacles=c.resizeObstacles(bay);
  const target=c.itemEdgeSize(geom,'bottom',-1000,obstacles,0,25,15,65);
  assert.ok(Math.abs(target.y-20)<1e-9,'only an overlapping support limits the bottom');
  assert.ok(Math.abs(target.h-50)<1e-9);
  const base=c.itemEdgeSize(geom,'bottom',-1000,[obstacles[0]],0,25,15,100);
  assert.ok(Math.abs(base.y)<1e-9);assert.ok(Math.abs(base.h-70)<1e-9);
 }
});

test('top dragging and numeric height edits retain the upper clearance limit',()=>{
 const {c,api,begin,move}=edgeGestureFixture([{k:'drawer',h:20,y:0},{k:'sdrawer',h:10,y:25},{k:'oven',h:60,y:35}]);
 begin('top');move(10);api.finishItemEdgeResize();assert.equal(c.S.secs[0][1].h,10);
 api.setManualItemSize('top',17);assert.equal(c.S.secs[0][1].h,10);
 api.setManualItemSize('bottom',15);assert.ok(Math.abs(c.S.secs[0][1].h-15)<1e-9);assert.ok(Math.abs(c.S.secs[0][1].y-20)<1e-9);
});

test('every fitting kind uses downward clearance and its own catalogue cap',()=>{
 const {FITTINGS}=require('../src/domain/wardrobe/fittings.ts');
 for(const def of FITTINGS){
  const {c}=edgeGestureFixture([],1,{h:600,w:200});
  const h=c.effectiveMin(def.key);
  c.S.secs=[[{k:'drawer',h:20,y:0},{k:def.key,h,y:25},{k:'shelf',h:20,y:25+h}]];
  const geom=c.itemGeom(0,1),layout=c.resizeObstacles(0);
  const target=c.itemEdgeSize(geom,'bottom',-1000,layout,1,c.itemMinW(c.S.secs[0][1]),h,def.max);
  const growth=Math.max(0,Math.min(5,def.max-h));
  assert.ok(Math.abs(target.h-h-growth)<1e-9,def.key+': catalogue cap and lower support');
  assert.ok(Math.abs(target.y+target.h-(25+h))<1e-9,def.key+': fixed top');
  assert.equal(c.applyItemEdgeSize({edge:'bottom',g:geom,section:0,index:1,original:c.S.secs[0],layout},target),true,def.key+': constrained target is committable');
 }
});
test('width resize retains the opposite edge and all existing vertical positions',()=>{
 const c=model([{k:'drawer',h:22},{k:'shelf',h:30}]);
 vm.runInContext(`const old=computeLayout(0);const g=itemGeom(0,0);applyItemEdgeSize({g,edge:'right',section:0,index:0,original:S.secs[0],layout:old},{w:50,x:0});`,c);
 assert.equal(c.S.secs[0][0].x,0);
 assert.equal(c.S.secs[0][0].w,50);
 assert.equal(c.S.secs[0][1].y,22);
});
test('invalid direct resize is rejected without changing any stored items',()=>{
 const c=model([{k:'drawer',h:22,w:50,x:0,y:0},{k:'drawer',h:22,w:50,x:50,y:0}]);
 const before=JSON.stringify(c.S.secs);
 const ok=vm.runInContext(`applyItemEdgeSize({g:itemGeom(0,0),edge:'right',section:0,index:0,original:S.secs[0],layout:computeLayout(0)},{w:60,x:0})`,c);
 assert.equal(ok,false);assert.equal(JSON.stringify(c.S.secs),before);
});
function cameraFixture(){
 const calls={focus:0,return:0,reopen:0};
 const c=vm.createContext({snapItemEdge(){return null},calls,focusReady:false,scale:1,cameraX:0,vs:0,vz:1,hist:[],redoH:[],G:{},frontPoint(e){return{x:e.clientX/c.scale+c.cameraX,y:-e.clientY/c.scale}},$(selector){return{classList:{contains(){return true}}}},itemResizeFocusReady(){return c.focusReady},moveViewOn(){calls.focus++},moveViewOff(){calls.return++},hidePop(){},reopenItemPanel(){calls.reopen++},update(){},applyItemEdgeSize(a,q){c.target=q},sceneSnapshot(){return c.target?'changed':'original'},restoreScene(){calls.restored=true}});
 c.itemEdgeGesture={pointer:1,edge:'right',g:{x0:0,x1:50,bayL:0,bw:200,w:50,h:30,y0:0,y1:30},pressX:100,pressY:100,lastX:100,lastY:100,delta:0,moved:false,layout:[],index:0,minW:25,minH:15,maxH:50,section:0,original:[],snapshot:'original',handle:{classList:{add(){},remove(){}},hasPointerCapture(){return false}}};
 Object.assign(c,{itemEdgeSize:context.itemEdgeSize});
 gestureFixture(c);
 return {c,calls,run:code=>vm.runInContext(code,c)};
}
test('resizing responds immediately without hiding the panel, then restores the movement camera',()=>{
 const {c,calls,run}=cameraFixture();
 run('moveItemEdgeResize({pointerId:1,clientX:130,clientY:100})');assert.equal(c.target.w,80);assert.equal(calls.focus,0);
 c.cameraX=100;c.scale=2;
 run('moveItemEdgeResize({pointerId:1,clientX:130,clientY:100})');assert.equal(c.target.w,80);
 run('moveItemEdgeResize({pointerId:1,clientX:140,clientY:100})');assert.equal(c.target.w,85);
 run('finishItemEdgeResize()');assert.equal(calls.return,1);assert.equal(calls.reopen,0);assert.equal(c.hist.length,1);
});
test('a click without dragging leaves size and undo history unchanged',()=>{
 const {c,calls,run}=cameraFixture();
 run('moveItemEdgeResize({pointerId:1,clientX:102,clientY:100});finishItemEdgeResize()');
 assert.equal(c.target,undefined);assert.equal(c.hist.length,0);assert.equal(calls.return,1);
});
test('cancelled resizing restores the item and returns the movement camera',()=>{
 const {c,calls,run}=cameraFixture();
 run('moveItemEdgeResize({pointerId:1,clientX:130,clientY:100});finishItemEdgeResize(true)');
 assert.equal(calls.restored,true);assert.equal(calls.return,1);assert.equal(calls.focus,0);assert.equal(c.hist.length,0);
});

 test('edge resizing uses the same movement camera on mobile and desktop',()=>{
 const {createItemResize}=require('../src/presentation/editor/item-resize.js');
 for(const width of [390,1200]){
  const calls=[];
  const item={k:'drawer',h:22};
  const state={sel:0,item:0,doors:'none',secs:[[item]]};
  const handle={classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture(){return false}};
  const api=createItemResize({dom:{width},geometry:{itemGeom:()=>({...g,freeTop:50}),resizeObstacles:()=>[],itemMinW:()=>25,effectiveMin:()=>15,widths:()=>[200],ih:()=>190,interiorFloor:()=>9.8},model:{activeCabinet:()=>({state}),scene:{activeWardrobe:1},snapshot:()=> 'original'},picking:{frontPoint:()=>({x:0,y:0})},camera:{camRelease(){},moveViewOn(){calls.push('movement framing')},moveViewOff(){calls.push('restore')}},cameraState:{tgt:{y:100},vs:0,vz:1},interactionState:{},commands:{},history:{},shellState:{},inspector:{update(){}},renderState:{},callbacks:{cancelMovement(){}}});
  api.beginItemEdgeResize({button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){},stopPropagation(){}},'right',handle);
  assert.deepEqual(calls,['movement framing']);
  api.finishItemEdgeResize();
  assert.deepEqual(calls,['movement framing','restore']);
 }
});

test('edge resize preserves every 10..1 mm gap and has no magnetic hold after exact contact',()=>{
 const {c,api,begin,interactionState}=edgeGestureFixture([
  {k:'drawer',h:20,w:34,x:15,y:25},{k:'sdrawer',h:20,w:10,x:50,y:25}],0);
 begin('right');const a=interactionState.itemEdgeGesture;
 for(const gap of [10,9,8,7,6,5,4,3,2,1,0,1,5,10]){
  a.delta=(10-gap)/10;
  const align=api.snapItemEdge(a);
  if(gap>0)assert.equal(align,null,'remaining '+gap+' mm must not snap closed');
  const target=align?.target??c.itemEdgeSize(a.g,a.edge,a.delta,a.layout,a.index,a.minW,a.minH,a.maxH);
  assert.equal(Math.round((50-target.x-target.w)*10),gap);
 }
 api.finishItemEdgeResize(true);
});
