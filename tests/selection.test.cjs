const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {dependencies}=require('./helpers/editor-fixture.cjs');
const {createEditorGestures}=require('../src/presentation/editor/editor-gestures.js');
const {bindCanvasPointerdown,bindCanvasPointerup,bindCanvasLostpointercapture}=require('../src/presentation/editor/bindings/canvas.js');
function fixture(width=1200){
 const handlers={};const context=vm.createContext({handlers,allHits:'bays',allItemHits:'items',ihits:'items',ptrs:new Map(),focusOn:false,deep:false,pillOn:false,activeWardrobe:1,S:{w:200,sel:0,item:-1,doors:'none'},wardrobeGesture:null,rotationGesture:null,rotationClick:false,drag:null,hit:null,itemHit:null,panel:null,wardrobeDrag:false,camRelease(){},beginWardrobeDrag(){context.wardrobeDrag=true},cv:{addEventListener(name,fn){handlers[name]=fn},focus(){},setPointerCapture(){}},frontPoint(){return null},clearFocus(){context.focusOn=false;context.deep=false;context.S.item=-1},cancelMovement(){},hidePop(){context.panel=null},update(){context.focusOn=true},showPop(e,p){context.panel=p},selectCabinet(id){context.activeWardrobe=id;context.S={w:200,sel:0,item:-1,doors:'none'};context.deep=false;context.pillOn=false;context.panel=null;context.focusOn=true},cast(e,arr){return arr==='bays'?context.hit:context.itemHit}});
 context.frames=0;context.releases=0;
 context.frameMobileInspector=()=>context.frames++;
 context.camRelease=()=>context.releases++;
 context.pieceAt=()=>undefined;
 context.inside=()=>context.deep||context.S.item>=0;
 context.itemGeom=()=>({x0:75,x1:125,y0:85,y1:115,w:50,h:30});
 const ports=dependencies(context);
 ports.dom={...ports.dom,width};
 ports.dom.$=()=>({dataset:{},matches:()=>false,querySelector:()=>null});
 context.pick=createEditorGestures(ports).pick;
 context.lifetime={listen:(target,name,fn)=>target.addEventListener(name,fn)};
 ports.lifetime=context.lifetime;
 bindCanvasPointerdown(ports);
 const hit=(wardrobe=1,i=0,j=0)=>({object:{userData:{wardrobe,i,j},position:{x:0,y:0},geometry:{parameters:{width:50,height:30}}}});
 context.hit=hit();context.itemHit=hit();
 return {context,run:code=>vm.runInContext(code,context),hit};
}
for(const width of [375,844,1280])test(`${width}px: repeated item and space selection retains mobile view and desktop framing policy`,()=>{
 const {context:c,run}=fixture(width);
 c.focusOn=true;
 run('pick({})');assert.equal(c.S.item,0);
 c.itemHit=null;run('pick({})');assert.equal(c.S.item,-1);
 assert.equal(c.frames,width>900?1:0);
 assert.equal(c.releases,2,'selection cancels an old camera fit before changing its target');
});
test('first click on an item selects its wardrobe, second click edits the item',()=>{
 const {context:c,run}=fixture();run('pick({})');assert.equal(c.focusOn,true);assert.equal(c.deep,false);assert.equal(c.S.item,-1);assert.equal(c.panel,null);
 run('pick({})');assert.equal(c.deep,true);assert.equal(c.S.item,0);assert.equal(c.panel,null);
});
test('switching to another occupied wardrobe resets selection to wardrobe level',()=>{
 const {context:c,run,hit}=fixture();run('pick({});pick({})');c.hit=hit(2);c.itemHit=hit(2);run('pick({})');
 assert.equal(c.activeWardrobe,2);assert.equal(c.S.item,-1);assert.equal(c.deep,false);assert.equal(c.panel,null);
});
test('clearing selection or returning to wardrobe level does not reuse a remembered section click',()=>{
 const {context:c,run}=fixture();run('pick({});pick({});clearFocus();pick({})');assert.equal(c.deep,false);assert.equal(c.S.item,-1);
 run('selectCabinet(1)');assert.equal(c.deep,false);assert.equal(c.S.item,-1);
});
test('a press anywhere on the chosen wardrobe, fittings included, moves it; only the chosen fitting is dragged on its own',()=>{
 for(const [under,selected] of [[null,-1],[1,-1],[1,1]]){
  const {context:c,run,hit}=fixture();run('pick({})');c.S.divider=-1;c.S.item=selected;c.itemHit=under===null?null:hit(1,0,under);
  c.handlers.pointerdown({button:0,pointerId:1,clientX:100,clientY:100});
  assert.equal(c.wardrobeDrag,selected<0,'only the chosen fitting moves independently');
  if(selected<0)assert.equal(c.drag,null);else assert.equal(c.drag.from.j,1);
 }
});
test('with nothing chosen, a press on a wardrobe moves nothing: a drag turns the view and a tap chooses it',()=>{
 for(const pointerType of ['mouse','touch']){
  const {context:c,hit}=fixture();c.hit=hit(2);c.itemHit=hit(2,0,1);
  c.handlers.pointerdown({button:0,pointerType,pointerId:1,clientX:100,clientY:100});
  assert.equal(c.pendingFurniture,undefined,pointerType+': the wardrobe stays put');assert.equal(c.drag,null,pointerType+': its fittings stay put');
  assert.equal(c.wardrobeDrag,false);assert.equal(c.ptrs.size,1,pointerType+': the press turns the view');assert.equal(c.focusOn,false);
 }
});
test('a wardrobe frame (sides, top, plinth) counts as the wardrobe: a tap chooses it and a press on the chosen one moves it',()=>{
 const {context:c,run}=fixture();c.hit=null;c.itemHit=null;c.pieceAt=()=>1;
 run('pick({})');assert.equal(c.focusOn,true,'a tap on the frame chooses the wardrobe');
 run('pick({})');assert.equal(c.focusOn,true,'a second tap keeps it chosen instead of letting go');
 c.S.divider=-1;c.deep=false;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});assert.equal(c.wardrobeDrag,true,'a press on its frame moves it');
});
test('with a wardrobe chosen, a press on another one does not move it',()=>{
 const {context:c,run,hit}=fixture();run('pick({})');c.hit=hit(3);c.itemHit=hit(3,0,0);
 c.handlers.pointerdown({button:0,pointerId:5,clientX:100,clientY:100});
 assert.equal(c.pendingFurniture,undefined);assert.equal(c.drag,null);assert.equal(c.wardrobeDrag,false);
});
test('touch drags the selected wardrobe body; empty background remains available for orbit',()=>{
 const {context:c,run}=fixture();run('pick({})');c.itemHit=null;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 assert.equal(c.wardrobeDrag,true);assert.equal(c.ptrs.size,1);
 c.ptrs.clear();c.wardrobeDrag=false;c.hit=null;c.itemHit=null;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:150,clientY:100});
 assert.equal(c.wardrobeDrag,false);assert.equal(c.ptrs.size,1);
});
test('inside a chosen space, a press on another fitting never arms movement of the wardrobe',()=>{
 const {context:c,run,hit}=fixture();run('pick({})');c.deep=true;c.S.item=-1;c.S.divider=-1;c.itemHit=hit(1,0,1);
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 assert.equal(c.pendingFurniture,undefined,'interior selection cannot arm furniture movement');assert.equal(c.drag,null);assert.equal(c.S.item,-1,'a press chooses nothing');
 c.ptrs.clear();c.S.item=1;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:100,clientY:100});
 assert.equal(c.drag.from.j,1);assert.equal(c.pendingFurniture,undefined);
});
test('touch drags the chosen divider where it is; another board never moves the wardrobe',()=>{
 const {context:c,run,hit}=fixture();run('pick({})');
 c.deep=true;c.S.divider=-1;const divider=hit(1,0,0);divider.object.userData.divider=0;c.itemHit=divider;
 let dragged=null;c.beginDividerDrag=(e,index)=>{dragged=index};
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:100,clientY:100});
 assert.equal(dragged,null);assert.equal(c.pendingFurniture,undefined);
 c.ptrs.clear();c.S.divider=0;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:3,clientX:100,clientY:100});
 assert.equal(dragged,0);assert.notEqual(c.wardrobeDrag,true);
});
test('a second finger cancels wardrobe translation before taking over pinch',()=>{
 const {context:c,run}=fixture();run('pick({})');
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 c.wardrobeGesture={moved:true};let rolledBack=false;
 c.finishWardrobeDrag=cancel=>{rolledBack=cancel;c.wardrobeGesture=null};
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:200,clientY:100});
 assert.equal(rolledBack,true);assert.equal(c.wardrobeGesture,null);assert.equal(c.ptrs.size,2);assert.equal(c.pd,100);assert.equal(c.moved,99);
});
test('finishing touch wardrobe movement clears its pointer so the next drag is independent',()=>{
 const {context:c}=fixture();c.ptrs.set(1,{});c.wardrobeGesture={moved:true};
 c.finishWardrobeDrag=()=>{c.wardrobeGesture=null};c.cv.hasPointerCapture=()=>false;
 bindCanvasPointerup(dependencies(c));c.handlers.pointerup({pointerId:1});
 assert.equal(c.ptrs.size,0);assert.equal(c.wardrobeGesture,null);
});
test('losing pointer capture rolls back an interrupted touch wardrobe move',()=>{
 const {context:c}=fixture();c.ptrs.set(1,{});c.wardrobeGesture={moved:true};let rolledBack=false;
 c.finishWardrobeDrag=cancel=>{rolledBack=cancel;c.wardrobeGesture=null};
 c.cv.hasPointerCapture=()=>false;
 bindCanvasLostpointercapture(dependencies(c));c.handlers.lostpointercapture({pointerId:1});
 assert.equal(rolledBack,true);assert.equal(c.wardrobeGesture,null);assert.equal(c.ptrs.size,0);
});
test('a second touch starts pinch before testing selected cabinet or divider geometry',()=>{
 const {context:c,run}=fixture();run('pick({})');
 c.ptrs.set(1,{clientX:100,clientY:100});c.deep=true;c.S.divider=0;c.itemHit.object.userData.divider=0;
 let cancelled=0;c.cancelMovement=()=>{cancelled++;c.drag=null};c.drag={started:true};
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:200,clientY:100});
 assert.equal(c.ptrs.size,2);assert.equal(c.pd,100);assert.equal(c.moved,99);assert.equal(cancelled,1);assert.equal(c.drag,null);
});
test('empty bay follows the same first-click wardrobe and second-click section hierarchy',()=>{
 const {context:c,run}=fixture();c.itemHit=null;run('pick({})');assert.equal(c.deep,false);run('pick({})');assert.equal(c.deep,true);assert.equal(c.S.item,-1);assert.equal(c.pillOn,true);
});

test('a fitting behind the front of an empty opening cannot steal its selection',()=>{
 const {context:c,run}=fixture(); c.focusOn=true;
 c.hit.distance=100; c.itemHit.distance=130;
 run('pick({})'); assert.equal(c.S.item,-1); assert.equal(c.deep,true); assert.equal(c.pillOn,true);
 c.itemHit.distance=100;
 run('pick({})'); assert.equal(c.S.item,0,'a fitting at the opening still selects normally');
});

test('a fitting in another bay cannot override the empty bay under the pointer',()=>{
 const {context:c,run,hit}=fixture(); c.focusOn=true; c.itemHit=hit(1,1,0);
 run('pick({})'); assert.equal(c.S.sel,0); assert.equal(c.S.item,-1); assert.equal(c.pillOn,true);
});

test('pressing an empty opening never arms a drag of its selected fitting farther behind it',()=>{
 const {context:c}=fixture(); c.focusOn=true; c.deep=true; c.S.item=0; c.S.divider=-1;
 c.hit.distance=100; c.itemHit.distance=130;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 assert.equal(c.drag,null); assert.equal(c.wardrobeDrag,false);
});

test('a recessed physical roof divider remains selectable and draggable',()=>{
 const {context:c,run}=fixture(); c.focusOn=true; c.deep=true; c.S.divider=0;
 c.hit.distance=100; c.itemHit.distance=105; c.itemHit.object.userData.divider=0;
 run('pick({})'); assert.equal(c.S.divider,0);
 let grabbed=false; c.beginDividerDrag=()=>{grabbed=true};
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 assert.equal(grabbed,true);
});
