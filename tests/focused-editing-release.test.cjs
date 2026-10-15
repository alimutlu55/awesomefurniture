const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bindPropertiesToggle}=require('../src/presentation/editor/shell-bindings.js');

function fixture(desktop=false,section='resize') {
 const classes=new Set(['props-open']),view={},left={dataset:{contextSection:section}},events=new Map();
 const app={classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)}};
 const button={append(){},setAttribute(){}};
 bindPropertiesToggle({
  dom:{$:id=>id==='#view'?view:left,document:{createElement:()=>({})},matchMedia:()=>({matches:desktop})},
  elements:{app,propsButton:button},inspector:{},shell:{},
  lifetime:{listen(target,event,callback){if(target===view)events.set(event,callback)}},
 });
 return {open:()=>classes.has('props-open'),release:(target,isPrimary=true)=>events.get('pointerup')({target,isPrimary})};
}
for(const kind of ['shape-handle','item-resize-handle']) test(`${kind}: committing an overlaid handle keeps its editing panel open`,()=>{
 const f=fixture();
 // A label/SVG nested inside the handle must get the same protection as the button itself.
 f.release({closest:selector=>selector.includes('.'+kind)?{}:null});
 assert.equal(f.open(),true);
});
test('an ordinary canvas release still dismisses mobile settings',()=>{
 const f=fixture();f.release({closest:()=>null});assert.equal(f.open(),false);
});
test('desktop canvas releases keep the docked inspector open',()=>{
 const f=fixture(true);f.release({closest:()=>null});assert.equal(f.open(),true);
});
test('secondary pointers cannot dismiss the editing panel',()=>{
 const f=fixture();f.release({closest:()=>null},false);assert.equal(f.open(),true);
});

test('Shape keeps its drawer open while the user orbits to the rear edge',()=>{
 const f=fixture(false,'shape');f.release({closest:()=>null});assert.equal(f.open(),true);
});
