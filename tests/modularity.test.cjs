const {test}=require('node:test');
const assert=require('node:assert/strict');

test('camera state belongs to each editor instance and exposes independent targets',()=>{
 const {createCameraState}=require('../src/presentation/viewport/camera-state.js');
 const a=createCameraState(),b=createCameraState();
 a.tgt.set(1,2,3);a.dist=700;
 assert.equal(b.dist,420);assert.equal(b.tgt.y,115);
 assert.notEqual(a.tgt,b.tgt);
});

test('interaction sessions cannot leak pointers or drag state between editors',()=>{
 const {createInteractionState}=require('../src/presentation/editor/interaction-state.js');
 const a=createInteractionState(),b=createInteractionState();
 a.ptrs.set(1,{clientX:10});a.drag={started:true};
 assert.equal(b.ptrs.size,0);assert.equal(b.drag,null);
});

test('presentation modules cannot regain an unrestricted editor context or global animation clock',()=>{
 const {readFileSync,readdirSync}=require('node:fs');
 const inspect=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const path=directory+'/'+entry.name;
  return entry.isDirectory()?inspect(path):/\.[jt]s$/.test(path)?[path]:[];
 });
 for(const file of inspect('src/presentation')){
  const source=readFileSync(file,'utf8');
  assert.doesNotMatch(source,/\beditorPorts\b|window\.__lt/,file);
 }
});

test('responsive binding works with an immutable inspector API',()=>{
 const {bindResponsiveInspectors}=require('../src/presentation/editor/shell-bindings.js');
 const originalDocument=global.document,originalMatchMedia=global.matchMedia;
 const sheet=()=>({dataset:{},appendChild(){},prepend(){},classList:{add(){}}});
 const app={appendChild(){}},left=sheet();
 const movement={hidden:true,style:{}},dividerActions={style:{}};
 const elements={'#left':left,'#pop2':sheet(),'#pop3':{...sheet(),parentNode:left},'#pop4':{...sheet(),parentNode:left},'#wizard':{querySelector:()=>sheet()},'#ix':{},'#divider-close':{},'#move-controls':{closest:()=>movement},'#divider-dup':{parentElement:dividerActions}};
 elements['#topright']={appendChild(){}};elements['#topleft']={appendChild(){}};
 elements['#plan-panel']={...sheet(),parentNode:elements['#topright']};elements['#menu']={...sheet(),parentNode:elements['#topleft']};
 let syncs=0;
 global.document={querySelector:key=>elements[key],createElement:()=>({setAttribute(){}})};global.matchMedia=()=>({matches:true});
 try{
  const inspector=Object.freeze({syncResponsive(){syncs++},goUp(){},hidePop(){}});
  bindResponsiveInspectors({dom:require('./helpers/dom-fixture.cjs').domFixture(), inspector,elements:{app},lifetime:{listen(){}}});
  assert.equal(syncs,1);
 }finally{global.document=originalDocument;global.matchMedia=originalMatchMedia}
});

test('module ports reject use before wiring and cannot be rewired after mounting',()=>{
 const {createModulePort}=require('../src/presentation/editor/module-port.ts');
 const port=createModulePort();
 assert.throws(()=>port.api.run(),/connected/);
 port.connect({run:()=>42});assert.equal(port.api.run(),42);
 assert.throws(()=>port.connect({run:()=>0}),/already/);
 assert.throws(()=>{Object.defineProperty(port.api,'run',{value:()=>0})},/immutable/);
});

test('independent render loops use their own frame clocks',()=>{
 const THREE=require('three');
 const {createFrameRenderer}=require('../src/presentation/viewport/frame-renderer.js');
 const {createRenderState}=require('../src/presentation/viewport/render-state.js');
 const {createCameraState}=require('../src/presentation/viewport/camera-state.js');
 const savedDocument=global.document;
 global.document={querySelector:()=>({textContent:''})};
 try{
  const make=()=>{
   let now=0;const elapsed=[];
   const state=createRenderState();
   const renderer=createFrameRenderer({dom:require('./helpers/dom-fixture.cjs').domFixture(), clock:{now:()=>now},lifetime:{frame(){}},renderState:state,
    camera:{cameraTick:(_now,dt)=>elapsed.push(dt),cameraNearDistance:()=>1},cameraState:createCameraState(),
    resources:{cam:new THREE.PerspectiveCamera(),scene:new THREE.Scene(),R:{render(){}},cv:{getBoundingClientRect:()=>({})}},
    interactionState:{drag:null},shellState:{t0:Date.now()},callbacks:{positionLabels(){}}
   });
   return {elapsed,step(time){now=time;renderer.loop()}};
  };
  const first=make(),second=make();first.step(1000);first.step(1020);second.step(5000);first.step(1040);
  assert.deepEqual(first.elapsed,[0,.02,.02]);assert.deepEqual(second.elapsed,[0]);
 }finally{global.document=savedDocument}
});

test('camera motion preferences are injected and stay live without global lookups',()=>{
 const {createCameraState}=require('../src/presentation/viewport/camera-state.js');
 const preference={matches:true},state=createCameraState({reducedMotion:preference});
 assert.equal(state.reducedCameraMotion.matches,true);preference.matches=false;assert.equal(state.reducedCameraMotion.matches,false);
});
