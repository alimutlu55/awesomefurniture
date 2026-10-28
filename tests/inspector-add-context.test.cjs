const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createInspectorPanels } = require('../src/presentation/editor/inspector-panels.js');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');

function fixture(width=375) {
 const nodes = new Map();
 const $ = id => {
  if (!nodes.has(id)) {
   const classes = new Set();
   nodes.set(id, {dataset:{},style:{},hidden:true,scrollTop:0,
    classList:{add:(...keys)=>keys.forEach(k=>classes.add(k)),remove:(...keys)=>keys.forEach(k=>classes.delete(k)),contains:k=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)},
    setAttribute(){},querySelector:selector=>$(id+selector),
    getBoundingClientRect:()=>({width:1000,height:800}),
    getRootNode:()=>({querySelectorAll:()=>[]})});
  }
  return nodes.get(id);
 };
 const state = createEditorState(), selectionState = {popMin:true,addKey:null};
 const model = {activeCabinet:()=>({state})};
 const geometry = createWardrobeGeometry(()=>state);
 const renders=[],frames=[],releases=[];
 const cameraState={vz:1.4,vzT:1.4};
 const panels=createInspectorPanels({dom:{width,$,document:{querySelector:$}},geometry,model,resources:{},cameraState,
  camera:{baseShift:()=>0,frameMobileInspector:(...args)=>frames.push(args),camRelease:()=>releases.push(true)},selectionState,
  callbacks:{hidePop:()=>['#pop2','#pop3','#pop4'].forEach(id=>$(id).classList.remove('show')),
   renderAddChoices:()=>{selectionState.addKey=state.sel;renders.push($('#pop2').dataset.addContext);},itemUI(){},dividerUI(){}}});
 return {$,selectionState,renders,panels,frames,releases,cameraState};
}

for(const width of [375,844,1440])for(const id of ['#pop3','#pop4'])test(`${width}px: opening ${id} Resize preserves zoom and releases automatic framing`,()=>{
 const f=fixture(width);
 f.panels.showPop(null,id,'resize');
 assert.equal(f.$(id).classList.contains('show'),true);
 assert.equal(f.$(id).dataset.contextSection,'resize');
 assert.equal(f.frames.length,0);
 assert.equal(f.releases.length,1,'canvas resizing must not restart the previous camera fit');
 f.panels.layoutPop(f.$(id));
 assert.equal(f.cameraState.vzT,1.4,'laying out the Size panel retains the current zoom');
});

test('opening Add item expands a collapsed inspector and clears furniture catalogue context',()=>{
 const f=fixture();
 f.panels.showPop(null,'#pop2','wardrobe');
 assert.equal(f.$('#pop2').dataset.addContext,'wardrobe');
 f.selectionState.popMin=true;
 f.panels.showPop(null,'#pop2');
 assert.equal(f.selectionState.popMin,false);
 assert.equal(f.$('#pop2').classList.contains('min'),false);
 assert.equal(f.$('#pop2').dataset.addContext,undefined);
 assert.equal(f.$('#ptitle').textContent,'Add to this space');
 assert.deepEqual(f.renders,['wardrobe',undefined]);
});

for(const width of [375,844,1440])test(`${width}px: Add item and passive item selection preserve camera view across screen sizes`,()=>{
 const f=fixture(width);
 f.panels.showPop(null,'#pop2');
 f.panels.showPop(null,'#pop3');
 f.panels.showPop(null,'#pop4');
 assert.equal(f.frames.length,0);
 assert.equal(f.releases.length,3);
});

test('returning from item editing opens fittings instead of a stale scene catalogue',()=>{
 const f=fixture();
 f.$('#pop2').dataset.addContext='furniture';
 f.$('#pop3').classList.add('show');
 f.panels.swapPop('#pop2');
 assert.equal(f.$('#pop3').classList.contains('show'),false);
 assert.equal(f.$('#pop2').classList.contains('show'),true);
 assert.equal(f.$('#pop2').dataset.addContext,undefined);
 assert.equal(f.selectionState.popMin,false);
 assert.equal(f.$('#ptitle').textContent,'Add to this space');
 assert.deepEqual(f.renders,[undefined]);
});
