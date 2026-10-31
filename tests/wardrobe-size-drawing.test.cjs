const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEditorModel}=require('../src/application/projects/editor-model.ts');
const {createEditorState}=require('../src/application/projects/editor-state.ts');
const {createSceneCommands}=require('../src/application/commands/scene-commands.ts');
const {createWardrobeSizeBackend}=require('../src/presentation/editor/wardrobe-size-backend.ts');
const {createShapeSession}=require('../src/presentation/editor/surface-shape-session.ts');
const {applyShapeField}=require('../src/presentation/editor/surface-shape-fields.ts');
const {addPoint,stepEdge}=require('../src/domain/geometry/profile-polygon.ts');
const {wardrobeDrawingRoof}=require('../src/domain/wardrobe/shape/size-drawing-profile.ts');
function fixture(){
 const model=createEditorModel({wardrobes:[{id:1,name:'Wardrobe',x:0,y:0,z:0,angle:0,state:createEditorState()}],activeWardrobe:1,nextWardrobeId:2});
 const checkpoints=[],messages=[];
 const history={checkpoint:s=>checkpoints.push(s)};
 const commands=createSceneCommands(()=>model.scene,{checkpoint:()=>history.checkpoint(model.snapshot()),report:m=>messages.push(m)});
 const backend=createWardrobeSizeBackend({model,sceneCommands:commands,history,rebuild(){},report:m=>messages.push(m)});
 const callbacks={redraw(){},rebuild(){},refresh(){}};
 const session=createShapeSession({model,sceneCommands:commands,history,callbacks,backend});
 const ref={kind:'wall',id:'wardrobe:1'};
 return{model,commands,backend,session,ref,checkpoints,messages,state:()=>model.activeCabinet().state,read:view=>backend.read(ref,view)};
}
test('wardrobes expose front/side drawings and compact dimension fields through the shared backend',()=>{
 const f=fixture();
 assert.equal(f.read().points.length,4);
 assert.deepEqual(f.backend.fields(f.read(),f.read().points,null).map(x=>x.label),['Width','Height','Depth','From the floor']);
 const side=f.read('side');assert.equal(side.points[1].x,f.state().d);
 assert.deepEqual(f.backend.fields(side,side.points,null).map(x=>x.label),['Depth','Height','From the floor']);
});
test('typed drawing width, height, depth and floor position apply through validated commands with one undo each',()=>{
 const f=fixture();
 for(const [key,value] of [['width',220],['height',210],['floor',15]]){
  const s=f.read(),next=applyShapeField(s,s.points,null,key,value),before=f.model.snapshot();
  assert.ok(next);assert.equal(f.backend.write(f.ref,next,'front'),true,key);
  assert.equal(f.checkpoints.at(-1),before);
  if(key==='width')assert.equal(f.state().w,value);
  if(key==='height')assert.equal(f.state().h,value);
  if(key==='floor')assert.equal(f.model.activeCabinet().y,value);
 }
 const s=f.read();assert.equal(f.backend.field('depth',70,s,null),true);assert.equal(f.state().d,70);
 assert.equal(f.checkpoints.length,4);
});
test('front edge points and steps are editable and side slopes preserve front/rear geometry',()=>{
 const f=fixture(),s=f.read(),point=addPoint(s.points,2);assert.ok(point);
 assert.equal(f.backend.write(f.ref,point.points,'front'),true);
 assert.equal(f.state().shape.top.length,3);
 const current=f.read(),step=stepEdge(current.points,2,current.bounds);assert.ok(step);
 assert.equal(f.backend.write(f.ref,step.points,'front'),true);
 assert.ok(f.state().shape.top.length>3);
 const side=f.read('side'),sloped=side.points.map((p,i)=>i===3?{...p,y:p.y-20}:p);
 assert.equal(f.backend.write(f.ref,sloped,'side'),true);
 assert.ok(f.state().shape.back.some((y,i)=>y!==f.state().shape.top[i].y));
});
test('drawing previews do not accumulate changes, reject invalid geometry atomically and commit one undo step',()=>{
 const f=fixture(),before=f.model.snapshot(),s=f.read();assert.equal(f.session.begin(f.ref,'front'),true);
 for(const width of [220,240,210])assert.equal(f.session.preview(applyShapeField(s,s.points,null,'width',width)),true);
 assert.equal(f.state().w,210);assert.equal(f.checkpoints.length,0);
 const valid=f.model.snapshot();assert.equal(f.session.preview(s.points.map((p,i)=>i===0?{...p,y:10}:p)),false);
 assert.equal(f.model.snapshot(),valid);
 f.session.end();assert.equal(f.state().w,210);assert.deepEqual(f.checkpoints,[before]);
 f.model.restore(f.checkpoints[0]);assert.equal(f.model.snapshot(),before);
});
test('cancelling drawing edits restores size, shape, furniture position and fittings',()=>{
 const f=fixture(),before=f.model.snapshot(),s=f.read();f.session.begin(f.ref,'front');
 f.session.preview(applyShapeField(s,s.points,null,'width',220));f.session.cancel();
 assert.equal(f.model.snapshot(),before);assert.equal(f.checkpoints.length,0);
});
test('invalid bases and excessive dimensions cannot silently deform or clamp a wardrobe',()=>{
 const f=fixture(),s=f.read(),before=f.model.snapshot();
 assert.equal(wardrobeDrawingRoof(s.points.map((p,i)=>i===0?{...p,y:10}:p)),null);
 assert.equal(f.backend.write(f.ref,applyShapeField(s,s.points,null,'width',700),'front'),false);
 assert.equal(f.backend.field('depth',200,s,null),false);
 assert.equal(f.model.snapshot(),before);assert.equal(f.checkpoints.length,0);
});
