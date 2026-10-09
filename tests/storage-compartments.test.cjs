const {test}=require('node:test');const assert=require('node:assert/strict');
const {designAll}=require('../src/domain/planner/selection-planner.ts');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const {createSpaceModel}=require('../src/domain/planner/selection-spaces.ts');
const {MODS}=require('../src/domain/wardrobe/catalog.js');
const cfg={...require('./fixtures/planner-review-cases.cjs')[0][1],reach:180,needs:{short:24,long:6,pants:12,folded:30,shoes:0,small:30}};
test('automatic designs replace spacer fittings with bounded storage and report unused cabinet space',()=>{
 const plans=designAll(cfg).plans;assert.ok(plans.length,'retain a usable recommendation');
 for(const p of plans){
  for(const s of p.sections)for(const it of s.items){assert.notEqual(it.k,'void','a blank spacer is not a storage compartment');assert.ok(it.h<=MODS[it.k].mx+.01);}
  const spaces=createSpaceModel({...cfg,fixedSections:p.sections,fixedDividers:p.dividers}).spaces;
  if(spaces.some(sp=>sp.h>30&&sp.w>30))assert.ok(p.warnings.some(w=>w.startsWith('Unused cabinet space')), 'unused volume must be reported');
  assert.ok(p.metrics.valid);
 }
});
test('purpose constrains shelf height: a tall accessories bay cannot masquerade as a folded clothing shelf',()=>{
 const config={...cfg,w:63.6,upper:'none',needs:{short:0,long:0,pants:0,folded:6,shoes:0,small:0}};
 assert.equal(scoreLayout([{width:60,items:[{k:'shelf',purpose:'folded',h:60,x:0,y:0,w:60}]}],config).metrics.valid,false);
 assert.equal(scoreLayout([{width:60,items:[{k:'shelf',purpose:'accessories',h:60,x:0,y:0,w:60}]}],config).metrics.valid,true);
});
test('finishing retains a reachable remainder for search feedback without inventing accessory storage',()=>{
 const {finishStorageCompartments}=require('../src/domain/planner/storage-compartments.ts');
 const config={...cfg,w:63.6,h:120,reach:140,upper:'none',needs:{short:0,long:0,pants:0,folded:0,shoes:0,small:6}};
 const sections=[{width:60,items:[{k:'sdrawer',purpose:'small',h:12.8,x:0,y:0,w:60}]}];const before=structuredClone(sections);
 const finished=finishStorageCompartments(sections,[],config);
 assert.deepEqual(sections,before);assert.ok(finished[0].items.every(it=>it.purpose!=='accessories'));
 assert.ok(createSpaceModel({...config,fixedSections:finished}).spaces.some(sp=>sp.h>30));
 assert.equal(scoreLayout(finished,config).metrics.capacities.small,scoreLayout(sections,config).metrics.capacities.small);
 const fixed={...config,fixedSections:sections};assert.deepEqual(finishStorageCompartments(sections,[],fixed),sections);
});
test('tall upper remainders are split into bounded measured-box compartments',()=>{
 const {finishStorageCompartments}=require('../src/domain/planner/storage-compartments.ts');
 const config={...cfg,w:63.6,h:280,reach:185,upper:'fill'};
 const input=[{width:60,items:[{k:'seasonal',purpose:'seasonal',boxes:1,h:65,x:0,y:175.2,w:60}]}];
 const finished=finishStorageCompartments(input,[],config),uppers=finished[0].items.filter(it=>it.k==='seasonal');
 assert.equal(uppers.length,2);for(const it of uppers)assert.ok(it.h>=34&&it.h<=65);
 assert.ok(scoreLayout(finished,config).metrics.valid);
 assert.ok(createSpaceModel({...config,fixedSections:finished}).spaces.filter(sp=>sp.y>=1752).every(sp=>sp.h<=30||sp.w<=30));
});
