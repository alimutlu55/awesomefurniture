const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {createClothingWarmup}=require('../src/presentation/viewport/clothing-warmup.ts');
function fixture(shouldThrow=false){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,5,1000);
 camera.position.set(0,100,700);camera.lookAt(0,100,0);
 const initialScissor=new THREE.Vector4(12,16,200,300),renders=[];
 const renderer={outputEncoding:THREE.sRGBEncoding,shadowMap:{needsUpdate:true},scissor:initialScissor.clone(),scissorTest:false,
 getScissor:v=>v.copy(renderer.scissor),getScissorTest:()=>renderer.scissorTest,
 setScissor(a,b,c,d){renderer.scissor=a instanceof THREE.Vector4?a.clone():new THREE.Vector4(a,b,c,d)},
 setScissorTest(value){renderer.scissorTest=value},
 render(s,c){
  assert.equal(s,scene);assert.equal(c,camera);assert.deepEqual(renderer.scissor.toArray(),[0,0,16,16]);assert.equal(renderer.scissorTest,true);
  const samples=s.children.at(-1);renders.push(samples);
  if(shouldThrow)throw new Error('graphics failure');
 }};
 return {scene,camera,renderer,renders,initialScissor};
}
test('first-use preparation retains cloth, hardware and outline variants and restores the screen state',()=>{
 const f=fixture(),warm=createClothingWarmup(f.renderer,f.scene,f.camera,{});
 warm.prepare();warm.prepare();
 assert.equal(f.renders.length,1);assert.equal(f.scene.children.length,0);
 assert.deepEqual(f.renderer.scissor.toArray(),f.initialScissor.toArray());assert.equal(f.renderer.scissorTest,false);assert.equal(f.renderer.shadowMap.needsUpdate,true);
 const parts=f.renders[0].children;
 assert.equal(parts.length,5);
 assert.ok(parts[0].geometry.getAttribute('color'));assert.ok(parts[0].geometry.getAttribute('normal'));assert.ok(parts[0].geometry.getAttribute('uv'));
 assert.ok(parts[0].geometry.getAttribute('position').count>1000,'warm the real garment vertex layout');
 assert.ok(parts[0].material.isMeshPhysicalMaterial);assert.ok(parts[0].material.normalMap);assert.equal(parts[0].receiveShadow,true);
 assert.equal(parts[3].material.vertexColors,false);assert.equal(parts[3].material.side,THREE.FrontSide);
 assert.ok(parts[4].isLineSegments);
 let geometries=0,materials=0;
 parts[0].geometry.addEventListener('dispose',()=>geometries++);parts.forEach(p=>p.material.addEventListener('dispose',()=>materials++));
 assert.deepEqual([geometries,materials],[0,0],'retain prepared programs while the editor is open');
 warm.dispose();warm.dispose();assert.deepEqual([geometries,materials],[1,5]);
});
test('optional preparation restores the canvas state after a graphics failure',()=>{
 const f=fixture(true),warm=createClothingWarmup(f.renderer,f.scene,f.camera,{});
 assert.throws(()=>warm.prepare(),/graphics failure/);
 assert.equal(f.scene.children.length,0);assert.deepEqual(f.renderer.scissor.toArray(),f.initialScissor.toArray());assert.equal(f.renderer.scissorTest,false);
 warm.dispose();
});
test('disposing the editor before its scheduled preparation prevents resource allocation',()=>{
 const f=fixture(),warm=createClothingWarmup(f.renderer,f.scene,f.camera,{});
 warm.dispose();warm.prepare();assert.equal(f.renders.length,0);assert.equal(f.scene.children.length,0);
});
