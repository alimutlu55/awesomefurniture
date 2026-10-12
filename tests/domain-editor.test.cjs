const {test}=require('node:test');
const assert=require('node:assert/strict');
const state=()=>({w:200,h:230,d:60,n:2,wt:[100,100,100,100,100,100],secs:[[{k:'drawer',h:22}],[{k:'drawer',h:22}]],dividers:[],sel:0,item:0,profile:{longDrop:160,reach:185,allowLift:false,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}},fin:'Oak',doors:'none'});
test('domain geometry checks movement without browser or changing the design',async()=>{
 const {createWardrobeGeometry}=await import('../src/domain/geometry/wardrobe-geometry.js');
 const design=state(),before=structuredClone(design),rules=createWardrobeGeometry(()=>design);
 const plan=rules.planItemMove({i:0,j:0},1,1);
 assert.equal(plan.valid,true);assert.deepEqual(design,before);
 design.dividers=[{i:1,orientation:'vertical',x:30,y0:0,y1:218.4}];
 assert.equal(rules.planItemMove({i:0,j:0},1,1).valid,false);
});
test('cabinet collision rules use explicit scene inputs and stop tunnelling',async()=>{
 const {createCabinetGeometry}=await import('../src/domain/geometry/cabinet-geometry.js');
 const cabinets=[{id:1,x:0,y:0,z:0,angle:0,state:state()},{id:2,x:250,y:0,z:0,angle:0,state:state()}];
 const geometry=createCabinetGeometry(()=>cabinets),pose=geometry.safeCabinetTranslation(cabinets[0],{x:1000,y:0,z:0});
 assert.ok(pose.x<=50);assert.ok(pose.x>49.9);assert.equal(cabinets[0].x,0);
});
test('application resize command rejects overlaps without touching the design',async()=>{
 const {createDesignCommands}=await import('../src/application/commands/design-commands.js');
 const design=state();design.n=1;design.w=103.6;design.secs=[[{k:'drawer',h:22,w:50,x:0,y:0},{k:'drawer',h:22,w:50,x:50,y:0}]];
 const commands=createDesignCommands(()=>design),before=structuredClone(design);
 const geometry=(await import('../src/domain/geometry/wardrobe-geometry.js')).createWardrobeGeometry(()=>design);
 const g=geometry.itemGeom(0,0);
 assert.equal(commands.applyItemEdgeSize({g,edge:'right',index:0,section:0,layout:geometry.computeLayout(0),original:design.secs[0]},{w:60,x:0}),false);
 assert.deepEqual(design,before);
});
test('application commands add shelves and fittings in free spaces without a DOM',async()=>{
 const {createDesignCommands}=await import('../src/application/commands/design-commands.js');
 const design=state();design.n=1;design.secs=[[],[],[],[],[],[]];design.item=-1;
 const events=[],commands=createDesignCommands(()=>design,{report:m=>events.push(m)});
 commands.addSpaceDivider();assert.equal(design.dividers.length,1);
 commands.addShelfBoard();assert.equal(design.dividers.length,2);
 assert.equal(design.dividers[1].orientation,'horizontal');
 commands.addMod('drawer');assert.equal(design.secs[0].length,1);
 assert.equal(design.secs[0][0].k,'drawer');assert.equal(design.item,-1);
 assert.ok(!events.includes('Drawer added'));
});
test('application commands clamp reachable height and keep accessibility rules',async()=>{
 const {createDesignCommands}=await import('../src/application/commands/design-commands.js');
 const design=state(),commands=createDesignCommands(()=>design);
 assert.equal(commands.setWardrobeReach(999),true);assert.equal(design.profile.reach,210);
 design.profile.accessible=true;
 assert.equal(commands.setWardrobeReach(150),false);assert.equal(design.profile.reach,210);
});
test('scene history commits a whole gesture once, bounds undo and clears redo on edits',async()=>{
 const {createSceneHistory}=await import('../src/application/history/scene-history.js');
 let scene='a';const history=createSceneHistory(()=>scene,s=>scene=s,2);
 history.checkpoint();scene='b';history.checkpoint();scene='c';history.checkpoint();scene='d';
 assert.equal(history.undoCount,2);assert.equal(history.undo(),true);assert.equal(scene,'c');
 assert.equal(history.undo(),true);assert.equal(scene,'b');assert.equal(history.undo(),false);
 assert.equal(history.redo(),true);assert.equal(scene,'c');
 history.checkpoint();scene='e';assert.equal(history.redoCount,0);
});
test('scene commands duplicate independent cabinets and reject collision on resize',async()=>{
 const {createSceneCommands}=await import('../src/application/commands/scene-commands.js');
 const initial=state();initial.divider=-1;initial.space=null;
 const scene={wardrobes:[{id:1,name:'Bedroom',x:0,y:0,z:0,angle:90,state:initial}],activeWardrobe:1,nextWardrobeId:2};
 const commands=createSceneCommands(()=>scene,{initialDesign:()=>structuredClone(initial)});
 const copy=commands.addCabinet(true);assert.equal(copy.angle,90);copy.state.secs[0][0].h=30;
 assert.equal(initial.secs[0][0].h,22);assert.equal(scene.activeWardrobe,2);
 copy.angle=0;copy.x=200;scene.wardrobes[0].angle=0;
 assert.equal(commands.setCabinetSize('w',300),false);assert.equal(copy.state.w,200);
 assert.equal(commands.removeCabinet(),copy.name);assert.equal(scene.wardrobes.length,1);
 assert.equal(commands.removeCabinet(),'Bedroom');assert.equal(scene.wardrobes.length,0);
 assert.equal(commands.removeCabinet(),false);
});
test('item property commands refuse overlap and restore every layout property',async()=>{
 const {createDesignCommands}=await import('../src/application/commands/design-commands.js');
 const design=state();design.n=1;design.w=103.6;design.secs=[[{k:'drawer',h:22,w:50,x:0,y:0},{k:'drawer',h:22,w:50,x:50,y:0}]];
 const commands=createDesignCommands(()=>design),before=structuredClone(design.secs);
 assert.equal(commands.editItem(0,0,{fullWidth:true}),false);assert.deepEqual(design.secs,before);
 assert.equal(commands.editItem(0,0,{finish:'Walnut'}),true);assert.equal(design.secs[0][0].f,'Walnut');
});
test('live cabinet size previews enforce collisions without recording history',async()=>{
 const {createSceneCommands}=await import('../src/application/commands/scene-commands.js');
 const scene={wardrobes:[{id:1,x:0,y:0,z:0,angle:0,state:state()},{id:2,x:230,y:0,z:0,angle:0,state:state()}],activeWardrobe:1,nextWardrobeId:3};
 let checkpoints=0;const commands=createSceneCommands(()=>scene,{checkpoint:()=>checkpoints++});
 assert.equal(commands.setCabinetSize('h',240,false),true);assert.equal(scene.wardrobes[0].state.h,240);
 assert.equal(commands.setCabinetSize('w',300,false),false);assert.equal(scene.wardrobes[0].state.w,200);
 assert.equal(checkpoints,0);
 assert.equal(commands.setCabinetSize('h',250),true);assert.equal(checkpoints,1);
 assert.equal(commands.setCabinetSize('h',250),false);assert.equal(checkpoints,1);
});
test('camera module can animate a view using presentation ports without mounting the editor',async()=>{
 const THREE=await import('three');
 const {createCameraController}=await import('../src/presentation/viewport/camera-controller.js');
 const view={az:0,el:.1,dist:500,tgt:new THREE.Vector3(0,100,0),tgtY:100,vs:0,vsT:0,vz:1,vzT:1,camGoal:null,camHome:null,camRestore:null,zoomTarget:null,zoomAnchor:null,zoomFocus:null,reducedCameraMotion:{matches:true},activeCabinet:()=>({x:0,y:0,z:0,angle:0}),S:{w:200,h:200,d:60,item:-1,divider:-1},focusOn:false,inside:()=>false};
 Object.assign(view,createCameraController(require('./helpers/editor-fixture.cjs').dependencies(view)));
 view.cameraZoom(.5);assert.equal(view.dist,250);assert.equal(view.zoomTarget,null);
});
test('viewport lifetime cancels frames, timers, listeners and observers exactly once',async()=>{
 const {createEditorLifetime}=await import('../src/presentation/viewport/editor-lifetime.js');
 const frames=new Map(),timers=new Map(),cancelled=[],events=[];let next=0;
 const lifetime=createEditorLifetime({requestFrame:fn=>{frames.set(++next,fn);return next},cancelFrame:id=>cancelled.push(id),setTimer:fn=>{timers.set(++next,fn);return next},clearTimer:id=>cancelled.push(id)});
 const target={addEventListener:(...a)=>events.push(['add',...a]),removeEventListener:(...a)=>events.push(['remove',...a])};
 let work=0,disconnected=0;const handler=()=>work++;
 lifetime.listen(target,'change',handler);lifetime.observe({observe(){},disconnect(){disconnected++}},target,{});
 lifetime.frame(handler);lifetime.timeout(handler,5);lifetime.dispose();lifetime.dispose();
 frames.get(1)();timers.get(2)();assert.equal(work,0);assert.equal(disconnected,1);assert.deepEqual(cancelled,[1,2]);
 assert.equal(events[1][0],'remove');assert.equal(events[1][2],handler);
});
test('opening the planner schedules uncached ideas through its application service',async()=>{
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const originalDocument=global.document;let scheduled=0,focused=0;
 const classes=new Set();
 const sheet={dataset:{}};
 const elements={'#wizard':{hidden:true,querySelector:()=>sheet},'#app':{inert:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}},'#ideas-count':{},'#preferences-note':{},'#ideas':{setAttribute(){},querySelectorAll(){return[]}},'#close-wizard':{focus(){focused++}},'#launch-wizard':{focus(){}}};
 global.document={activeElement:null,querySelector:key=>elements[key]??(elements[key]={}),querySelectorAll:()=>[]};
 try{
  const ports={closeDD(){},hidePop(){},syncPreferences(){},$:key=>elements[key],plannerConfig:()=>({}),plannerService:{has:()=>false},lifetime:{cancelFrame(){},cancelTimeout(){},frame(){scheduled++;return 1}},openRaf:0,openTimer:null,ideasTimer:null};
  const presenter=createPlannerPresenter({dom:require('./helpers/dom-fixture.cjs').domFixture(), shell:ports,inspector:ports,geometry:ports,plannerState:ports,plannerService:ports.plannerService,lifetime:ports.lifetime,model:{activeCabinet:()=>({state:{profile:{needs:{},growth:15}}})}});presenter.openWizard();assert.equal(classes.has('auto-design-open'),true);assert.equal(sheet.dataset.sheetPosition,'full');assert.equal(elements['#wizard'].hidden,false);assert.equal(elements['#app'].inert,true);assert.equal(scheduled,1);assert.equal(focused,1);presenter.closeWizard();assert.equal(classes.has('auto-design-open'),false);assert.equal(elements['#wizard'].hidden,true);assert.equal(elements['#app'].inert,false);
 }finally{global.document=originalDocument}
});
test('cabinet reset retains the existing reach-line toggle just as the supplied editor did',async()=>{
 const {createSceneCommands}=await import('../src/application/commands/scene-commands.js');
 const {createEditorModel}=await import('../src/application/projects/editor-model.js');
 const model=createEditorModel();model.activeCabinet().state.reachLine=true;model.activeCabinet().state.w=250;
 const commands=createSceneCommands(()=>model.scene);assert.equal(commands.resetCabinet(),true);
 assert.equal(model.activeCabinet().state.w,200);assert.equal(model.activeCabinet().state.reachLine,true);
});
