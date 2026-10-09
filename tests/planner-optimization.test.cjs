const {test}=require('node:test');
const assert=require('node:assert/strict');
const {designAll,selectSpecialists}=require('../src/domain/planner/selection-planner.ts');
const {modulesFor}=require('../src/domain/planner/selection-modules.ts');
const base={w:80,h:180,d:60,reach:150,growth:0,upper:'none',needs:{short:0,long:0,pants:0,folded:0,shoes:0,small:0}};
test('Best Overall prioritizes coverage among partial layouts',()=>{
 const plan={id:'a',complete:false,score:90,partCount:2,positionSum:0,archetype:'balanced',metrics:{coverage:{total:.5}},heroes:{},dna:require('../src/domain/planner/layout-dna.ts').layoutDNA([],base),variations:[]};
 const better={...plan,id:'b',score:70,metrics:{coverage:{total:.9}}};
 assert.equal(selectSpecialists([plan,better],[])[0].score,70);
});
test('overfull inventory receives a physically valid partial recommendation with explicit quality tradeoffs',()=>{
 const cfg={...base,needs:{...base.needs,folded:1000}},before=structuredClone(cfg);
 const plans=designAll(cfg).plans;
 assert.ok(plans.length);
 assert.ok(plans[0].metrics.valid);
 assert.equal(plans[0].complete,false);
 assert.ok(plans[0].metrics.capacities.folded>=58);
 assert.match(plans[0].warnings.join(' '),/quality targets/i);
 assert.deepEqual(cfg,before);
});
test('reachable shoe storage remains a candidate outside its preferred comfort band',()=>{
 const cfg={...base,reach:185,needs:{...base.needs,shoes:20}};
 const options=modulesFor({bay:0,x:0,y:1450,w:600,h:300,depth:600},cfg.needs,cfg,0);
 assert.ok(options.some(m=>m.capacity.shoes>0),'comfort is a preference, not a physical impossibility');
});
test('folded candidates include the tight height supplying six layers with hand clearance',()=>{
 const cfg={...base,needs:{...base.needs,folded:12},density:'comfort'};
 const options=modulesFor({bay:0,x:0,y:0,w:600,h:228,depth:600},cfg.needs,cfg,0);
 assert.ok(options.some(m=>m.capacity.folded===12&&m.height<=228),'22.4 cm gives only five layers; 22.8 cm holds six');
});
test('no usable inventory capacity still produces no recommendation',()=>{
 assert.equal(designAll({...base,w:28.6,needs:{...base.needs,shoes:1}}).plans.length,0);
 assert.equal(designAll(base).plans.length,0);
});

test('tight fitting search preserves the useful seated lift path',()=>{
 const cfg=require('./fixtures/planner-review-cases.cjs').find(([name])=>name==='seated-with-lift')[1];
 const {plans,pool}=designAll(cfg);
 assert.ok(plans[0].metrics.coverage.total>=.8758,'additional candidates must not crowd out the established lift solution');
 assert.equal(new Set(pool.map(p=>p.id)).size,pool.length);
});
test('shoe-heavy inventory fits completely without filler and still applies valid geometry',()=>{
 const cfg=require('./fixtures/planner-review-cases.cjs').find(([name])=>name==='shoe-heavy')[1];
 const p=designAll(cfg).plans[0];
 assert.ok(p.complete);
 assert.ok(p.metrics.valid);
 assert.ok(p.sections.every(s=>s.items.every(it=>it.k!=='void'&&it.purpose!=='accessories')));
 const {createEditorState}=require('../src/application/projects/editor-state.ts');
 const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
 const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
 const state=createEditorState();Object.assign(state,{w:cfg.w,h:cfg.h,d:cfg.d});state.profile={...state.profile,...cfg};
 createDesignCommands(()=>state).applyProposal(p);
 const geometry=createWardrobeGeometry(()=>state);
 for(let i=0;i<state.n;i++)assert.ok(geometry.sectionLayoutValid(i));
});
