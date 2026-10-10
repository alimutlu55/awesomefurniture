const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {dependencies}=require('./helpers/editor-fixture.cjs');
const {createEditorGestures}=require('../src/presentation/editor/editor-gestures.js');
const {bindCanvasPointerdown,bindCanvasPointerup,bindCanvasLostpointercapture}=require('../src/presentation/editor/gesture-bindings.js');
function fixture(){
 const handlers={};const context=vm.createContext({handlers,allHits:'bays',allItemHits:'items',ihits:'items',ptrs:new Map(),focusOn:false,deep:false,pillOn:false,activeWardrobe:1,S:{sel:0,item:-1,doors:'none'},wardrobeGesture:null,rotationGesture:null,rotationClick:false,drag:null,hit:null,itemHit:null,panel:null,wardrobeDrag:false,camRelease(){},beginWardrobeDrag(){context.wardrobeDrag=true},cv:{addEventListener(name,fn){handlers[name]=fn},focus(){},setPointerCapture(){}},frontPoint(){return null},clearFocus(){context.focusOn=false;context.deep=false;context.S.item=-1},cancelMovement(){},hidePop(){context.panel=null},update(){context.focusOn=true},showPop(e,p){context.panel=p},selectCabinet(id){context.activeWardrobe=id;context.S={sel:0,item:-1,doors:'none'};context.deep=false;context.pillOn=false;context.panel=null;context.focusOn=true},cast(e,arr){return arr==='bays'?context.hit:context.itemHit}});
 context.inside=()=>context.deep||context.S.item>=0;
 context.pick=createEditorGestures(dependencies(context)).pick;
 context.lifetime={listen:(target,name,fn)=>target.addEventListener(name,fn)};
 bindCanvasPointerdown(dependencies(context));
 const hit=(wardrobe=1,i=0,j=0)=>({object:{userData:{wardrobe,i,j},position:{x:0,y:0},geometry:{parameters:{width:50,height:30}}}});
 context.hit=hit();context.itemHit=hit();
 return {context,run:code=>vm.runInContext(code,context),hit};
}
test('first click on an item selects its wardrobe, second click edits the item',()=>{
 const {context:c,run}=fixture();run('pick({})');assert.equal(c.focusOn,true);assert.equal(c.deep,false);assert.equal(c.S.item,-1);assert.equal(c.panel,null);
 run('pick({})');assert.equal(c.deep,true);assert.equal(c.S.item,0);assert.equal(c.panel,'#pop3');
});
test('switching to another occupied wardrobe resets selection to wardrobe level',()=>{
 const {context:c,run,hit}=fixture();run('pick({});pick({})');c.hit=hit(2);c.itemHit=hit(2);run('pick({})');
 assert.equal(c.activeWardrobe,2);assert.equal(c.S.item,-1);assert.equal(c.deep,false);assert.equal(c.panel,null);
});
test('clearing selection or returning to wardrobe level does not reuse a remembered section click',()=>{
 const {context:c,run}=fixture();run('pick({});pick({});clearFocus();pick({})');assert.equal(c.deep,false);assert.equal(c.S.item,-1);
 run('selectCabinet(1)');assert.equal(c.deep,false);assert.equal(c.S.item,-1);
});
test('an occupied area drags the cabinet at wardrobe level and the item at item level',()=>{
 const {context:c,run}=fixture();run('pick({})');c.handlers.pointerdown({button:0,pointerId:1,clientX:100,clientY:100});assert.equal(c.wardrobeDrag,true);assert.equal(c.drag,null);
 c.wardrobeDrag=false;run('pick({})');c.handlers.pointerdown({button:0,pointerId:2,clientX:100,clientY:100});assert.equal(c.wardrobeDrag,false);assert.equal(c.drag.from.j,0);
});
test('touch drags the selected wardrobe body; empty background remains available for orbit',()=>{
 const {context:c,run}=fixture();run('pick({})');
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:1,clientX:100,clientY:100});
 assert.equal(c.wardrobeDrag,true);assert.equal(c.ptrs.size,1);
 c.ptrs.clear();c.wardrobeDrag=false;c.hit=null;c.itemHit=null;
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:150,clientY:100});
 assert.equal(c.wardrobeDrag,false);assert.equal(c.ptrs.size,1);
});
test('touch on a selected divider remains available for orbit and pinch',()=>{
 const {context:c,run,hit}=fixture();run('pick({})');
 c.deep=true;c.S.divider=0;c.itemHit=hit();c.itemHit.object.userData.divider=0;
 c.beginDividerDrag=()=>assert.fail('Touch body must not start divider dragging');
 c.handlers.pointerdown({button:0,pointerType:'touch',pointerId:2,clientX:100,clientY:100});
 assert.equal(c.ptrs.size,1);
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
