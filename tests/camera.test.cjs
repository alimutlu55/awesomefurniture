const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {dependencies}=require('./helpers/editor-fixture.cjs');
const {createCameraController}=require('../src/presentation/viewport/camera-controller.js');
function fixture(width=1200,domOverrides={}){let time=0;const c=vm.createContext({az:0,el:.1,dist:500,tgt:new (require('three').Vector3)(0,100,0),tgtY:100,vs:0,vsT:0,vz:1,vzT:1,camGoal:null,camHome:null,camRestore:null,zoomTarget:null,zoomAnchor:null,zoomFocus:null,reducedCameraMotion:{matches:false},activeCabinet:()=>({x:0,y:0,z:0,angle:0}),S:{w:200,h:200,d:60,item:-1,divider:-1},focusOn:false,inside:()=>false});Object.assign(c,createCameraController({...dependencies(c),dom:{...require('./helpers/dom-fixture.cjs').domFixture(),width,...domOverrides},clock:{now:()=>time}}));const transition=c.cameraTransition;c.cameraTransition=(...a)=>{transition(...a);if(c.camGoal)c.camGoal.start=time};return{run:s=>vm.runInContext(s,c),time:t=>time=t}}

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('camera transitions have exact endpoints, smooth ends and take shortest angular path',()=>{const{run}=fixture();run('cameraTransition({az:Math.PI*2-.1,el:.3,dist:250,x:50,y:150,z:20},600)');run('cameraTick(0,1/60)');near(run('dist'),500);run('cameraTick(300,1/60)');near(run('az'),-.05);near(run('dist'),Math.sqrt(500*250));run('cameraTick(600,1/60)');near(run('dist'),250);near(run('tgt.y'),150);assert.equal(run('camGoal'),null);near(run('cameraEase(0)'),0);near(run('cameraEase(1)'),1);assert.ok(run('cameraEase(.001)')<1e-7)});
test('manual takeover freezes all axes and prevents a later camera return',()=>{const{run}=fixture();run('camHome=camNow();cameraTransition({az:1,el:.3,dist:250,x:50,y:150,z:20});cameraTick(200,.016)');const before=run('JSON.stringify(camNow())');run('camRelease();moveViewOff();cameraTick(2000,.016)');assert.equal(run('JSON.stringify(camNow())'),before);assert.equal(run('camHome'),null)});
const viewDom={$:()=>({getBoundingClientRect:()=>({width:1200,height:800}),classList:{contains:()=>false}}),document:{documentElement:{},querySelector:()=>null}};
test('repeated zoom accumulates intent and converges monotonically with bounded travel',()=>{const{run}=fixture(1200,viewDom);run('sceneBounds=()=>({x:0,z:0,w:200,d:60,h:200})');run('cameraZoom(1/1.2);cameraZoom(1/1.2)');near(run('zoomTarget'),500/1.44);let previous=500;for(let n=0;n<100;n++){run('cameraTick(0,1/60)');let current=run('dist');assert.ok(current<=previous&&current>=500/1.44-1e-6);previous=current}near(previous,500/1.44);run('cameraZoom(.000001)');near(run('zoomTarget'),120);run('cameraZoom(1e10)');near(run('zoomTarget'),run('fittedCamera(az,el,1.05,{x:0,z:0,w:360,d:220,h:200}).dist*1.5'),'zooming out stops a little beyond the whole scene')});
test('zooming out with the buttons or wheel ends on the middle of the whole scene, from wherever the view was',()=>{
 const{run}=fixture(1200,viewDom);run('sceneBounds=()=>({x:40,z:10,w:300,d:60,h:220});tgt.set(160,40,-120);tgtY=40;dist=300;panned=true');
 const whole=run('overview=fittedCamera(az,el,1.05,{x:40,z:10,w:460,d:220,h:220});overview.dist');
 for(let n=0;n<30&&run('dist')<whole;n++){run('cameraZoom(1.2)');for(let k=0;k<200;k++)run('cameraTick(0,1/60)')}
 assert.ok(run('dist')>=whole,'zoomed out far enough to see everything');
 near(run('tgt.x'),40);near(run('tgt.z'),10);near(run('tgt.y'),110);
});
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

test('on a phone, choosing something already in view leaves the camera where it is; a tiny fitting is brought closer, and a panel resizing keeps that flight',t=>{
 const previous=global.getComputedStyle;
 global.getComputedStyle=()=>({getPropertyValue:()=> '0'});
 t.after(()=>{global.getComputedStyle=previous});
 let height=640;
 const THREE=require('three'),{run,time}=fixture(390,{$:()=>({getBoundingClientRect:()=>({left:0,top:0,right:390,bottom:height,width:390,height})}),document:{documentElement:{}}});
 const cam=new THREE.PerspectiveCamera(35,390/640,5,50000);
 const aim=()=>{const s=JSON.parse(run('JSON.stringify({az,el,dist,x:tgt.x,y:tgt.y,z:tgt.z})'));cam.position.set(s.x+s.dist*Math.cos(s.el)*Math.sin(s.az),s.y+s.dist*Math.sin(s.el),s.z+s.dist*Math.cos(s.el)*Math.cos(s.az));cam.lookAt(s.x,s.y,s.z);};
 // The 200 cm wardrobe fills about 70% of the usable view from 900 cm: a workable size.
 run('az=.4;el=.3;dist=900;tgt.set(0,100,0);S.item=-1;S.divider=-1');run('this').cam=cam;aim();
 const before=run('JSON.stringify(camNow())');run('frameMobileInspector(true)');
 assert.equal(run('camGoal'),null,'the wardrobe is in view at a workable size: no move');assert.equal(run('JSON.stringify(camNow())'),before);
 run('S.item=0;S.sel=0;itemGeom=()=>({x0:80,x1:120,y0:20,y1:40,w:40,h:20});dist=4000');aim();
 run('frameMobileInspector(true);savedGoal=camGoal');
 assert.ok(run('camGoal')&&run('camGoal.dist')<4000,'a fitting seen tiny is brought closer');near(run('camGoal.y'),30);
 near(run('camGoal.az'),.4);near(run('camGoal.el'),.3);
 time(100);run('cameraTick(100,1/60)');height=520;run('frameMobileInspector(true,true)');
 assert.equal(run('camGoal===savedGoal'),true,'a panel resizing keeps the flight under way');
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

test('drawer resizing uses the new canvas dimensions even before its DOM rectangle catches up',()=>{
 const THREE=require('three'),cam=new THREE.PerspectiveCamera(35,375/812,5,50000);
 const camera=createCameraController({dom:{},resources:{cam,cv:{getBoundingClientRect:()=>({width:375,height:812})}},cameraState:{vs:0,vz:1}});
 for(const size of [{width:375,height:406},{width:844,height:195},{width:1440,height:900}]) {
  camera.applyView(size);
  near(cam.aspect,size.width/size.height);
  near(cam.projectionMatrix.elements[5]/cam.projectionMatrix.elements[0],size.width/size.height);
 }
});
