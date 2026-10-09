const {test}=require('node:test');const assert=require('node:assert/strict');
const config={w:200,h:230,d:60,reach:185,longDrop:160,growth:15,upper:'fill',drawers:'auto',density:'comfort',needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
test('DNA ignores mirrored column order and sub-pitch shelf changes but separates drawers from shelves',()=>{
 const {layoutDNA,dnaDistance}=require('../src/domain/planner/layout-dna.ts');
 const a=[{width:60,items:[{k:'short',purpose:'short',h:100,y:70}]},{width:60,items:[{k:'drawer',purpose:'folded',h:30,y:50}]}];
 const b=structuredClone(a).reverse();b[0].items[0].h+=1;
 assert.ok(dnaDistance(layoutDNA(a,config),layoutDNA(b,config))<.01);
 assert.equal(dnaDistance(layoutDNA(a,config),layoutDNA([...a].reverse(),config)),0);
 const drawers=[{width:60,items:[{k:'drawer',purpose:'folded',h:100,y:40}]}],shelves=[{width:60,items:[{k:'folded',purpose:'folded',h:100,y:40}]}];
 assert.ok(dnaDistance(layoutDNA(drawers,config),layoutDNA(shelves,config))>=.2);
});
test('specialists require a 15% hero advantage, all floors and DNA distance; siblings become variations',()=>{
 const {selectSpecialists}=require('../src/domain/planner/selection-planner.ts');const {ARCHETYPES}=require('../src/domain/planner/design-archetypes.ts');
 const dna=(kind)=>({shares:{hang:0,drawers:kind==='drawers'?1:0,open:kind==='open'?1:0,shoes:0,seasonal:0,spare:kind==='spare'?1:0},columns:3,widthPattern:[600,600,600],zones:Array.from({length:6},()=>[0,0,1,0,0])});
 const base={id:'base',archetype:'balanced',score:90,complete:true,partCount:4,cost:100,metrics:{coverage:{total:1},capacities:{folded:20,small:6}},breakdown:{criteria:{accessibility:.6,clearance:.7,utilisation:.7,grouping:.7,safety:.7,buildability:.7}},heroes:{accessibility:.6,drawerStorage:.4,openStorage:.4,hangingCapacity:.6,spareSpace:.2},dna:dna('open'),variations:[]};
 const drawer={...base,id:'drawer',archetype:'drawers',score:80,dna:dna('drawers'),heroes:{...base.heroes,drawerStorage:.8}};
 const sibling={...drawer,id:'sibling',score:75};
 const noWin={...base,id:'daily',archetype:'daily',heroes:{...base.heroes,accessibility:.65}};
 const lowFloor={...base,id:'spare',archetype:'spare',dna:dna('spare'),heroes:{...base.heroes,spareSpace:1},breakdown:{criteria:{...base.breakdown.criteria,safety:.3}}};
 const shown=selectSpecialists([base,drawer,sibling,noWin,lowFloor],ARCHETYPES);
 assert.equal(shown.length,2);assert.equal(shown[0].score,90);assert.equal(shown[1].archetype,'drawers');assert.equal(shown[1].comparison.margin,1);
 assert.ok(shown[1].variations.length);assert.match(shown[0].selectionNote,/less than 15%|quality floors/);
});
test('five inventory envelopes show only defensible structurally distinct hero winners',()=>{
 const {designAll}=require('../src/domain/planner/selection-planner.ts');const {dnaDistance,DNA_THRESHOLD}=require('../src/domain/planner/layout-dna.ts');
 const {ARCHETYPES}=require('../src/domain/planner/design-archetypes.ts');
 const fixtures=[
  {...config,needs:{short:6,long:0,pants:10,folded:70,shoes:2,small:30}},
  {...config,h:260,reach:210,needs:{short:40,long:8,pants:4,folded:8,shoes:2,small:10}},
  {...config,needs:{short:4,long:0,pants:2,folded:10,shoes:35,small:8}},
  {...config,w:80,h:180,reach:150},
  {...config,w:350,h:280,reach:210},
 ];
 let specialists=0;
 for(const cfg of fixtures){const {plans,pool}=designAll(cfg);
  // The new full-assignment rule rejects this cabinet's 28.2 cm upper gap:
  // its measured boxes require 34 cm, and it is above daily reach.
  if(!plans.length){assert.equal(pool.length,0);assert.match(require('../src/domain/planner/selection-planner.ts').noPlanExplanation(cfg),/compartment|listed storage needs|reach|clear hanging height/);continue;}
  assert.ok(plans.length>=1&&plans.length<=4);assert.ok(pool.length);
  const complete=pool.filter(p=>p.complete),referencePool=complete.length?complete:pool;assert.equal(plans[0].score,require('../src/domain/planner/selection-search.ts').rankStoragePlans(referencePool)[0].score);
  for(const [i,p] of plans.entries()){assert.ok(p.metrics.valid);for(const v of Object.values(p.breakdown.criteria))assert.ok(v>=.45);for(const q of plans.slice(0,i))assert.ok(dnaDistance(p.dna,q.dna)>=DNA_THRESHOLD-1e-9);
   if(i){specialists++;assert.ok(p.comparison.margin>=.15-1e-9);const strategy=ARCHETYPES.find(a=>a.id===p.archetype);for(const v of Object.values(p.breakdown.criteria))assert.ok(v>=strategy.floor);assert.ok(strategy.gate(p.sections));}
  }
  if(plans.length<4)assert.ok(plans[0].selectionNote);
 }
 assert.ok(specialists>0,'search must reach at least one useful specialist corner, not only suppress cards');
});
