const {test}=require('node:test');
const assert=require('node:assert/strict');

test('DOM scopes keep control IDs and keyboard ownership independent',()=>{
 const {createEditorDom}=require('../src/presentation/editor/editor-dom.js');
 const documentTarget=new EventTarget(),windowTarget=new EventTarget();
 const make=()=>{
  const controls=[{id:'w',dataset:{},setAttribute(){}}];
  const root=new EventTarget();root.ownerDocument=documentTarget;root.querySelector=()=>controls[0];root.querySelectorAll=selector=>selector==='[id]'?controls:[];
  root.contains=node=>node===root||controls.includes(node);
  return {root,controls};
 };
 documentTarget.defaultView=windowTarget;
 const first=make(),second=make(),a=createEditorDom(first.root),b=createEditorDom(second.root);
 assert.notEqual(first.controls[0].id,second.controls[0].id);
 assert.equal(a.$('#w'),first.controls[0]);assert.equal(b.$('#w'),second.controls[0]);
 let ac=0,bc=0;a.window.addEventListener('keydown',()=>ac++);b.window.addEventListener('keydown',()=>bc++);
 first.root.dispatchEvent(new Event('pointerdown'));windowTarget.dispatchEvent(new Event('keydown'));
 assert.deepEqual([ac,bc],[1,0]);
 second.root.dispatchEvent(new Event('focusin'));windowTarget.dispatchEvent(new Event('keydown'));
 assert.deepEqual([ac,bc],[1,1]);
 a.dispose();windowTarget.dispatchEvent(new Event('keydown'));assert.deepEqual([ac,bc],[1,2]);b.dispose();
});

test('controls inserted after mounting get unique IDs and keep label associations',()=>{
 const {createEditorDom}=require('../src/presentation/editor/editor-dom.js');
 const owner=new EventTarget();owner.defaultView=new EventTarget();
 const root=new EventTarget(),controls=[],labels=[];root.ownerDocument=owner;root.contains=()=>false;
 root.querySelectorAll=selector=>selector==='[id]'?controls:labels;
 root.querySelector=()=>controls[0];
 const dom=createEditorDom(root);
 const control={id:'w',dataset:{}};controls.push(control);
 let labelWrites=0;
 const label={attributes:{for:'w'},getAttribute(key){return this.attributes[key]},setAttribute(key,value){labelWrites++;this.attributes[key]=value}};labels.push(label);
 dom.$('#w');
 assert.match(control.id,/wardrobe-\d+-w/);assert.equal(label.attributes.for,control.id);
 dom.$('#w');dom.document.querySelectorAll('label');assert.equal(labelWrites,1,'repeat queries must not rewrite stable label references');dom.dispose();
});
