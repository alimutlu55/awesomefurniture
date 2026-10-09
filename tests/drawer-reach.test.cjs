const {test}=require('node:test');
const assert=require('node:assert/strict');
const {WardrobePlanner}=require('../src/domain/planner/wardrobe-planner.js');
const {additionalGate,modulesFor}=require('../src/domain/planner/selection-modules.ts');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const base={w:63.6,h:230,d:60,growth:0,upper:'none',needs:{short:0,long:0,pants:0,folded:12,shoes:0,small:0}};
test('drawer gates use the same floor-relative limit for standard and accessible reach',()=>{
 for(const [reach,accessible,limit] of [[140,false,100],[150,false,105],[185,false,130],[200,false,135],[210,false,135],[100,true,100],[122,true,105]]){
  const cfg={...base,reach,accessible};
  for(const [k,h,purpose] of [['drawer',23,'folded'],['sdrawer',12.8,'small'],['basket',25,'laundry']]){
   for(const delta of [0,1]){
    const y=limit+delta-9.8-h,it={k,h,purpose,x:0,y,w:60};
    const access=WardrobePlanner.accessInfo(it,y+9.8,cfg);
    assert.equal(access.limit,limit);
    assert.equal(access.withinReach,delta===0);
    assert.equal(additionalGate(it,600,y*10,cfg)===null,delta===0,`${k}, reach ${reach}, accessible ${accessible}, top ${limit+delta}`);
    assert.equal(scoreLayout([{width:60,items:[it]}],cfg).metrics.valid,delta===0);
   }
  }
 }
});
test('accessible drawer generation uses the available band up to 105 cm',()=>{
 const cfg={...base,reach:122,accessible:true};
 const modules=modulesFor({bay:0,x:0,y:700,w:600,h:252,depth:600},cfg.needs,cfg,0);
 assert.ok(modules.some(m=>m.items.some(it=>it.k==='drawer'&&(it.y+it.h+9.8)>91.5)),'a reachable drawer must not be rejected by a second 75% cap');
});
