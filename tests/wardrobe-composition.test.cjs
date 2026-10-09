const {test}=require('node:test');
const assert=require('node:assert/strict');
const config={w:200,h:230,d:60,reach:185,longDrop:160,upper:'fill',needs:{short:24,long:6,pants:0,folded:0,shoes:0,small:0}};
const sections=[
 {width:64.27,items:[{k:'drawer',purpose:'folded',h:25},{k:'short',purpose:'short',h:120},{k:'shelf',purpose:'accessories',h:30.2},{k:'seasonal',purpose:'seasonal',h:34,boxes:2}]},
 {width:64.26,items:[{k:'long',purpose:'long',h:181.2},{k:'seasonal',purpose:'seasonal',h:34,boxes:1}]},
 {width:64.27,items:[{k:'drawer',purpose:'folded',h:25},{k:'short',purpose:'short',h:120},{k:'shelf',purpose:'accessories',h:30.2},{k:'seasonal',purpose:'seasonal',h:34,boxes:2}]}
];
test('cabinet refinement aligns upper shelves without losing capacity or garment clearance',()=>{
 const {coordinateUpperStorage}=require('../src/domain/planner/wardrobe-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const before=structuredClone(sections),result=coordinateUpperStorage(sections,config);
 const bottoms=result.map(s=>p.layoutSection(s.items,s.width).at(-1).y0);
 assert.ok(Math.max(...bottoms)-Math.min(...bottoms)<.03);
 assert.equal(p.analyze(result,config).valid,true);
 const after=p.analyze(result,config).capacities,beforeCap=p.analyze(sections,config).capacities;
 for(const key of ['short','long','pants','folded','shoes','small','seasonalBoxes'])assert.equal(after[key],beforeCap[key]);
 assert.ok(after.seasonalLitres>=beforeCap.seasonalLitres);
 assert.deepEqual(sections,before);
});
test('composition leaves an infeasible alignment alone and never shortens long garments',()=>{
 const {coordinateUpperStorage}=require('../src/domain/planner/wardrobe-composer.ts');
 const impossible={...config,longDrop:180};
 const original=structuredClone(sections);
 assert.deepEqual(coordinateUpperStorage(sections,impossible),original);
});
test('box packing uses real dimensions, clearances and centres incomplete rows',()=>{
 const {packStorageBoxes}=require('../src/domain/planner/storage-boxes.ts');
 const packing=packStorageBoxes(100,70,5,{width:30,height:30,depth:30});
 assert.equal(packing.capacity,6);
 assert.deepEqual(packing.positions.slice(3).map(p=>p.x),[-16,16]);
 for(const b of packing.positions){assert.ok(Math.abs(b.x)+15<=49);assert.ok(Math.abs(b.z)+15<=33.5);}
 assert.equal(packStorageBoxes(50,40,4,{width:60,height:30,depth:30}).capacity,0);
});
test('designed proposals are deterministic, feasible and expose composition trade-offs',()=>{
 const {generateDesignedLayouts}=require('../src/domain/planner/wardrobe-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const supported={...config,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
 const proposals=generateDesignedLayouts(supported);
 assert.ok(proposals.length>0);
 for(const proposal of proposals){assert.equal(p.analyze(proposal.sections,supported).valid,true);assert.ok(proposal.composition);}
 assert.deepEqual(generateDesignedLayouts(supported),proposals);
 assert.ok(proposals.every(p=>p.score>=0&&p.score<=100&&p.breakdown));
 assert.ok(proposals.length<=8);
});
test('planner accounts for chosen box size and rejects too-small compartments',()=>{
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const cfg={...config,boxWidth:45,boxHeight:40,boxDepth:35};
 const proposals=p.generate(cfg);
 assert.ok(proposals.length>0);
 for(const proposal of proposals)for(const section of proposal.sections)for(const it of section.items)if(it.k==='seasonal'){
  assert.ok(it.h>=44,'40 cm boxes require a shelf and removal clearance');
  assert.ok(it.boxes<=Math.floor(section.width/47)*Math.floor((cfg.d-1)/37),'box counts must fit the selected dimensions');
 }
 const bad=structuredClone(sections);bad[0].items.at(-1).h=34;
 assert.equal(p.analyze(bad,cfg).valid,false);
});
test('whole-cabinet planning stays feasible for narrow, shallow, seated and tall-garment cases',()=>{
 const {generateDesignedLayouts}=require('../src/domain/planner/wardrobe-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 for(const options of [{w:140,h:200,d:40,reach:180},{accessible:true,reach:122,allowLift:true},{longDrop:185,reach:185},{upper:'none'},{boxWidth:80,boxHeight:50,boxDepth:80}]){
  const cfg={...config,...options};
  for(const proposal of generateDesignedLayouts(cfg))assert.equal(p.analyze(proposal.sections,cfg).valid,true);
 }
});
test('seasonal compartments without an explicit box count still require box-height clearance',()=>{
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const cfg={...config,w:103.6,boxHeight:40};
 const layout=[{width:100,items:[{k:'seasonal',purpose:'seasonal',h:30,y:175.2}]}];
 assert.equal(p.analyze(layout,cfg).valid,false);
});

test('aligning upper storage also closes the upper band at the cabinet ceiling',()=>{
 const {coordinateUpperStorage}=require('../src/domain/planner/wardrobe-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const original=structuredClone(sections),result=coordinateUpperStorage(original,config);
 const ceiling=config.h-2*1.8-8;
 for(const section of result)assert.ok(Math.abs(p.layoutSection(section.items,section.width).at(-1).y1-ceiling)<.03,'alignment must not leave a thin orphan compartment above the boxes');
 const before=p.analyze(original,config).capacities,after=p.analyze(result,config).capacities;
 for(const key of ['short','long','pants','folded','shoes','small','seasonalBoxes'])assert.equal(after[key],before[key]);
 assert.equal(p.analyze(result,config).valid,true);
 assert.deepEqual(original,sections);
});
test('composition detects mismatched tops even when box shelf bottoms align',()=>{
 const {compositionOf}=require('../src/domain/planner/wardrobe-composer.ts');
 const aligned=sections.map(s=>({...s,items:[{k:'long',purpose:'long',h:175.2},{k:'seasonal',purpose:'seasonal',h:43.2,boxes:1}]}));
 const orphan=structuredClone(aligned);orphan[0].items.at(-1).h=34;
 assert.ok(compositionOf(orphan).score<compositionOf(aligned).score,'a matching bottom edge must not conceal a mismatched upper cap');
});
test('daily composition penalizes unrequested filler shelves and scattered drawers',()=>{
 const {dailyStorageQuality}=require('../src/domain/planner/daily-storage-composer.ts');
 const coherent=[{width:64,items:[{k:'drawer',purpose:'folded',h:26},{k:'sdrawer',purpose:'small',h:12},{k:'short',purpose:'short',h:110}]}];
 const fragmented=[{width:64,items:[{k:'drawer',purpose:'folded',h:26},{k:'shelf',purpose:'accessories',h:30},{k:'sdrawer',purpose:'small',h:12},{k:'short',purpose:'short',h:100}]}];
 assert.ok(dailyStorageQuality(fragmented,config).penalty>dailyStorageQuality(coherent,config).penalty);
 assert.ok(dailyStorageQuality(fragmented,config).fillerHeight>0);
});
test('daily refinement improves drawer access without sacrificing clothing capacity',()=>{
 const {refineDailyStorage,dailyStorageQuality}=require('../src/domain/planner/daily-storage-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const cfg={...config,w:103.6,upper:'none',needs:{short:0,long:0,pants:0,folded:30,shoes:0,small:30}};
 const layout=[{width:100,items:[{k:'sdrawer',purpose:'small',h:12},{k:'folded',purpose:'folded',h:30},{k:'folded',purpose:'folded',h:30},{k:'folded',purpose:'folded',h:30}]}];
 const before=structuredClone(layout),after=refineDailyStorage(layout,cfg);
 assert.ok(dailyStorageQuality(after,cfg).penalty<dailyStorageQuality(layout,cfg).penalty);
 assert.ok(p.analyze(after,cfg).ergo>p.analyze(layout,cfg).ergo);
 assert.deepEqual(p.analyze(after,cfg).capacities,p.analyze(layout,cfg).capacities);
 assert.equal(p.analyze(after,cfg).valid,true);assert.deepEqual(layout,before);
});
test('refinement preserves all requested capacities across mixed, shallow and seated candidates',()=>{
 const {refineDailyStorage}=require('../src/domain/planner/daily-storage-composer.ts');
 const {coordinateUpperStorage}=require('../src/domain/planner/wardrobe-composer.ts');
 const {WardrobePlanner:p}=require('../src/domain/planner/wardrobe-planner.js');
 const defaults={...config,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
 for(const options of [{},{drawers:'none'},{d:40},{accessible:true,reach:122,allowLift:true},{boxWidth:40,boxHeight:28},{h:280,upper:'more'}]){
  const cfg={...defaults,...options};
  for(const original of p.generate(cfg)){
   const before=structuredClone(original.sections);
   const revised=coordinateUpperStorage(refineDailyStorage(before,cfg),cfg),metrics=p.analyze(revised,cfg);
   assert.equal(metrics.valid,true);
   for(const key of ['short','long','pants','folded','shoes','small','seasonalBoxes'])assert.ok(metrics.capacities[key]>=original.metrics.capacities[key]-.01,`${key} capacity regressed`);
   assert.deepEqual(before,original.sections);
  }
 }
});
test('capacity priority uses the shared selection algorithm with a utilisation weight preset',()=>{
 const {generateDesignedLayouts}=require('../src/domain/planner/wardrobe-composer.ts');
 const result=generateDesignedLayouts({...config,composition:'storage',needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}});
 assert.ok(result.length>0&&result.length<=8);
 for(const p of result){assert.equal(p.breakdown.weights.utilisation,.30);assert.equal(p.metrics.valid,true);assert.ok(p.score<=100);}
});
