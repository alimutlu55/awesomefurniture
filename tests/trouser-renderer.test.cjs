const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {buildTrouserGeometry,createTrouserRenderer}=require('../src/presentation/viewport/trouser-renderer.ts');
const {disposeCabinetGroup}=require('../src/presentation/viewport/render-disposal.ts');
const {GARMENT_COLOURS}=require('../src/presentation/viewport/fabric.ts');

test('folded trousers have separate tapered legs, real thickness, hems, and a rounded top fold',()=>{
 const geometry=buildTrouserGeometry(28,60);
 geometry.computeBoundingBox();
 assert.ok(geometry.boundingBox.min.y>=-60-1e-5);
 assert.ok(geometry.boundingBox.max.y>.8);
 assert.ok(geometry.boundingBox.max.z>.8&&geometry.boundingBox.min.z<-.8);
 const positions=geometry.getAttribute('position');
 const bottoms=[];
 for(let i=0;i<positions.count;i++)if(positions.getY(i)<-59.9)bottoms.push(positions.getX(i));
 assert.ok(bottoms.some(x=>x<0)&&bottoms.some(x=>x>0));
 assert.ok(bottoms.every(x=>Math.abs(x)>2),'a crotch gap separates the two hems');
 assert.deepEqual(geometry.groups.map(g=>g.materialIndex),[0,1]);
 geometry.dispose();
});

test('rack pairs share woven materials and geometry across rebuilds and release removed assets',()=>{
 const r=createTrouserRenderer(),parent=new THREE.Group();r.beginBuild();
 const rack=r.trouserPullOut(parent,0,80,0,60,44,60,9);r.endBuild();
 const pants=rack.children.filter(p=>p.name==='folded-trousers');
 assert.equal(pants.length,9);
 assert.equal(pants[0].geometry,pants[1].geometry);
 assert.equal(pants[4].material,pants[6].material,'matching colours share materials');
 assert.equal(rack.children.filter(p=>p.name==='trouser-rod').length,9);
 assert.equal(rack.children.filter(p=>p.name==='slide-runner').length,2);
 assert.equal(rack.children.filter(p=>p.name==='front-pull').length,1);
 pants.forEach((p,j)=>assert.equal(p.material[0].color.clone().convertLinearToSRGB().getHexString(),GARMENT_COLOURS[j%GARMENT_COLOURS.length].slice(1)));
 let freed=0;pants[0].geometry.addEventListener('dispose',()=>freed++);
 disposeCabinetGroup(parent,r.sharedMaterials,r.sharedGeometries);parent.clear();r.beginBuild();
 const rebuilt=r.trouserPullOut(parent,0,80,0,60,44,60,9);r.endBuild();
 assert.equal(rebuilt.children.find(p=>p.name==='folded-trousers').geometry,pants[0].geometry);
 assert.equal(freed,0);
 disposeCabinetGroup(parent,r.sharedMaterials,r.sharedGeometries);parent.clear();r.beginBuild();r.endBuild();
 assert.equal(freed,1);assert.equal(r.sharedGeometries.size,0);assert.equal(r.sharedMaterials.size,0);r.dispose();
});

test('a short trouser fitting rests above its support and uses the dedicated renderer',()=>{
 const {createFittingRenderer}=require('../src/presentation/viewport/fitting-renderer.ts');
 const calls=[],material=new THREE.MeshStandardMaterial();
 const r=createFittingRenderer({resources:{M:()=>material,wood:()=>material,shade:c=>c},mp:material,md:material,mh:material,
 h:230,d:60,box(){},group:new THREE.Group(),getRenderDesign:()=>({profile:{}}),garment(){},trouserPullOut:(...args)=>calls.push(args)});
 r.mod({k:'pants',h:55},0,20,60,true,false,[],[],[{x0:0,x1:60,rise:1.8}]);
 assert.equal(calls.length,1);
 const [, ,top,,width,depth,drop,count]=calls[0];
 assert.equal(width,60);assert.equal(depth,44);assert.equal(count,9);
 assert.ok(top-2-drop>=20+1.8,'hems remain clear of the supporting board');
 material.dispose();
});
