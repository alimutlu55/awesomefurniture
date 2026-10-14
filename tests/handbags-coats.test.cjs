const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {createFittingRenderer}=require('../src/presentation/viewport/fitting-renderer.ts');
const {createHandbagRenderer,HANDBAG_COLOURS}=require('../src/presentation/viewport/handbag-renderer.ts');
const {createGarmentRenderer}=require('../src/presentation/viewport/garment-renderer.ts');
const {GARMENT_COLOURS}=require('../src/presentation/viewport/fabric.ts');
const {disposeCabinetGroup}=require('../src/presentation/viewport/render-disposal.ts');
function fitting(garment=()=>{},handbag){
 const material=new THREE.MeshStandardMaterial(),group=new THREE.Group();
 const ports={resources:{M:c=>new THREE.MeshStandardMaterial({color:c}),wood:()=>material,shade:c=>c},mp:material,md:material,mh:material,
 h:300,d:60,box(){},geometry:{isBoxed:()=>false},group,getRenderDesign:()=>({profile:{longDrop:150}}),garment,handbag};
 return {renderer:createFittingRenderer(ports),group};
}
test('both rail orientations use coats for long hanging and shirts for short hanging',()=>{
 for(const front of [false,true])for(const k of ['short','long','lift']){
  const calls=[],f=fitting((...args)=>calls.push(args));
  f.renderer.mod({k,h:k==='long'?170:106,front},0,10,90);
  assert.ok(calls.length);
  for(const args of calls){assert.equal(args[7],k==='long'?'coat':'shirt');assert.equal(args[6],front);}
  calls.forEach((args,j)=>assert.equal(args[5],GARMENT_COLOURS[j%GARMENT_COLOURS.length]));
 }
});
test('shirt and coat patterns coexist with distinct cached geometry and fabric',()=>{
 const state={Gr:new THREE.Group(),garments:[]},r=createGarmentRenderer({renderState:state});
 r.garment(0,100,0,160,46.4,'#4c5872',false,'shirt');
 r.garment(10,100,0,160,46.4,'#4c5872',false,'coat');
 const [shirt,coat]=state.garments;
 assert.equal(shirt.sp.key,'shirt');assert.equal(coat.sp.key,'coat');
 assert.equal(shirt.sp.len,78);assert.equal(coat.sp.len,140);
 assert.equal(coat.sp.ty.collar,'lapel');assert.equal(coat.sp.ty.pocket,'flap');
 assert.notEqual(shirt.pivot.children[0].geometry,coat.pivot.children[0].geometry);
 assert.notEqual(shirt.pivot.children[0].material,coat.pivot.children[0].material);
 assert.equal(coat.sp.sleeve,62,'lengthening the body keeps sleeves at their natural length');
 r.garment(20,100,0,145,46.4,'#4c5872',false,'coat');
 const fitted=state.garments[2];
 assert.equal(fitted.sp.len,135.5,'shorter compartments fit a coat within the requested 130–140 cm range');
 const geometry=fitted.pivot.children[0].geometry;geometry.computeBoundingBox();
 assert.ok(-geometry.boundingBox.min.y+7.5<=145-2,'hem keeps its clearance below the hook');
 r.dispose();
});
test('handbags share detailed geometry across dimensions, colours and rebuilds without exceeding their storage size',()=>{
 const r=createHandbagRenderer(),group=new THREE.Group();
 r.beginBuild();
 const a=r.handbag(group,0,10,0,31,23,14,HANDBAG_COLOURS[0]);
 const b=r.handbag(group,40,10,0,31,23,14,HANDBAG_COLOURS[1]);
 r.endBuild();
 assert.equal(a.children.length,3,'one mesh per material limits draw calls');
 assert.equal(r.sharedGeometries.size,3);
 assert.equal(a.children[0].geometry,b.children[0].geometry);
 assert.notEqual(a.children[0].material,b.children[0].material);
 group.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(a),size=bounds.getSize(new THREE.Vector3());
 assert.ok(bounds.min.y>=10-1e-5);assert.ok(size.x<=31&&size.y<=23&&size.z<=14);
 let freed=0;a.children[0].geometry.addEventListener('dispose',()=>freed++);
 disposeCabinetGroup(group,r.sharedMaterials,r.sharedGeometries);group.clear();r.beginBuild();
 const resized=r.handbag(group,0,0,0,31,23,8,HANDBAG_COLOURS[0]);r.endBuild();
 assert.equal(resized.children[0].geometry,a.children[0].geometry);assert.equal(freed,0);
 disposeCabinetGroup(group,r.sharedMaterials,r.sharedGeometries);group.clear();r.beginBuild();r.endBuild();
 assert.equal(freed,1);assert.equal(r.sharedMaterials.size,0);assert.equal(r.sharedGeometries.size,0);
 r.dispose();
});
test('handbag shelves use the detailed renderer and omit bags that would intersect a shaped top',()=>{
 const calls=[],f=fitting(undefined,(...args)=>calls.push(args));
 const item={k:'shelf',purpose:'handbags',h:25};
 f.renderer.mod(item,0,10,105);
 assert.equal(calls.length,3);
 calls.forEach(args=>{assert.equal(args[0],f.group);assert.equal(args[4],31);assert.equal(args[5],23);assert.ok(HANDBAG_COLOURS.includes(args[7]));});
 calls.length=0;
 f.renderer.mod(item,0,10,100,true,false,[],[],[],300,{core:{x0:0,x1:100,h:25},slab(){},clearAt:()=>30});
 assert.equal(calls.length,0,'23 cm bags beginning at 10 cm cannot clear a 30 cm top');
});
