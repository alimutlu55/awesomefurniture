const {test}=require('node:test');const assert=require('node:assert/strict');
const cfg={w:63.6,h:230,d:60,reach:185,upper:'none',growth:0,needs:{short:0,long:0,pants:0,folded:6,shoes:0,small:0}};
test('an unrequested accessory shelf cannot improve useful utilisation',()=>{
 const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
 const items=[{k:'folded',purpose:'folded',h:22.4,x:0,y:80,w:60}];
 const base=scoreLayout([{width:60,items}],cfg);
 const filler=scoreLayout([{width:60,items:[...items,{k:'shelf',purpose:'accessories',h:60,x:0,y:0,w:60}]}],cfg);
 assert.ok(base.metrics.valid&&filler.metrics.valid);assert.ok(filler.breakdown.criteria.utilisation<base.breakdown.criteria.utilisation,'unused shelving must feed back as a design cost');
});
test('recovery does not add duplicate folded shelves after the inventory plus growth is served',()=>{
 const {recoverStorageSpace}=require('../src/domain/planner/selection-recovery.ts');
 const sections=[{width:60,items:[{k:'folded',purpose:'folded',h:22.4,x:0,y:80,w:60}]}];
 const recovered=recoverStorageSpace(sections,[],cfg);
 assert.equal(recovered.sections[0].items.length,1,'do not disguise a leftover rectangle with redundant shelves');
});
test('finishing never invents accessory inventory to satisfy the compartment assignment gate',()=>{
 const {finishStorageCompartments,unassignedSpaceWarnings}=require('../src/domain/planner/storage-compartments.ts');
 const items=[{width:60,items:[{k:'folded',purpose:'folded',h:22.4,x:0,y:80,w:60}]}];
 const result=finishStorageCompartments(items,[],cfg);
 assert.ok(result.every(s=>s.items.every(it=>it.purpose!=='accessories')));
 assert.ok(unassignedSpaceWarnings(result,[],cfg).length,'unresolved space must feed back instead of becoming a fake storage demand');
});

test('oversized cabinets receive explicit adjustable storage beyond the counted inventory',()=>{
 const {designAll,noPlanExplanation}=require('../src/domain/planner/selection-planner.ts');
 const options={...cfg,w:200,growth:15,upper:'fill',needs:{short:10,long:0,pants:0,folded:12,shoes:2,small:6}};
 const larger=designAll(options).plans;assert.ok(larger.some(p=>p.complete));
 for(const p of larger)assert.ok(p.sections.every(s=>s.items.every(it=>it.purpose!=='accessories')));
 assert.ok(larger.some(p=>p.sections.some(s=>s.items.some(it=>it.purpose==='reserve'))));
 const {createSpaceModel}=require('../src/domain/planner/selection-spaces.ts');
 for(const p of larger)assert.ok(createSpaceModel({...options,fixedSections:p.sections,fixedDividers:p.dividers}).spaces.every(g=>g.w<250||g.h<150));
 const compact=designAll({...options,w:100}).plans;assert.ok(compact.some(p=>p.complete));
 for(const p of compact){assert.notEqual(p.archetype,'spare');assert.ok(p.sections.every(s=>s.items.every(it=>it.purpose!=='accessories')));}
});
test('reported fold-only inventory receives complete recommendations without filler shelves',()=>{
 const {designAll}=require('../src/domain/planner/selection-planner.ts');
 const options={...cfg,w:200,growth:15,upper:'fill',reach:185,needs:{short:0,long:0,pants:12,folded:30,shoes:0,small:30}};
 const before=structuredClone(options),plans=designAll(options).plans;
 assert.ok(plans.length,'the inventory is feasible even when it does not occupy every cabinet rectangle');
 for(const p of plans){assert.ok(p.complete);assert.ok(p.sections.every(s=>s.items.every(it=>it.purpose!=='accessories'&&it.k!=='void')));for(const key of ['pants','folded','small'])assert.ok(p.metrics.capacities[key]>=Math.ceil(options.needs[key]*1.15));}
 assert.deepEqual(options,before);
});
