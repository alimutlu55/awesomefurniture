const {test}=require('node:test');const assert=require('node:assert/strict');
const {upperShelfHeight,upperShelfSpaces}=require('../src/domain/planner/upper-shelf.ts');
const {finishStorageCompartments}=require('../src/domain/planner/storage-compartments.ts');
const {designAll}=require('../src/domain/planner/selection-planner.ts');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const cfg={w:187.2,h:230,d:60,reach:180,longDrop:160,growth:0,upper:'fill',needs:{short:0,long:12,pants:0,folded:12,shoes:0,small:0}};
test('finishing preserves a common upper line instead of lowering the middle shelf',()=>{
 const sections=[0,1,2].map(i=>({width:60,items:[i===1?{k:'folded',purpose:'folded',h:22.8,x:0,y:147.4,w:60}:{k:'long',purpose:'long',h:176.2,x:0,y:0,w:60},{k:'seasonal',purpose:'seasonal',boxes:1,h:42.2,x:0,y:176.2,w:60}]}));
 const before=structuredClone(sections),result=finishStorageCompartments(sections,[],cfg);
 assert.deepEqual(result.map(s=>s.items.find(it=>it.k==='seasonal').y),[176.2,176.2,176.2]);
 assert.ok(scoreLayout(result,cfg).metrics.valid);assert.deepEqual(sections,before);
});
test('datum accounts for reach, hanging rail clearance and measured boxes before planning',()=>{
 assert.equal(upperShelfHeight(cfg),1762);
 assert.equal(upperShelfHeight({...cfg,needs:{...cfg.needs,long:0},boxHeight:43}),1714);
 assert.equal(upperShelfHeight({...cfg,boxHeight:55}),undefined);
 assert.equal(upperShelfHeight({...cfg,boxHeight:43}),undefined,'do not shorten feasible long hanging to force a box band');
 assert.equal(upperShelfHeight({...cfg,upper:'none'}),undefined);
 assert.equal(upperShelfHeight({...cfg,fixedSections:[]}),undefined);
 const spaces=upperShelfSpaces([{bay:0,x:0,y:0,w:600,h:2184,depth:600}],cfg);
 assert.deepEqual(spaces.map(s=>[s.y,s.h]),[[0,1762],[1762,422]]);
});
test('shoe-dominant storage uses a reachable shelf line and preserves long garment clearance',()=>{
 const c=require('./fixtures/planner-review-cases.cjs').find(([name])=>name==='shoe-heavy')[1];
 assert.equal(upperShelfHeight(c),1752);
 const plans=designAll(c).plans;assert.ok(plans.length&&plans[0].complete);
 const {createSpaceModel}=require('../src/domain/planner/selection-spaces.ts');
 for(const p of plans)assert.deepEqual(createSpaceModel({...c,fixedSections:p.sections,fixedDividers:p.dividers}).spaces,[]);
 assert.ok(upperShelfHeight({...c,needs:{...c.needs,long:1},reach:180})>=1750,'long garments still require hook and hem clearance');
});
test('generated upper shelves share the preplanned line and no fitting crosses it',()=>{
 const cases=[{...cfg,w:200,needs:{short:24,long:6,pants:12,folded:30,shoes:0,small:30}}, {...cfg,w:200,needs:{...cfg.needs,long:0,folded:30}}, {...cfg,w:350,h:280,reach:210}, require('./fixtures/planner-review-cases.cjs').find(([name])=>name==='seated-with-lift')[1]];
 for(const c of cases){
  const datum=upperShelfHeight(c),plans=designAll(c).plans;assert.ok(plans.length);
  for(const p of plans){
   assert.ok(p.metrics.valid);
   const seasonal=p.sections.flatMap(s=>s.items.filter(it=>it.k==='seasonal'));
   assert.ok(seasonal.length>1);
   for(const it of p.sections.flatMap(s=>s.items))assert.ok(!((it.y??0)*10<datum-.1&&((it.y??0)+it.h)*10>datum+.1),`${it.k} crosses the common line`);
   // Each column's lowest seasonal shelf starts on the common line; tall
   // cabinets may additionally have another box tier above it.
   const columns=new Map();
   p.sections.forEach((s,i)=>s.items.filter(it=>it.k==='seasonal').forEach(it=>{const key=i+':'+it.x;columns.set(key,Math.min(columns.get(key)??Infinity,it.y*10));}));
   for(const y of columns.values())assert.ok(Math.abs(y-datum)<.1,`${y} != ${datum}`);
  }
 }
});

test('the shared line has a physical support board when daily reach leaves a gap beneath it',()=>{
 const {completeStorageEnvelope}=require('../src/domain/planner/storage-envelope.ts');
 const c={...cfg,w:63.6,needs:{...cfg.needs,long:0}};
 const sections=[{width:60,items:[{k:'folded',purpose:'folded',x:0,y:147.4,w:60,h:22.8},{k:'seasonal',purpose:'seasonal',boxes:1,x:0,y:176.2,w:60,h:42.2}]}];
 const result=completeStorageEnvelope(sections,[],c);
 assert.ok(result.dividers.some(d=>d.orientation==='horizontal'&&Math.abs(d.y+0.9-176.2)<.01&&d.x0===0&&d.x1===60));
 assert.ok(scoreLayout(result.sections,c,result.dividers).metrics.valid);
});
