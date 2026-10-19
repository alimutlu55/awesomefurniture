const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEditorState}=require('../src/application/projects/editor-state.ts');
const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
const {createItemResize}=require('../src/presentation/editor/item-resize.js');
const {createSceneHistory}=require('../src/application/history/scene-history.ts');

function fixture(){
 let state={...createEditorState(),product:'kitchen',unit:'upper',w:60,h:42,d:58,n:1,wt:[100],sel:0,item:0,
  secs:[[{k:'cupboard',h:38}]],dividers:[]};
 const model={activeCabinet:()=>({state}),snapshot:()=>JSON.stringify(state),restore:s=>{state=JSON.parse(s);}};
 const geometry=createWardrobeGeometry(()=>state);
 const commands=createDesignCommands(()=>state);
 const history=createSceneHistory(model.snapshot,model.restore);
 const resize=createItemResize({model,geometry,commands,history,shellState:{G:{}},inspector:{itemUI(){},histUI(){}}});
 return {model,geometry,commands,history,resize,item:()=>state.secs[0][0]};
}

test('typed 38.2 cm uses the 0.4 cm available above a 38 cm cupboard, and Undo restores it',()=>{
 const f=fixture();
 assert.ok(Math.abs(f.geometry.itemGeom(0,0).freeTop-.4)<1e-9);
 f.resize.setManualItemSize('top',38.2);
 assert.equal(f.item().h,38.2);
 assert.ok(Math.abs(f.geometry.itemGeom(0,0).freeTop-.2)<1e-9);
 assert.equal(f.history.undo(),true);assert.equal(f.item().h,38);
 assert.equal(f.history.redo(),true);assert.equal(f.item().h,38.2);
 f.resize.setManualItemSize('top',39);
 assert.ok(Math.abs(f.item().h-38.4)<1e-9,'growth still stops under the top board');
});

test('typed decimal width keeps the anchored edge and the neighbouring fitting clear',()=>{
 const f=fixture();
 f.item().w=30;f.item().x=0;
 f.model.activeCabinet().state.secs[0].push({k:'cupboard',h:38,w:20,x:36.4,y:0});
 f.resize.setManualItemSize('right',36.2);
 assert.equal(f.item().w,36.2);assert.equal(f.item().x,0);
 f.resize.setManualItemSize('right',40);
 assert.ok(Math.abs(f.item().w-36.4)<1e-9,'width cannot overlap its neighbour');
});

test('fitting commands preserve tenths and reject non-finite sizes',()=>{
 const f=fixture();
 f.commands.setItemH(38.2);assert.equal(f.item().h,38.2);
 f.commands.setItemW(56.2);assert.equal(f.item().w,56.2);
 const before=f.model.snapshot();
 for(const value of [NaN,Infinity,-Infinity]){f.commands.setItemH(value);f.commands.setItemW(value);}
 assert.equal(f.model.snapshot(),before);
});
