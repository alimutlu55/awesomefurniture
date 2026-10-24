const {test}=require('node:test'),assert=require('node:assert/strict');
const {mountMobileSheet}=require('../src/presentation/editor/mobile-sheet.js');
function fixture(fullscreen=false,bottom=true){
 const listeners={},values=new Map(),classes=new Set();let closed=0,captured=false;
 const panel={dataset:{},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)},contains:()=>true,prepend(){},getBoundingClientRect:()=>({height:300})};
 const handle={contains:target=>target===handle,setAttribute(){},setPointerCapture(){captured=true},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false}};
 mountMobileSheet({panel,fullscreen,bottom,name:'Settings',close:()=>closed++,document:{createElement:()=>handle},lifetime:{listen:(_target,type,callback)=>listeners[type]=callback}});
 const emit=(type,y=200)=>listeners[type]({pointerId:1,isPrimary:true,button:0,clientY:y});
 const drag=distance=>{emit('pointerdown');emit('pointermove',200+distance);emit('pointerup',200+distance)};
 return{panel,values,emit,drag,handle,listeners,closed:()=>closed};
}
test('a bottom panel follows upward dragging and snaps to expanded then compact',()=>{
 const f=fixture();f.emit('pointerdown');f.emit('pointermove',100);
 assert.equal(f.values.get('--mobile-sheet-drag-height'),'400px');
 f.emit('pointerup',100);assert.equal(f.panel.dataset.sheetPosition,'expanded');
 assert.equal(f.values.has('--mobile-sheet-drag-height'),false);
 f.emit('click');assert.equal(f.panel.dataset.sheetPosition,'expanded','Release click must not reverse the snap');
 f.drag(100);assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.closed(),0);
 f.drag(100);assert.equal(f.closed(),1);
});
test('short and cancelled drags keep the current position',()=>{
 const f=fixture();f.drag(-20);assert.equal(f.panel.dataset.sheetPosition,'compact');
 f.emit('pointerdown');f.emit('pointermove',70);f.emit('pointercancel');
 assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.values.size,0);assert.equal(f.closed(),0);
});
test('Auto design starts expanded and moves between its default and compact heights',()=>{
 const f=fixture(true);assert.equal(f.panel.dataset.sheetPosition,'full');
 f.drag(100);assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.closed(),0);
 f.drag(-100);assert.equal(f.panel.dataset.sheetPosition,'full');
});
test('handle taps provide an accessible alternative to dragging',()=>{
 const f=fixture();f.emit('click');assert.equal(f.panel.dataset.sheetPosition,'expanded');
 f.emit('click');assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.closed(),0);
});
test('mouse gestures expand, lower and close sheets just like touch',()=>{
 const f=fixture();f.drag(-100);assert.equal(f.panel.dataset.sheetPosition,'expanded');
 f.drag(100);assert.equal(f.panel.dataset.sheetPosition,'compact');
 f.drag(100);assert.equal(f.closed(),1);
});
test('other menus retain their pull-to-close behavior',()=>{
 const f=fixture(false,false);f.drag(100);assert.equal(f.closed(),1);
});

test('touch drags can begin on panel text away from the handle',()=>{
 const f=fixture();const target={closest:()=>null,scrollHeight:0,clientHeight:100,parentElement:null};let prevented=0;
 f.listeners.touchstart({target,touches:[{identifier:2,clientX:100,clientY:200}]});
 f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:100}],preventDefault(){prevented++}});
 assert.equal(f.values.get('--mobile-sheet-drag-height'),'400px');
 f.listeners.touchend();assert.equal(f.panel.dataset.sheetPosition,'expanded');assert.equal(prevented,1);
});
test('touches on controls and horizontal gestures do not drag the panel',()=>{
 const f=fixture();const control={closest:()=>({}),scrollHeight:0};
 f.listeners.touchstart({target:control,touches:[{identifier:2,clientX:100,clientY:200}]});
 f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:100}],preventDefault(){assert.fail('Control gesture intercepted')}});
 assert.equal(f.values.size,0);
 const text={closest:()=>null,scrollHeight:0,clientHeight:100,parentElement:null};
 f.listeners.touchstart({target:text,touches:[{identifier:2,clientX:100,clientY:200}]});
 f.listeners.touchmove({touches:[{identifier:2,clientX:200,clientY:180}],preventDefault(){assert.fail('Horizontal gesture intercepted')}});
 assert.equal(f.values.size,0);
});
test('expanded content scrolls, but a downward pull at its top lowers the sheet',()=>{
 const f=fixture();f.panel.dataset.sheetPosition='expanded';
 const target={closest:()=>null,scrollHeight:500,clientHeight:100,scrollTop:50,parentElement:null};
 const original=global.getComputedStyle;global.getComputedStyle=()=>({overflowY:'auto'});
 try{
  const start=()=>f.listeners.touchstart({target,touches:[{identifier:2,clientX:100,clientY:200}]});
  start();f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:300}],preventDefault(){assert.fail('Scrolled content intercepted')}});
  assert.equal(f.values.size,0);
  target.scrollTop=0;start();f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:100}],preventDefault(){assert.fail('Upward content scroll intercepted')}});
  assert.equal(f.values.size,0);
  start();f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:300}],preventDefault(){}});f.listeners.touchend();
  assert.equal(f.panel.dataset.sheetPosition,'compact');
 }finally{global.getComputedStyle=original;}
});
test('overflowing compact content scrolls on the first upward swipe instead of expanding',()=>{
 const f=fixture();
 const target={closest:()=>null,scrollHeight:500,clientHeight:100,scrollTop:0,parentElement:null};
 const original=global.getComputedStyle;global.getComputedStyle=()=>({overflowY:'auto'});
 try{
  f.listeners.touchstart({target,touches:[{identifier:2,clientX:100,clientY:200}]});
  f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:100}],preventDefault(){assert.fail('First content swipe intercepted')}});
  f.listeners.touchend();
  assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.values.size,0);
 }finally{global.getComputedStyle=original;}
});

test('drawing and scroll-only content keep their gestures instead of dragging the sheet',()=>{
 for(const selector of ['[role="application"]','[data-sheet-scroll]']){
  const f=fixture();
  const target={closest:query=>query.includes(selector)?{}:null};
  f.listeners.touchstart({target,touches:[{identifier:2,clientX:100,clientY:200}]});
  f.listeners.touchmove({touches:[{identifier:2,clientX:100,clientY:300}],preventDefault(){assert.fail('Content gesture intercepted')}});
  f.listeners.touchend();
  assert.equal(f.closed(),0);assert.equal(f.panel.dataset.sheetPosition,'compact');
  f.listeners.pointerdown({target,pointerId:1,isPrimary:true,button:0,clientX:100,clientY:200});
  f.emit('pointermove',300);f.emit('pointerup',300);
  assert.equal(f.closed(),0);assert.equal(f.values.size,0);
 }
});
