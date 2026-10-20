const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createInspectorPresenter}=require('../src/presentation/editor/inspector-presenter.js');
const {createCameraController}=require('../src/presentation/viewport/camera-controller.js');
const {createCameraState}=require('../src/presentation/viewport/camera-state.ts');
const {createEditorState}=require('../src/application/projects/editor-state.ts');
const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
const {createCabinetGeometry}=require('../src/domain/geometry/cabinet-geometry.js');

function fixture(width=375,context) {
 let height=690,releases=0;
 const nodes=new Map();
 const $=id=>{
  if(!nodes.has(id)){
   const classes=new Set();
   nodes.set(id,{dataset:{},classList:{contains:k=>classes.has(k),add:(...ks)=>ks.forEach(k=>classes.add(k)),remove:(...ks)=>ks.forEach(k=>classes.delete(k))},
    getBoundingClientRect:()=>({width,height})});
  }
  return nodes.get(id);
 };
 const document={documentElement:{hasAttribute:()=>false},querySelector:s=>s==='#pop2.show'&&$('#pop2').classList.contains('show')?$('#pop2'):null,
  querySelectorAll:()=>['#pop2','#pop3','#pop4'].map($).filter(p=>p.classList.contains('show'))};
 const dom={width,$,document};
 $('#pop2').classList.add('show');if(context)$('#pop2').dataset.addContext=context;
 const state=createEditorState(),wardrobes=[{id:1,x:0,y:0,z:0,angle:0,state}];
 const model={scene:{wardrobes,activeWardrobe:1},activeCabinet:()=>wardrobes[0]};
 const geometry=createWardrobeGeometry(()=>state),cameraState=createCameraState({reducedMotion:{matches:true}});
 const camera=createCameraController({dom,model,geometry,cameraState,inspector:{layoutPop(){}},resources:{},renderState:{},interactionState:{},
  cabinetGeometry:createCabinetGeometry(()=>wardrobes),viewport:{resize(){}},clock:{now:()=>0}});
 const release=camera.camRelease;camera.camRelease=()=>{releases++;release();};
 const inspector=createInspectorPresenter({dom,model,geometry,cameraState,camera,studioPanel:{},elements:{},commands:{}});
 camera.resize();camera.frameMobileInspector();
 return {state,camera,cameraState,inspector,model,get releases(){return releases;},close(){inspector.hidePop();height=900;camera.resize();camera.cameraTick(2000,1/60);}};
}

for(const kind of ['drawer','short','shelf'])test(`mobile: adding ${kind} and closing the catalogue retains the camera pose`,()=>{
 const f=fixture(),commands=createDesignCommands(()=>f.state),before=f.camera.camNow();
 commands.addMod(kind);
 assert.ok(f.state.secs.flat().length||f.state.dividers.length,'The fitting was placed');
 f.close();
 assert.deepEqual(f.camera.camNow(),before,'Canvas growth must not refit the wardrobe or zoom out');
 assert.equal(f.releases,1);
});
for(const [width,context] of [[1440,undefined],[375,'wardrobe'],[375,'room']])test(`${width}px ${context??'fittings'}: existing desktop and scene-add framing is unchanged`,()=>{
 const f=fixture(width,context);f.close();assert.equal(f.releases,0);
});
