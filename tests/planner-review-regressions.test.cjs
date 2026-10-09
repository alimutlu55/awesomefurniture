const {test}=require('node:test');const assert=require('node:assert/strict');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const cfg={w:125.4,h:230,d:60,reach:185,upper:'none',growth:0,needs:{short:0,long:0,pants:0,folded:6,shoes:0,small:0}};
test('daily demand is allocated by usability, so mirrored columns and reordered pinned items score equally',()=>{
 const sections=[{width:60,items:[{k:'folded',purpose:'folded',h:22.4,x:0,y:0,w:60}]},{width:60,items:[{k:'folded',purpose:'folded',h:22.4,x:0,y:80,w:60}]}];
 const forward=scoreLayout(sections,cfg),mirror=scoreLayout([...sections].reverse(),cfg);
 assert.equal(forward.metrics.valid,true);assert.equal(mirror.metrics.valid,true);
 assert.deepEqual(forward.breakdown,mirror.breakdown);assert.equal(forward.score,mirror.score);
 assert.equal(forward.breakdown.criteria.accessibility,.75,'allocate inventory to the prime shelf, retaining the deep-shelf penalty');
 const bay=[{width:60,items:[{...sections[0].items[0]},{...sections[1].items[0]}]}];
 const small={...cfg,w:63.6};assert.deepEqual(scoreLayout(bay,small).breakdown,scoreLayout([{...bay[0],items:[...bay[0].items].reverse()}],small).breakdown);
});
test('seasonal boxes do not increase daily accessibility',()=>{
 const single=[{width:60,items:[{k:'folded',purpose:'folded',h:22.4,x:0,y:80,w:60}]}];
 const boxes=structuredClone(single);boxes[0].items.push({k:'seasonal',purpose:'seasonal',h:33.8,x:0,y:180,w:60,boxes:1});
 const config={...cfg,w:63.6,upper:'fill'};
 assert.equal(scoreLayout(single,config).breakdown.criteria.accessibility,scoreLayout(boxes,config).breakdown.criteria.accessibility);
});
test('a spare-space specialist cannot improve its hero by abandoning a category served by the reference',()=>{
 const {selectSpecialists}=require('../src/domain/planner/selection-planner.ts');const {ARCHETYPES}=require('../src/domain/planner/design-archetypes.ts');
 const dna=spare=>({shares:{hang:1-spare,drawers:0,open:0,shoes:0,seasonal:0,spare},columns:3,widthPattern:[600,600,600],zones:Array.from({length:6},()=>[0,0,1,0,0])});
 const baseline={id:'base',archetype:'balanced',title:'base',score:90,complete:false,partCount:4,cost:100,metrics:{coverage:{total:.9,short:.9,long:1},capacities:{short:20,long:6}},breakdown:{criteria:{accessibility:.7,clearance:.7,utilisation:.7,grouping:.7,safety:.7,buildability:.7}},heroes:{accessibility:.7,drawerStorage:.4,openStorage:.4,hangingCapacity:.9,spareSpace:.1},dna:dna(.1),variations:[]};
 const empty={...baseline,id:'empty',archetype:'spare',score:80,dna:dna(.8),metrics:{coverage:{total:.7,short:0,long:0},capacities:{short:0,long:0}},heroes:{...baseline.heroes,spareSpace:.8}};
 assert.equal(selectSpecialists([baseline,empty],ARCHETYPES).length,1);
});
test('a usable wardrobe serves every requested category when the search finds such a candidate',()=>{
 const {designAll}=require('../src/domain/planner/selection-planner.ts');
 const cfg={w:200,h:230,d:60,reach:185,longDrop:160,growth:15,upper:'fill',drawers:'auto',density:'comfort',needs:{short:4,long:0,pants:2,folded:10,shoes:35,small:8}};
 const result=designAll(cfg);assert.ok(result.plans.length);
 for(const p of result.plans)for(const [k,n] of Object.entries(cfg.needs))if(n>0)assert.ok(p.metrics.capacities[k]>0,`${p.title} abandons ${k}`);
});
test('shallow cabinets retain a long-hang concept when all requested categories fit with existing front-facing rails',()=>{
 const {designAll}=require('../src/domain/planner/selection-planner.ts');
 const cfg=require('./fixtures/planner-review-cases.cjs').find(x=>x[0]==='shallow-front-facing')[1],width=(200-4*1.8)/3;
 const item=(k,purpose,h,y,front=false)=>({k,purpose,h,y,x:0,w:width,...(front?{front:true}:{})});
 const reference=[{width,items:[item('long','long',175,0,true)]},{width,items:[item('short','short',100,0,true),item('sdrawer','small',12.8,100)]},{width,items:[...Array.from({length:3},(_,i)=>item('shoe','shoes',19.2,i*19.2)),...Array.from({length:2},(_,i)=>item('folded','pants',22.4,57.6+i*22.4)),...Array.from({length:3},(_,i)=>item('folded','folded',22.4,102.4+i*22.4))]}];
 const proof=scoreLayout(reference,cfg);assert.ok(proof.metrics.valid);for(const v of Object.values(proof.breakdown.criteria))assert.ok(v>=.45);
 const plans=designAll(cfg).plans;assert.ok(plans.length);
 for(const p of plans)for(const [k,n] of Object.entries(cfg.needs))if(n>0)assert.ok(p.metrics.capacities[k]>0,`${p.title} omits feasible ${k}`);
});
test('no-design feedback distinguishes empty inventory, unsupported garment clearance and reach',()=>{
 const {noPlanExplanation}=require('../src/domain/planner/selection-planner.ts');
 assert.match(noPlanExplanation({...cfg,needs:{short:0,long:0,pants:0,folded:0,shoes:0,small:0}}),/Add clothing quantities/);
 assert.match(noPlanExplanation({...cfg,longDrop:185,needs:{long:12}}),/200 cm.*195 cm/);
 assert.match(noPlanExplanation({...cfg,longDrop:160,reach:122,accessible:true,needs:{long:6}}),/above your 122 cm reach/);
});
test('useful utilisation rewards planned capacity rather than filling the cabinet with redundant sock drawers',()=>{
 const cfg={w:63.6,h:230,d:60,reach:185,growth:15,upper:'none',needs:{short:0,long:0,pants:0,folded:0,shoes:0,small:30}};
 const sparse=[{width:60,items:[{k:'sdrawer',purpose:'small',h:12.8,x:0,y:80,w:60}]}];
 const overfilled=[{width:60,items:Array.from({length:9},(_,i)=>({k:'sdrawer',purpose:'small',h:12.8,x:0,y:i*12.8,w:60}))}];
 const a=scoreLayout(sparse,cfg),b=scoreLayout(overfilled,cfg);assert.ok(a.metrics.valid&&b.metrics.valid&&a.complete&&b.complete);
 assert.ok(a.breakdown.criteria.utilisation>=.45);assert.ok(a.breakdown.criteria.utilisation>b.breakdown.criteria.utilisation);
});
