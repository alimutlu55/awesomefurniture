const {test}=require('node:test');
const assert=require('node:assert/strict');

test('imported planner produces feasible deterministic layouts across different density settings',async()=>{
 const {WardrobePlanner:planner}=await import('../src/domain/planner/wardrobe-planner.js');
 const config={w:200,h:230,d:60,needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30},upper:'fill',density:'comfort',allowLift:false,reach:185,budget:900};
 const first=planner.generate(config);
 assert.ok(first.length>0);
 for(const proposal of first){
  assert.equal(planner.analyze(proposal.sections,config).valid,true);
  const width=proposal.sections.reduce((sum,s)=>sum+s.width,0)+(proposal.sections.length+1)*1.8;
  assert.ok(Math.abs(width-config.w)<.1);
 }
 planner.generate({...config,density:'compact',accessible:true,reach:122});
 assert.deepEqual(planner.generate(config),first);
});

test('placement rejects occupied cells and retains free side-by-side positions',async()=>{
 const {WardrobePlanner:planner}=await import('../src/domain/planner/wardrobe-planner.js');
 const occupied={x0:0,x1:50,y0:0,y1:30};
 assert.equal(planner.placeItem({bw:50,H:30,w:50,h:30,want:{x:0,y:0},others:[occupied]}),null);
 const result=planner.placeItem({bw:100,H:30,w:50,h:30,want:{x:50,y:0},others:[occupied]});
 assert.equal(result.x,50);assert.equal(result.y,0);
});
