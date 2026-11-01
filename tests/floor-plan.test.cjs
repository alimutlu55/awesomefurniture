const { test } = require('node:test');
const assert = require('node:assert/strict');
const { drawPlanWall, wallPlanPolygon, millimetrePoint, clampPlanOpenings } = require('../src/domain/studio/floor-plan.ts');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { moveCorner, moveWall, addOpening, setWallLength } = require('../src/domain/studio/studio-edit.ts');
const { wallFace, wallLine } = require('../src/domain/studio/studio.ts');
const { studioProblems } = require('../src/domain/studio/studio-validation.ts');
const { createSceneHistory } = require('../src/application/history/scene-history.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject, deserializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
test('draw an irregular closed graph without duplicate corner nodes', () => {
 let r={template:'custom',corners:[],walls:[],openings:[]};
 const points=[{x:0,z:0},{x:400,z:0},{x:400,z:300},{x:180,z:230},{x:0,z:300},{x:0,z:0}];
 for(let i=1;i<points.length;i++) r=drawPlanWall(r,points[i-1],points[i],1);
 assert.equal(r.corners.length,5);assert.equal(r.walls.length,5);assert.deepEqual(studioProblems(r),[]);
 assert.equal(drawPlanWall(r,points[0],points[1],1),null);
 const next=moveCorner(r,r.corners[2].id,410.123,310.456);
 assert.deepEqual(next.corners[2],{...r.corners[2],x:410.1,z:310.5});
 assert.equal(next.walls.filter(w=>w.a===next.corners[2].id||w.b===next.corners[2].id).length,2);
});
test('wall polygons meet at the same inner miter and offsets keep graph connections', () => {
 const r=rectangleStudio(400,300);
 for(const w of r.walls){const poly=wallPlanPolygon(r,w), f=wallFace(r,w);assert.deepEqual(poly[0],f.from);assert.deepEqual(poly[1],f.to);}
 const next=moveWall(r,r.walls[0].id,10);assert.deepEqual(studioProblems(next),[]);
 assert.equal(next.corners.length,r.corners.length);
});
test('shortening a host clamps opening width and centre without losing handing', () => {
 let r=addOpening(rectangleStudio(400,300),'w1','door');
 r={...r,openings:r.openings.map(o=>({...o,hinge:'right',swing:'out'}))};
 const shortened=clampPlanOpenings(setWallLength(r,'w1',70));
 const o=shortened.openings[0], l=wallLine(shortened,shortened.walls[0]);
 assert.ok(o.offset-o.width/2>=5);assert.ok(o.offset+o.width/2<=l.length-5);
 assert.equal(o.hinge,'right');assert.equal(o.swing,'out');
});
test('millimetre coordinates and legacy projects roundtrip without graph migration or data loss', () => {
 assert.deepEqual(millimetrePoint({x:12.345,z:-9.876}),{x:12.3,z:-9.9});
 const project={...createProject('floor-plan','Room'),studio:rectangleStudio(400,300)};
 assert.deepEqual(deserializeProject(serializeProject(project)).studio,project.studio);
});
test('one gesture snapshot provides one undo and redo for the canonical graph', () => {
 let scene={studio:rectangleStudio(400,300),wardrobes:[{id:1,material:'keep',items:[{sku:'keep'}]}]};
 const snapshot=()=>JSON.stringify(scene), restore=s=>{scene=JSON.parse(s);};
 const history=createSceneHistory(snapshot,restore), before=snapshot();
 for(const d of [1,2,3]) scene.studio=moveWall(scene.studio,'w1',d);
 history.checkpoint(before);const after=snapshot();assert.equal(history.undoCount,1);
 history.undo();assert.equal(snapshot(),before);history.redo();assert.equal(snapshot(),after);
 assert.deepEqual(scene.wardrobes,[{id:1,material:'keep',items:[{sku:'keep'}]}]);
});
