const {test}=require('node:test');const assert=require('node:assert/strict');
const {completeStorageEnvelope,hasUnassignedCompartment}=require('../src/domain/planner/storage-envelope.ts');
const {createSpaceModel,mergeAdjacentSpaces}=require('../src/domain/planner/selection-spaces.ts');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const cfg={w:63.6,h:230,d:60,reach:185,growth:0,upper:'none',needs:{short:0,long:0,pants:0,folded:12,shoes:0,small:0}};
const input=[{width:60,items:[{k:'folded',purpose:'folded',h:22.8,x:0,y:0,w:60},{k:'folded',purpose:'folded',h:22.8,x:0,y:22.8,w:60}]}];
const usefulGaps=(p,c)=>mergeAdjacentSpaces(createSpaceModel({...c,fixedSections:p.sections,fixedDividers:p.dividers}).spaces).filter(g=>g.w>=250&&g.h>=150);
test('tall abandoned space becomes bounded adjustable storage without inventing possession capacity',()=>{
 const before=structuredClone(input),base=scoreLayout(input,cfg),p=completeStorageEnvelope(input,[],cfg),scored=scoreLayout(p.sections,cfg,p.dividers);
 assert.deepEqual(input,before);assert.ok(scored.metrics.valid);assert.deepEqual(scored.metrics.capacities,base.metrics.capacities);
 assert.equal(hasUnassignedCompartment(input,[],cfg),true);
 assert.equal(hasUnassignedCompartment(p.sections,p.dividers,cfg),false);
 assert.equal(usefulGaps(p,cfg).length,0);
 const reserve=p.sections.flatMap(s=>s.items.filter(it=>it.purpose==='reserve'));
 assert.ok(reserve.length>=4);assert.ok(reserve.every(it=>it.h>=15&&it.h<=40));
 assert.ok(scored.placements.filter(it=>it.reason.includes('No clothing')).length===reserve.length);
 assert.deepEqual(completeStorageEnvelope(p.sections,p.dividers,cfg),p);
});
test('wide empty bays receive supporting partitions and shelves within span limits',()=>{
 const wide={...cfg,w:153.6},p=completeStorageEnvelope([{width:150,items:[]}],[],wide);
 assert.ok(p.dividers.length);assert.ok(scoreLayout(p.sections,wide,p.dividers).metrics.valid);
 assert.equal(usefulGaps(p,wide).length,0);assert.ok(p.sections[0].items.every(it=>it.w<=80));
});
test('manual storage and boards remain exactly fixed',()=>{
 const board={i:0,orientation:'horizontal',x0:0,x1:60,y:80};
 const fixed={...cfg,fixedSections:input,fixedDividers:[board]};
 assert.deepEqual(completeStorageEnvelope(input,[board],fixed),{sections:input,dividers:[board]});
});
test('adjustable storage cannot bypass shelf geometry or masquerade as clothing',()=>{
 for(const item of [{k:'shelf',purpose:'reserve',h:80},{k:'short',purpose:'reserve',h:100}])assert.equal(scoreLayout([{width:60,items:[item]}],cfg).metrics.valid,false);
 const p=completeStorageEnvelope(input,[],cfg);assert.ok(p.sections[0].items.some(it=>it.purpose==='reserve'&&it.y+it.h+9.8>185));
 assert.equal(scoreLayout(p.sections,cfg,p.dividers).metrics.capacities.seasonalBoxes,0);
});
test('reported 200 cm layouts assign all shelf-sized gaps and retain usable clothing storage',()=>{
 const {designAll}=require('../src/domain/planner/selection-planner.ts');
 for(const [name,c] of require('./fixtures/planner-review-cases.cjs').filter(([n])=>['mixed-default','reported-no-shoes','reported-fold-only'].includes(n))){
  const plans=designAll(c).plans;assert.ok(plans.length,name);
  for(const p of plans){assert.ok(p.metrics.valid);assert.equal(usefulGaps(p,c).length,0,name+' '+p.title);}
 }
});
test('clothing moves toward the prime band instead of remaining below empty adjustable shelves',()=>{
 const demand={...cfg,needs:{...cfg.needs,folded:24}};
 const p=completeStorageEnvelope(input,[],demand);
 const before=scoreLayout(input,demand),after=scoreLayout(p.sections,demand,p.dividers);
 assert.ok(after.breakdown.criteria.accessibility>before.breakdown.criteria.accessibility);
 assert.ok(p.sections[0].items.filter(it=>it.purpose==='folded').some(it=>it.y>22.8));
});
test('adjustable storage survives application, save, and reopen',()=>{
 const {createEditorState}=require('../src/application/projects/editor-state.ts');
 const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
 const {createProject}=require('../src/domain/project/project.ts');
 const {sceneToProject,projectToScene}=require('../src/application/projects/editor-mapper.ts');
 const {serializeProject,deserializeProject}=require('../src/infrastructure/serialization/project-codec.ts');
 const state=createEditorState();Object.assign(state,{w:cfg.w,h:cfg.h,d:cfg.d});state.profile={...state.profile,reach:cfg.reach,growth:cfg.growth,upper:cfg.upper,needs:cfg.needs};
 const p=completeStorageEnvelope(input,[],cfg);
 createDesignCommands(()=>state).applyProposal({...p,title:'Purposeful storage',summary:'Clothing and adjustable storage'});
 const scene={wardrobes:[{id:1,name:'Test',x:0,y:0,z:0,angle:0,state}],activeWardrobe:1,nextWardrobeId:2};
 const reopened=projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('test','Test'),scene))));
 assert.deepEqual(reopened.wardrobes[0].state.secs,state.secs);
});

test('artificial slivers are joined before judging whether usable storage fits',()=>{
 const spaces=[{bay:0,x:0,y:0,w:500,h:100,depth:600},{bay:0,x:0,y:100,w:500,h:120,depth:600},{bay:0,x:518,y:0,w:300,h:220,depth:600}];
 const merged=mergeAdjacentSpaces(spaces);
 assert.equal(merged.length,2);assert.equal(merged[0].h,220);assert.equal(merged[1].x,518,'a divider gap must not be merged away');
 assert.equal(spaces[0].h,100);
});

test('finishing closes the reported 3 cm slit after upper support boards are placed',()=>{
 const c={...cfg,w:83.6,reach:180,upper:'auto',needs:{...cfg.needs,short:12}};
 const sections=[{width:80,items:[
  ...[0,23,46].map(y=>({k:'drawer',purpose:'folded',h:23,x:0,y,w:80})),
  {k:'short',purpose:'short',h:102.4,x:0,y:69,w:80},
  {k:'seasonal',purpose:'seasonal',boxes:2,h:42.2,x:0,y:176.2,w:80}
 ]}];
 const before=structuredClone(sections),capacity=scoreLayout(sections,c).metrics.capacities;
 const p=completeStorageEnvelope(sections,[],c);
 assert.ok(p.dividers.some(d=>d.orientation==='horizontal'),'the upper shelf still needs its support');
 assert.deepEqual(createSpaceModel({...c,fixedSections:p.sections,fixedDividers:p.dividers}).spaces,[]);
 assert.ok(scoreLayout(p.sections,c,p.dividers).metrics.valid);
 assert.deepEqual(scoreLayout(p.sections,c,p.dividers).metrics.capacities,capacity);
 assert.deepEqual(sections,before);
 assert.deepEqual(completeStorageEnvelope(p.sections,p.dividers,c),p);
});

test('the final gate detects small slits and narrow strips, excluding actual boards',()=>{
 const c={...cfg,h:111.6}; // 100 cm clear interior
 for(const item of [
  {k:'shelf',purpose:'reserve',x:0,y:0,w:60,h:97},
  {k:'shelf',purpose:'reserve',x:0,y:0,w:58,h:100}
 ])assert.equal(hasUnassignedCompartment([{width:60,items:[item]}],[],c),true);
 const sections=[{width:60,items:[{k:'short',purpose:'short',x:0,y:0,w:60,h:98.2}]}];
 const boards=[{i:0,orientation:'horizontal',x0:0,x1:60,y:99.1}];
 assert.equal(hasUnassignedCompartment(sections,boards,c),false);
 assert.equal(hasUnassignedCompartment(input,[],{...cfg,fixedSections:input}),false);
});

test('every recommendation for the screenshot inventory fills the complete interior',()=>{
 const {selectStorageLayouts}=require('../src/domain/planner/selection-planner.ts');
 const c={w:200,h:230,d:60,reach:180,jackets:6,coats:0,needs:{short:24,long:6,pants:12,folded:30,shoes:0,small:30}};
 const plans=selectStorageLayouts(c);assert.ok(plans.length);
 assert.ok(plans[0].complete,'closing gaps must not sacrifice inventory coverage');
 for(const p of plans){
  assert.ok(p.metrics.valid);
  assert.deepEqual(createSpaceModel({...c,fixedSections:p.sections,fixedDividers:p.dividers}).spaces,[]);
 }
});
