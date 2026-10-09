const {test}=require('node:test');
const assert=require('node:assert/strict');
const {designAll}=require('../src/domain/planner/selection-planner.ts');
const {WardrobePlanner}=require('../src/domain/planner/wardrobe-planner.js');
const {storageHeightLimits}=require('../src/domain/planner/storage-fitting-limits.ts');
const cfg={w:200,h:230,d:60,reach:185,longDrop:160,growth:15,upper:'fill',drawers:'auto',density:'comfort',jackets:6,coats:2,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
test('screenshot inventory has practical drawer heights and daily contents within max reach',()=>{
 for(const reach of [185,160]){
  const config={...cfg,reach},plans=designAll(config).plans;
  assert.ok(plans.length);
  for(const p of plans)for(const s of p.sections)for(const it of s.items){
   const limits=storageHeightLimits(it,config);
   assert.ok(it.h>=limits.min-.03&&it.h<=limits.max+.03);
   if(it.k==='sdrawer')assert.ok(it.h>=12,'generated sock drawers need at least 12 cm');
   const access=WardrobePlanner.accessInfo(it,it.y+9.8,config);
   if(['short','long','pants','folded','shoes','small'].includes(it.purpose)){
    assert.ok(access.withinReach,`${it.purpose} exceeds max reach`);
    assert.ok(access.height<=reach+.03);
   }
  }
 }
});
test('preview distinguishes high reserve from clothing and shows actual compartment height',async()=>{
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const {zoneText,zoneColor}=await import('../src/presentation/editor/editor-format.js');
 const reserve={k:'shelf',purpose:'reserve',h:37.2,y:181.2,x:0,w:60};
 const folded={k:'folded',purpose:'folded',h:22.8,y:80,x:0,w:60};
 assert.equal(zoneText(reserve),'Adjustable');assert.notEqual(zoneColor(reserve),zoneColor(folded));
 const presenter=createPlannerPresenter({dom:{},model:{activeCabinet:()=>({state:{profile:cfg}})},geometry:{ih:()=>218.4}});
 const html=presenter.miniPlan({sections:[{width:60,items:[reserve,folded]}],dividers:[]});
 assert.match(html,/High storage · 37.2 cm/);assert.match(html,/Folded · 22.8 cm/);
 assert.match(html,/Occasional · top 228.2 cm/);
 assert.doesNotMatch(html,/Folded · 37.2 cm/);
});
