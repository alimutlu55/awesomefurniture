const {test}=require('node:test'),assert=require('node:assert/strict');
const {mountMobileSheet}=require('../src/presentation/editor/mobile-sheet.js');
function fixture(fullscreen=false,bottom=true){
 const listeners={},values=new Map(),classes=new Set();let closed=0,captured=false;
 const panel={dataset:{},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)},prepend(){},getBoundingClientRect:()=>({height:300})};
 const handle={setAttribute(){},setPointerCapture(){captured=true},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false}};
 const desktop={matches:false};
 mountMobileSheet({panel,desktop,fullscreen,bottom,name:'Settings',close:()=>closed++,document:{createElement:()=>handle},lifetime:{listen:(_target,type,callback)=>listeners[type]=callback}});
 const emit=(type,y=200)=>listeners[type]({pointerId:1,isPrimary:true,button:0,clientY:y});
 const drag=distance=>{emit('pointerdown');emit('pointermove',200+distance);emit('pointerup',200+distance)};
 return{panel,values,desktop,emit,drag,closed:()=>closed};
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
test('Auto design starts full screen and moves between full and compact',()=>{
 const f=fixture(true);assert.equal(f.panel.dataset.sheetPosition,'full');
 f.drag(100);assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.closed(),0);
 f.drag(-100);assert.equal(f.panel.dataset.sheetPosition,'full');
});
test('handle taps provide an accessible alternative to dragging',()=>{
 const f=fixture();f.emit('click');assert.equal(f.panel.dataset.sheetPosition,'expanded');
 f.emit('click');assert.equal(f.panel.dataset.sheetPosition,'compact');assert.equal(f.closed(),0);
});
test('desktop gestures do not change panel positions',()=>{
 const f=fixture();f.desktop.matches=true;f.drag(-100);assert.equal(f.panel.dataset.sheetPosition,'compact');
});
test('other menus retain their pull-to-close behavior',()=>{
 const f=fixture(false,false);f.drag(100);assert.equal(f.closed(),1);
});
