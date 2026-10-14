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
 assert.equal(resize('top',2.3).h,32.5);
});
function model(secs){
 const c=vm.createContext({S:{w:104,h:120,n:1,wt:[100],secs:[secs]},update(){},hist:[],redoH:[],G:{}});
 designFixture(c);
 return c;
}
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
  const api=createItemResize({dom:{width},geometry:{itemGeom:()=>({...g,freeTop:50}),resizeObstacles:()=>[],itemMinW:()=>25,effectiveMin:()=>15,widths:()=>[200],ih:()=>190},model:{activeCabinet:()=>({state}),scene:{activeWardrobe:1},snapshot:()=> 'original'},picking:{frontPoint:()=>({x:0,y:0})},camera:{camRelease(){},moveViewOn(){calls.push('movement framing')},moveViewOff(){calls.push('restore')}},cameraState:{tgt:{y:100},vs:0,vz:1},interactionState:{},commands:{},history:{},shellState:{},inspector:{update(){}},renderState:{},callbacks:{cancelMovement(){}}});
  api.beginItemEdgeResize({button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){},stopPropagation(){}},'right',handle);
  assert.deepEqual(calls,['movement framing']);
  api.finishItemEdgeResize();
  assert.deepEqual(calls,['movement framing','restore']);
 }
});
