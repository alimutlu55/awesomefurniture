const {test}=require('node:test');
const assert=require('node:assert/strict');
const cfg={w:200,h:230,d:60,reach:185,longDrop:160,growth:15,upper:'fill',drawers:'auto',density:'comfort',jackets:6,coats:2,allowLift:false,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
const engine=()=>require('../src/domain/planner/selection-planner.ts');
test('space selection produces deterministic distinct explainable plans with existing fitting kinds',()=>{
 const {selectStorageLayouts}=engine();
 const before=structuredClone(cfg),plans=selectStorageLayouts(cfg);
 assert.ok(plans.length>=1&&plans.length<=4);assert.deepEqual(selectStorageLayouts(cfg),plans);assert.deepEqual(cfg,before);
 const kinds=new Set(Object.keys(require('../src/domain/wardrobe/catalog.js').MODS));
 for(const p of plans){assert.ok(p.score>=0&&p.score<=100);assert.equal(p.metrics.valid,true);assert.equal(Object.keys(p.breakdown.criteria).length,6);assert.ok(p.placements.length);for(const s of p.sections)for(const it of s.items)assert.ok(kinds.has(it.k));}
 assert.equal(new Set(plans.map(p=>p.structureKey)).size,plans.length);
});
test('coverage is a ranking gate even when a partial layout has a higher weighted score',()=>{
 const {rankStoragePlans}=engine();
 const complete={complete:true,score:40,partCount:8,positionSum:100,structureKey:'a',id:'a'};
 const partial={complete:false,score:99,partCount:2,positionSum:50,structureKey:'b',id:'b'};
 assert.equal(rankStoragePlans([partial,complete])[0],complete);
});
test('saved growth and item catalog drive demand without replacing user inputs',()=>{
 const {buildDemand}=require('../src/domain/planner/selection-config.ts');
 assert.equal(buildDemand(cfg).short,28);
 assert.equal(buildDemand({...cfg,growth:0}).short,24);
 assert.equal(buildDemand({...cfg,growth:20,composition:'storage'}).short,29);
});
test('space geometry subtracts pinned fittings and boards without moving them',()=>{
 const {createSpaceModel}=require('../src/domain/planner/selection-spaces.ts');
 const pinned={k:'drawer',purpose:'folded',h:26,x:0,y:64,w:60,id:'kept'};
 const fixed={...cfg,w:63.6,fixedSections:[{width:60,items:[pinned]}],fixedDividers:[{i:0,orientation:'horizontal',x0:0,x1:60,y:120}]};
 const model=createSpaceModel(fixed);assert.deepEqual(model.sections[0].items,[pinned]);
 for(const s of model.spaces){assert.ok(!(s.x<600&&s.x+s.w>0&&s.y<900&&s.y+s.h>640));assert.ok(!(s.y<1209&&s.y+s.h>1191));}
});
test('selected and manually edited layouts use the same normalized scoring and gates',()=>{
 const {selectStorageLayouts}=engine();const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
 const p=selectStorageLayouts({...cfg,w:140})[0];assert.ok(p);
 const score=scoreLayout(p.sections,{...cfg,w:140},p.dividers);
 assert.equal(p.score,score.score);assert.deepEqual(p.breakdown,score.breakdown);
 const overwide=[{width:130,items:[{k:'folded',purpose:'folded',h:30}]}];
 assert.equal(scoreLayout(overwide,{...cfg,w:133.6}).metrics.valid,false);
});
test('hard reach gates and lift opt-in are preserved, impossible demand reports partial shortfalls',()=>{
 const {selectStorageLayouts}=engine();
 for(const options of [{w:100,h:180,reach:150},{accessible:true,reach:122,allowLift:false},{d:40},{upper:'none'}]){
  const config={...cfg,...options};for(const p of selectStorageLayouts(config)){assert.equal(p.metrics.valid,true);if(!config.allowLift)assert.ok(p.sections.every(s=>s.items.every(it=>it.k!=='lift')));if(config.upper==='none')assert.ok(p.sections.every(s=>s.items.every(it=>it.k!=='seasonal')));}
 }
 const plans=selectStorageLayouts({...cfg,w:100,needs:{...cfg.needs,short:150}});
 if(plans.length){assert.equal(plans[0].complete,false);assert.ok(plans[0].metrics.shortfalls.some(s=>s.key==='short'));assert.match(plans[0].summary,/Partial/);}else assert.equal(engine().designAll({...cfg,w:100,needs:{...cfg.needs,short:150}}).pool.length,0);
});
test('fixed items and dividers survive selection exactly, and proposals never mutate input',()=>{
 const pin={id:'fixed',k:'drawer',purpose:'folded',h:26,x:0,y:64,w:60,f:'Walnut'};
 const board={i:0,orientation:'horizontal',x0:0,x1:60,y:120};
 const config={...cfg,w:63.6,fixedSections:[{width:60,items:[pin]}],fixedDividers:[board],needs:{short:0,long:0,pants:0,folded:12,shoes:2,small:6}};
 const before=structuredClone(config),plans=engine().selectStorageLayouts(config);
 assert.ok(plans.length);
 for(const p of plans){assert.deepEqual(p.sections[0].items.find(it=>it.id==='fixed'),pin);assert.ok(p.dividers.some(d=>JSON.stringify(d)===JSON.stringify(board)));assert.equal(p.metrics.valid,true);}
 assert.deepEqual(config,before);
});
test('reachable small inventory is complete and detailed scoring is normalized with the specified weights',()=>{
 // A 110 cm cabinet can serve this jacket-heavy inventory without invented spare compartments.
 const p=engine().selectStorageLayouts({...cfg,w:110,needs:{short:10,long:0,pants:0,folded:12,shoes:2,small:6}})[0];
 assert.equal(p.complete,true);assert.equal(p.metrics.shortfalls.length,0);
 assert.deepEqual(p.breakdown.weights,{accessibility:.30,clearance:.20,utilisation:.15,grouping:.15,safety:.10,buildability:.10});
 for(const value of Object.values(p.breakdown.criteria))assert.ok(value>=0&&value<=1);
 const expected=Math.round(Object.entries(p.breakdown.criteria).reduce((n,[k,v])=>n+v*p.breakdown.weights[k],0)*10000)/100;
 assert.equal(p.score,expected);assert.ok(p.boards.length);assert.ok(p.boards.every(b=>b.reason&&b.size.w>0&&b.size.h>0));
});
test('sliding a fitting outside its bay fails a hard gate rather than being silently clamped',()=>{
 const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
 const bad=[{width:60,items:[{k:'drawer',purpose:'folded',h:26,x:-2,y:0,w:60}]}];
 assert.equal(scoreLayout(bad,{...cfg,w:63.6}).metrics.valid,false);
});
test('diversity rejects mirrored duplicates and box-only variations',()=>{
 const {structureKey}=engine();
 const a=[{width:50,items:[{k:'short',purpose:'short',h:100},{k:'seasonal',purpose:'seasonal',h:40}]},{width:60,items:[{k:'folded',purpose:'folded',h:30}]}];
 assert.equal(structureKey(a),structureKey([...a].reverse()));
 const withoutBoxes=structuredClone(a);withoutBoxes[0].items.pop();assert.equal(structureKey(a),structureKey(withoutBoxes));
});

test('screenshot inventory returns valid distinct plans and recovers unreserved daily gaps',()=>{
 const config={...cfg,needs:{...cfg.needs,shoes:0}};
 const {createSpaceModel}=require('../src/domain/planner/selection-spaces.ts');
 const {modulesFor}=require('../src/domain/planner/selection-modules.ts');
 const {buildDemand}=require('../src/domain/planner/selection-config.ts');
 const plans=engine().selectStorageLayouts(config);assert.ok(plans.length>=1&&plans.length<=4);
 for(const p of plans){
  assert.equal(p.metrics.valid,true);
  if(['spare','daily'].includes(p.archetype))continue;
  const spaces=createSpaceModel({...config,fixedSections:p.sections.map(s=>({...s,items:s.items.filter(it=>it.k!=='void')})),fixedDividers:p.dividers}).spaces;
  for(const sp of spaces){
   if(sp.y+98>=config.reach*10||sp.w<250||sp.h<220)continue;
   const {strategyModules,ARCHETYPES,conceptAllows}=require('../src/domain/planner/design-archetypes.ts');
   const demand=buildDemand(config),unmet=Object.fromEntries(Object.entries(demand).map(([k,n])=>[k,Math.max(0,n-(p.metrics.capacities[k]??0))]));
   const candidates=strategyModules(modulesFor(sp,unmet,config,0),ARCHETYPES.find(a=>a.id===p.archetype),config).filter(m=>conceptAllows(m.items,p.conceptRoles[sp.bay]));
   if(p.partCount>=40)continue;
   assert.equal(candidates.length,0,`usable empty gap ${JSON.stringify(sp)} in ${p.id}`);
  }

 }
});
