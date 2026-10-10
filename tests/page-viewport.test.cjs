const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bindPageViewport}=require('../src/presentation/editor/page-viewport.ts');
function fixture(){
 const visual=Object.assign(new EventTarget(),{scale:1,width:390,height:844,offsetLeft:0,offsetTop:0});
 const root=Object.assign(new EventTarget(),{style:{},shadowRoot:{activeElement:null},keyboard:false,toggleAttribute(_name,on){this.keyboard=on}});
 let next=0;const frames=new Map();
 const view={visualViewport:visual,innerHeight:844,requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame(id){frames.delete(id)}};
 const dispose=bindPageViewport(root,view);
 return {root,view,visual,dispose,frames};
}
test('Safari keyboard resize and subsequent pan both update the editor frame',()=>{
 const {root,visual,dispose}=fixture();
 root.shadowRoot.activeElement={matches:()=>true,closest:()=>null};
 Object.assign(visual,{height:400,offsetTop:110,scale:1.000001});visual.dispatchEvent(new Event('resize'));
 assert.equal(root.style.height,'400px');assert.equal(root.style.transform,'translate(0px, 110px)');assert.equal(root.keyboard,true);
 visual.offsetTop=170;visual.dispatchEvent(new Event('scroll'));
 assert.equal(root.style.transform,'translate(0px, 170px)');
 root.shadowRoot.activeElement=null;Object.assign(visual,{height:844,offsetTop:0});visual.dispatchEvent(new Event('resize'));
 assert.equal(root.style.height,'844px');assert.equal(root.style.transform,'translate(0px, 0px)');assert.equal(root.keyboard,false);
 dispose();
});
test('intentional page zoom preserves editor dimensions and allows browser panning',()=>{
 const {root,visual,dispose}=fixture();
 Object.assign(visual,{height:422,width:195,scale:2,offsetTop:150});visual.dispatchEvent(new Event('resize'));
 assert.equal(root.style.height,'844px');assert.equal(root.style.width,'390px');assert.equal(root.style.transform,'');assert.equal(root.keyboard,false);
 dispose();
});
test('a focused size field scrolls inside its inspector, and disposal removes viewport listeners',()=>{
 const {root,visual,dispose,frames}=fixture();
 const panel={matches:()=>true,scrollTop:0,getBoundingClientRect:()=>({top:62,bottom:392})};
 root.shadowRoot.activeElement={matches:()=>true,closest:()=>panel,getBoundingClientRect:()=>({top:410,bottom:454})};
 visual.height=400;visual.dispatchEvent(new Event('resize'));
 for(const fn of frames.values())fn();
 assert.equal(panel.scrollTop,74);
 dispose();assert.equal(frames.size,0);
 visual.height=844;visual.dispatchEvent(new Event('resize'));visual.dispatchEvent(new Event('scroll'));
 assert.equal(root.style.height,'400px');
});
