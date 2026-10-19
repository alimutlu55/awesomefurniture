const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {dependencies}=require('./helpers/editor-fixture.cjs');
const {createCameraController}=require('../src/presentation/viewport/camera-controller.js');
function fixture(width=1200,domOverrides={}){let time=0;const c=vm.createContext({az:0,el:.1,dist:500,tgt:new (require('three').Vector3)(0,100,0),tgtY:100,vs:0,vsT:0,vz:1,vzT:1,camGoal:null,camHome:null,camRestore:null,zoomTarget:null,zoomAnchor:null,zoomFocus:null,reducedCameraMotion:{matches:false},activeCabinet:()=>({x:0,y:0,z:0,angle:0}),S:{w:200,h:200,d:60,item:-1,divider:-1},focusOn:false,inside:()=>false});Object.assign(c,createCameraController({...dependencies(c),dom:{...require('./helpers/dom-fixture.cjs').domFixture(),width,...domOverrides},clock:{now:()=>time}}));const transition=c.cameraTransition;c.cameraTransition=(...a)=>{transition(...a);if(c.camGoal)c.camGoal.start=time};return{run:s=>vm.runInContext(s,c),time:t=>time=t}}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('camera transitions have exact endpoints, smooth ends and take shortest angular path',()=>{const{run}=fixture();run('cameraTransition({az:Math.PI*2-.1,el:.3,dist:250,x:50,y:150,z:20},600)');run('cameraTick(0,1/60)');near(run('dist'),500);run('cameraTick(300,1/60)');near(run('az'),-.05);near(run('dist'),Math.sqrt(500*250));run('cameraTick(600,1/60)');near(run('dist'),250);near(run('tgt.y'),150);assert.equal(run('camGoal'),null);near(run('cameraEase(0)'),0);near(run('cameraEase(1)'),1);assert.ok(run('cameraEase(.001)')<1e-7)});
test('manual takeover freezes all axes and prevents a later camera return',()=>{const{run}=fixture();run('camHome=camNow();cameraTransition({az:1,el:.3,dist:250,x:50,y:150,z:20});cameraTick(200,.016)');const before=run('JSON.stringify(camNow())');run('camRelease();moveViewOff();cameraTick(2000,.016)');assert.equal(run('JSON.stringify(camNow())'),before);assert.equal(run('camHome'),null)});
test('repeated zoom accumulates intent and converges monotonically with bounded travel',()=>{const{run}=fixture();run('cameraZoom(1/1.2);cameraZoom(1/1.2)');near(run('zoomTarget'),500/1.44);let previous=500;for(let n=0;n<100;n++){run('cameraTick(0,1/60)');let current=run('dist');assert.ok(current<=previous&&current>=500/1.44-1e-6);previous=current}near(previous,500/1.44);run('cameraZoom(.000001)');near(run('zoomTarget'),120);run('cameraZoom(1e10)');near(run('zoomTarget'),15000)});
test('reduced motion reaches targets without animation or delayed zoom',()=>{const{run}=fixture();run('reducedCameraMotion.matches=true;cameraTransition({az:.4,el:.2,dist:300,x:1,y:2,z:3})');near(run('dist'),300);assert.equal(run('camGoal'),null);run('cameraZoom(.5)');near(run('dist'),150);assert.equal(run('zoomTarget'),null)});
test('fit keeps all bounding corners inside perspective at multiple views and aspect ratios',()=>{const{run}=fixture();for(const az of [0,.4,Math.PI/2,2.8])for(const el of [0,.2,1.2])for(const aspect of [.5,1,2]){const b={w:600,h:230,d:250};const d=run(`cameraFitDistance(${JSON.stringify(b)},${az},${el},${aspect})`);for(const x of [-300,300])for(const y of [-115,115])for(const z of [-125,125]){const depth=x*Math.cos(el)*Math.sin(az)+y*Math.sin(el)+z*Math.cos(el)*Math.cos(az),h=x*Math.cos(az)-z*Math.sin(az),v=-x*Math.sin(el)*Math.sin(az)+y*Math.cos(el)-z*Math.sin(el)*Math.cos(az),tan=Math.tan(35*Math.PI/360);assert.ok(Math.abs(h)<=(d-depth)*tan*aspect+1e-6);assert.ok(Math.abs(v)<=(d-depth)*tan+1e-6)}}});
test('pointer zoom keeps the anchor on the same screen ray throughout easing and reversals',()=>{const{run}=fixture();run('zoomAnchor={x:120,y:160,z:40};zoomTarget=250');const anchor={x:120,y:160,z:40},el=.1,n={x:0,y:Math.sin(el),z:Math.cos(el)};function projection(){const t=JSON.parse(run('JSON.stringify(tgt)')),d=run('dist'),v={x:anchor.x-t.x-d*n.x,y:anchor.y-t.y-d*n.y,z:anchor.z-t.z-d*n.z};const depth=-(v.x*n.x+v.y*n.y+v.z*n.z);return[v.x/depth,(v.y*Math.cos(el)-v.z*Math.sin(el))/depth]}
 const before=projection();for(let i=0;i<40;i++){run('cameraTick(0,1/60)');projection().forEach((v,j)=>near(v,before[j]))}run('zoomAnchor={x:120,y:160,z:40};zoomTarget=650');for(let i=0;i<60;i++){run('cameraTick(0,1/60)');projection().forEach((v,j)=>near(v,before[j]))}
});
test('center zoom leaves the target fixed and takeover clears the pointer anchor',()=>{const{run}=fixture();const before=run('JSON.stringify(tgt)');run('cameraZoom(.7);cameraTick(0,1/60)');assert.equal(run('JSON.stringify(tgt)'),before);run('zoomAnchor={x:120,y:160,z:40};camRelease()');assert.equal(run('zoomAnchor'),null)});
test('camera depth precision scales at distant zoom while keeping close-up clipping small',()=>{const{run}=fixture();near(run('cameraNearDistance(120)'),1);near(run('cameraNearDistance(800)'),4);near(run('cameraNearDistance(4000)'),20);near(run('cameraNearDistance(15000)'),50);const resolution=(distance,nearPlane)=>distance*distance/(nearPlane*2**24);assert.ok(resolution(4000,run('cameraNearDistance(4000)'))<.05);assert.ok(resolution(15000,run('cameraNearDistance(15000)'))<.3)});

test('mobile flights stay direct, adapt duration and include angle-only changes',()=>{
 const{run}=fixture(390);
 run('cameraFlyTo({az:.5,el:.1,dist:500,x:0,y:100,z:0})');
 assert.ok(run('camGoal')!==null,'An angle-only change must animate');
 assert.equal(run('camGoal.arc'),0);
 assert.ok(run('camGoal.duration')>=280&&run('camGoal.duration')<=650);
 run('cameraTick(1000,1/60)');near(run('az'),.5);
 run('cameraFlyTo({az:.5,el:.1,dist:350,x:100,y:100,z:0})');
 assert.equal(run('camGoal.arc'),0);
 let previous=500;
 for(const t of [0,100,200,300,400,500,700]){
  run(`cameraTick(${t},1/60)`);
  const distance=run('dist');assert.ok(distance<=previous&&distance>=350-1e-6);previous=distance;
 }
 near(run('dist'),350);
});
test('repeated mobile framing preserves an in-flight transition and manual takeover cancels it',()=>{
 const{run,time}=fixture(390);
 run('cameraFlyTo({az:.2,el:.1,dist:350,x:30,y:100,z:0});savedGoal=camGoal');
 time(100);run('cameraTick(100,1/60);cameraFlyTo({az:.2,el:.1,dist:350,x:30,y:100,z:0})');
 assert.equal(run('camGoal===savedGoal'),true);
 const before=run('JSON.stringify(camNow())');
 run('camRelease();cameraTick(1000,1/60)');
 assert.equal(run('JSON.stringify(camNow())'),before);
});
test('mobile button zoom centres the wardrobe instead of chasing a low selected fitting',()=>{
 const{run}=fixture(390);
 run('S.item=0;tgt.set(0,30,0);cameraZoom(.8)');
 near(run('zoomFocus.y'),100);
 near(run('zoomTarget'),400);
});

test('mobile item focus animates to the fitting, comes close to it and keeps zoom on its focus',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 const{run,time}=fixture(390,{$:()=>({getBoundingClientRect:()=>({width:390,height:600})}),document:{documentElement:{}}});
 run('S.item=0;S.sel=0;itemGeom=()=>({x0:10,x1:190,y0:10,y1:50,w:180,h:40});frameMobileInspector(true);savedGoal=camGoal');
 assert.ok(run('camGoal'),'Selecting a fitting should animate');
 near(run('camGoal.y'),30);
 assert.ok(run('camGoal.dist < camFront().dist'),'A fitting comes closer than the whole cabinet');
 const duration=run('camGoal.duration');
 time(duration/2);run(`cameraTick(${duration/2},1/60)`);
 assert.ok(run('tgt.y')<100&&run('tgt.y')>30,'Focus must move gradually');
 run('frameMobileInspector(true)');assert.equal(run('camGoal===savedGoal'),true);
 run(`cameraTick(${duration},1/60)`);near(run('tgt.y'),30);
 run('cameraZoom(.9)');near(run('zoomFocus.y'),30);
});

test('mobile selection preserves the current view and panel resizing does not restart focus',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 let height=700;
 const{run,time}=fixture(390,{$:()=>({getBoundingClientRect:()=>({width:390,height})}),document:{documentElement:{}}});
 run('az=.65;el=.3;dist=850;tgt.set(25,140,10);S.item=0;S.sel=0;itemGeom=()=>({x0:10,x1:190,y0:10,y1:50,w:180,h:40});before=JSON.stringify(camNow());frameMobileInspector(true);savedGoal=camGoal');
 assert.equal(run('JSON.stringify(camNow())'),run('before'),'Starting focus must not reset the pose');
 near(run('camGoal.az'),.65);near(run('camGoal.el'),.3);
 assert.equal(run('JSON.stringify(camGoal.from)'),run('before'));
 time(100);run('cameraTick(100,1/60);mid=JSON.stringify(camNow());origin=JSON.stringify(camGoal.from);start=camGoal.start');
 height=500;run('frameMobileInspector(true,true)');
 assert.equal(run('camGoal===savedGoal'),true);
 assert.equal(run('JSON.stringify(camNow())'),run('mid'));
 assert.equal(run('JSON.stringify(camGoal.from)'),run('origin'));
 assert.equal(run('camGoal.start'),run('start'));
 run('cameraTick(1000,1/60)');near(run('tgt.y'),30);near(run('az'),.65);near(run('el'),.3);
});

test('a chosen fitting on a phone fills about half the view, wholly in view, wherever it is and however it is seen',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 for(const az of [0,.65,1.3])for(const el of [0,.3])for(const item of [{x:0,y:30},{x:65,y:170}]) {
  const{run}=fixture(390,{$:()=>({getBoundingClientRect:()=>({width:390,height:600})}),document:{documentElement:{}}});
  run(`az=${az};el=${el};dist=2000;S.item=0;S.sel=0;itemGeom=()=>({x0:${item.x+80},x1:${item.x+120},y0:${item.y-10},y1:${item.y+10},w:40,h:20});frameMobileInspector(true)`);
  // The usable view on a phone: the canvas less its side margins and the toolbar (availableRoom).
  const box={w:58,h:38,d:60},fit=run(`cameraFitDistance(${JSON.stringify(box)},${az},${el},362/485)*600/485`);
  near(run('camGoal.x'),item.x);near(run('camGoal.y'),item.y);
  near(run('camGoal.dist'),fit*2);
  assert.ok(run('camGoal.dist')<run('camFront().dist'),'Closer than the whole cabinet');
 }
});

test('choosing a fitting on a phone never backs out of a view that is already closer',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 const{run}=fixture(390,{$:()=>({getBoundingClientRect:()=>({width:390,height:600})}),document:{documentElement:{}}});
 run('dist=140;S.item=0;S.sel=0;itemGeom=()=>({x0:80,x1:120,y0:20,y1:40,w:40,h:20});frameMobileInspector(true)');
 near(run('camGoal.dist'),140);near(run('camGoal.y'),30);
});

test('move mode uses the same framing margin on mobile and desktop',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 for(const width of [390,1200]) {
  const element={getBoundingClientRect:()=>({width,height:600}),classList:{contains:()=>true}};
  const{run}=fixture(width,{$:()=>element,document:{documentElement:{},querySelector:()=>null}});
  const front=run('camFront().dist');
  run('moveViewOn()');
  near(run('camGoal.dist'),front*1.12);
  near(run('camGoal.y'),100);
 }
});

test('mobile selection fills the view more closely than move mode and centres a low fitting',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 const{run}=fixture(390,{$:()=>({getBoundingClientRect:()=>({width:390,height:768})}),document:{documentElement:{}}});
 run('S.item=0;S.sel=0;itemGeom=()=>({x0:10,x1:190,y0:0,y1:20,w:180,h:20});frameMobileInspector(true)');
 assert.ok(run('camGoal.dist < camFront().dist*1.12'),'Selection should be closer than movement');
 near(run('camGoal.y'),10);
});

test('drawer resizing uses the new canvas dimensions even before its DOM rectangle catches up',()=>{
 const THREE=require('three'),cam=new THREE.PerspectiveCamera(35,375/812,5,50000);
 const camera=createCameraController({dom:{},resources:{cam,cv:{getBoundingClientRect:()=>({width:375,height:812})}},cameraState:{vs:0,vz:1}});
 for(const size of [{width:375,height:406},{width:844,height:195},{width:1440,height:900}]) {
  camera.applyView(size);
  near(cam.aspect,size.width/size.height);
  near(cam.projectionMatrix.elements[5]/cam.projectionMatrix.elements[0],size.width/size.height);
 }
});
