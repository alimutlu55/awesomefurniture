const {test}=require('node:test');const assert=require('node:assert/strict');
test('disposing a rendered cabinet frees each resource once and preserves shared materials',()=>{
 const THREE=require('three');const {disposeCabinetGroup}=require('../src/presentation/viewport/render-disposal.ts');
 const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),shared=new THREE.MeshBasicMaterial();
 const unused=new THREE.MeshBasicMaterial();group.userData.ownedMaterials=[unused];let unusedDisposals=0;unused.dispose=()=>unusedDisposals++;
 let geometries=0,materials=0,sharedDisposals=0;geometry.dispose=()=>geometries++;material.dispose=()=>materials++;shared.dispose=()=>sharedDisposals++;
 group.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,[material,shared]));
 disposeCabinetGroup(group,new Set([shared]));assert.deepEqual([geometries,materials,sharedDisposals,unusedDisposals],[1,1,0,1]);
});
