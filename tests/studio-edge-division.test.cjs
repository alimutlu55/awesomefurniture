const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rectangleStudio}=require('../src/domain/studio/studio-templates.ts');
const {addCeiling,CEILING_SHAPES,ceilingAt}=require('../src/domain/studio/studio-ceiling.ts');
const {studioSolid,studioBoundaryEdges,divideStudioBoundary,moveStudioControl,studioSolidProblems}=require('../src/domain/studio/studio-solid.ts');
const {controlPoint,locationPoint}=require('../src/domain/geometry/profile-solid.ts');
const {createStudioBoundaryCursor,activateBoundary,boundaryHandles}=require('../src/presentation/editor/studio-boundary-cursor.ts');
const {ceilingHandles}=require('../src/presentation/editor/studio-ceiling-drag.ts');
const {roomRenderFixture}=require('./helpers/room-render-fixture.cjs');
const {sceneToProject,projectToScene}=require('../src/application/projects/editor-mapper.ts');
const {createProject}=require('../src/domain/project/project.ts');
const {parseProject,serializeProject,deserializeProject}=require('../src/infrastructure/serialization/project-codec.ts');
const {profileSolidGeometry}=require('../src/presentation/viewport/profile-solid-geometry.ts');
const {moveCeilingPoint,liftCeiling}=require('../src/domain/studio/studio-ceiling.ts');
const {solidHeightAt}=require('../src/domain/geometry/profile-solid.ts');
const THREE=require('three');
const screen=p=>({x:p.x+p.z*.4,y:-p.y+p.z*.3});
const mix=(a,b,f)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

for(const shape of CEILING_SHAPES) test(`${shape.name}: every boundary edge supports a single planar control, including inner/rear/depth edges`,()=>{
 const room=addCeiling(rectangleStudio(400,300),'w1',shape.id),selection={kind:'ceiling',id:room.ceilings[0].id};
 const original=studioSolid(room,selection),initial=JSON.stringify(room);
 for(const edge of studioBoundaryEdges(room,selection)) for(const fraction of [.2137,.5,.8129]){
  const at=edge.location.through?{...edge.location,u:edge.location.u+(edge.location.fraction-edge.location.u)*fraction,fraction:0}:{...edge.location,fraction};
  const divided=divideStudioBoundary(room,selection,at),model=studioSolid(divided,selection);
  assert.deepEqual(studioSolidProblems(divided,selection),[],edge.key);
  assert.equal(model.shape.controls.length,original.shape.controls.length+1,edge.key);
  const control=model.shape.controls.at(-1),point=controlPoint(model.shape,control);
  assert.ok(distance(model.at(point,control.u),mix(edge.a,edge.b,fraction))<1e-7,edge.key);
  const geometry=profileSolidGeometry(model.shape,100);assert.ok(geometry.attributes.position.count>0);geometry.dispose();
  // At least one small move in the existing edit plane must reshape this part independently.
  let moved;
  for(const [dt,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){
   const next=moveStudioControl(divided,selection,control.id,point.t+dt,point.y+dy);
   if(!studioSolidProblems(next,selection).length){moved=next;break;}
  }
  assert.ok(moved,'cannot move added control on '+edge.key);
  const changed=studioSolid(moved,selection),after=controlPoint(changed.shape,control);
  assert.notDeepEqual(after,point);
  assert.equal(changed.shape.controls.length,model.shape.controls.length,'moving never creates another dot');
  assert.equal(changed.shape.controls.at(-1).u,control.u,'ordinary point editing stays in its 2D plane');
  for(const prior of original.shape.controls) assert.deepEqual(controlPoint(changed.shape,prior),controlPoint(original.shape,prior),'other controls stay put');
  const document=sceneToProject(createProject('division','Division'),{studio:moved,wardrobes:[],activeWardrobe:0,nextWardrobeId:1});
  assert.equal(document.schemaVersion,2);assert.deepEqual(projectToScene(deserializeProject(serializeProject(document))).studio,moved);
  assert.throws(()=>parseProject({...document,schemaVersion:1}),/version 2/);
 }
 assert.equal(JSON.stringify(room),initial,'insertion and dragging do not mutate their origin');
});

test('wall boundaries include openings and preserve default floor-corner handles',t=>{
 const f=roomRenderFixture(t,{wardrobes:0});f.selectionState.room={kind:'wall',id:'w1'};
 const before=f.editor.handles(),dots=before.filter(h=>h.kind==='corner'||h.kind==='shape-point');
 assert.equal(dots.length,2);assert.equal(before.filter(h=>h.kind==='wall-split').length,1);
 const h=before.find(h=>h.kind==='wall-split'),original=f.model.snapshot();f.editor.click(h);
 assert.equal(f.editor.handles().filter(h=>h.kind==='corner'||h.kind==='shape-point').length,3);
 const dot=f.editor.handles().find(h=>h.kind==='shape-point');f.editor.begin(f.event(),dot,f.nodes.c);
 f.editor.move(f.event('mouse',0,20));f.editor.end();
 assert.equal(f.editor.handles().filter(h=>h.kind==='shape-point').length,1);
 assert.equal(f.checkpoints.length,2);f.history.undo();f.history.undo();assert.equal(f.model.snapshot(),original);
});

for(const width of [375,1280]) test(`${width}px: moving the plus to a vertical inner edge activates there and drags the same point`,t=>{
 const f=roomRenderFixture(t,{width,wardrobes:0});
 f.model.scene.studio.ceilings[0].profile=[{t:6,y:205},{t:176,y:205},{t:176,y:100},{t:406,y:100}];f.renderer.build();
 const room=f.model.scene.studio,selection={kind:'ceiling',id:'k1'},edge=studioBoundaryEdges(room,selection).find(e=>e.location.u===1&&!e.location.through&&e.a.y!==e.b.y&&Math.abs(e.a.x-e.b.x)<1e-6);
 const original=f.model.snapshot(),h=f.editor.handles().find(h=>h.kind==='ceiling-split');
 const from=screen(h),target=screen(mix(edge.a,edge.b,.42381));
 f.editor.begin(f.event(),h,f.nodes.c);f.editor.move(f.event('touch',target.x-from.x,target.y-from.y));f.editor.end();
 const placed=f.editor.handles().find(h=>h.kind==='ceiling-split');
 assert.ok(distance(placed,mix(edge.a,edge.b,.42381))<1e-6);assert.equal(f.model.snapshot(),original);assert.equal(f.checkpoints.length,0);
 f.editor.click(placed);
 let dot=f.editor.handles().find(h=>h.kind==='shape-point'&&h.control.startsWith('cut'));
 assert.ok(distance(dot,placed)<1e-6,'the point appears where the plus was placed');
 f.editor.begin(f.event(),dot,f.nodes.c);f.editor.move(f.event('touch',-20,0));f.editor.end();
 const moved=f.editor.handles().find(h=>h.key===dot.key);assert.notEqual(moved.x,dot.x);
 assert.equal(f.editor.handles().filter(h=>h.kind==='shape-point').length,5);
 assert.equal(f.checkpoints.length,2);f.history.undo();f.history.undo();f.renderer.build();assert.equal(f.model.snapshot(),original);
});

test('the cursor reaches arbitrary physical positions without changing geometry or adding undo entries',()=>{
 const room=addCeiling(rectangleStudio(400,300),'w1','landing'),selection={kind:'ceiling',id:'k1'},original=JSON.stringify(room);
 const cursor=createStudioBoundaryCursor(screen),fallback=ceilingHandles(room,room.ceilings[0]).find(h=>h.kind==='ceiling-split');
 for(const edge of studioBoundaryEdges(room,selection)){
  cursor.clear();const h=cursor.handle(room,selection,fallback),target=mix(edge.a,edge.b,.371234567),a=screen(h),b=screen(target);
  cursor.move(room,h,b.x-a.x,b.y-a.y);const placed=cursor.handle(room,selection,fallback);
  assert.ok(distance(placed,target)<1e-5,edge.key);
  const result=activateBoundary(room,placed);assert.ok(result);assert.deepEqual(studioSolidProblems(result,selection),[]);
 }
 assert.equal(JSON.stringify(room),original);
});

test('unchanged shapes retain their original dot and resize handle counts',()=>{
 for(const shape of CEILING_SHAPES){
  const room=addCeiling(rectangleStudio(400,300),'w1',shape.id),selection={kind:'ceiling',id:'k1'};
  const old=ceilingHandles(room,room.ceilings[0]),next=boundaryHandles(room,selection,createStudioBoundaryCursor(screen));
  assert.deepEqual(next.filter(h=>h.kind!=='ceiling-split'),old.filter(h=>h.kind!=='ceiling-split'));
 }
});

test('a new cut at an already controlled corner reuses that control',()=>{
 const room=addCeiling(rectangleStudio(400,300),'w1','box'),selection={kind:'ceiling',id:'k1'},before=studioSolid(room,selection);
 const next=divideStudioBoundary(room,selection,{loop:0,edge:0,u:0,fraction:0}),after=studioSolid(next,selection);
 assert.equal(after.shape.controls.length,before.shape.controls.length);assert.equal(after.shape.controls[0].u,0);
 assert.equal(after.shape.rings[0].points.length,before.shape.rings[0].points.length);
 const p=after.at(controlPoint(after.shape,after.shape.controls[0]),0);assert.equal(ceilingAt(next,p),after.shape.rings[0].points[0].y);
});

test('existing slope endpoints retain their original reshaping and fixed roof after adding other boundary points',()=>{
 const room=addCeiling(rectangleStudio(400,300),'w1','slope'),selection={kind:'ceiling',id:'k1'},base=studioSolid(room,selection);
 const divided=divideStudioBoundary(room,selection,{loop:0,edge:2,u:1,fraction:.4});
 const ceiling=room.ceilings[0],t=ceiling.profile[1].t;
 const original=moveCeilingPoint(room,'k1',1,t,240),edited=moveCeilingPoint(divided,'k1',1,t,240);
 assert.deepEqual(studioSolidProblems(edited,selection),[]);
 for(let n=0;n<=30;n++)for(const u of [.01,.3,.5,.8,.99]){
  const p=base.at({t:t*n/30,y:0},u);
  assert.ok(Math.abs(ceilingAt(original,p)-ceilingAt(edited,p))<1e-6);
 }
 const lifted=liftCeiling(divided,'k1',-10);assert.deepEqual(studioSolidProblems(lifted,selection),[]);
 assert.equal(lifted.ceilings[0].profile[1].y,250);
 assert.ok(studioSolid(lifted,selection).shape.rings[0].points.some(p=>p.y===260),'the original roof remains attached');
});

test('physical ceiling heights agree with the actual triangulated mesh after an independent depth-section edit',()=>{
 let room=addCeiling(rectangleStudio(400,300),'w1','landing');const selection={kind:'ceiling',id:'k1'};
 room=divideStudioBoundary(room,selection,{loop:0,edge:1,u:.37,fraction:0,through:true});
 let solid=studioSolid(room,selection),control=solid.shape.controls.at(-1),p=controlPoint(solid.shape,control);
 room=moveStudioControl(room,selection,control.id,p.t+8,p.y-12);solid=studioSolid(room,selection);
 const geometry=profileSolidGeometry(solid.shape,100),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateMatrixWorld();
 for(const u of [.05,.2,.36,.5,.8,.98])for(let t=solid.minT+1;t<solid.maxT;t+=7){
  const ray=new THREE.Raycaster(new THREE.Vector3(t,0,u*100),new THREE.Vector3(0,1,0));
  const hit=ray.intersectObject(mesh)[0],height=solidHeightAt(solid.shape,t,u);
  if(hit)assert.ok(Math.abs(hit.point.y-height)<.001);else assert.equal(height,null);
 }
 geometry.dispose();mesh.material.dispose();
});
