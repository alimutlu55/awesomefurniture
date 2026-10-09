const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fittingBoardSpans}=require('../src/domain/geometry/shared-board-spans.ts');
test('ceilings and explicit shelves own shared fitting boundaries',()=>{
 const top={x0:0,x1:60,y1:100};
 assert.deepEqual(fittingBoardSpans(top,100,[]),[]);
 assert.deepEqual(fittingBoardSpans(top,200,[{x0:0,x1:60,y0:100,y1:101.8}]),[]);
 assert.deepEqual(fittingBoardSpans(top,200,[{x0:0,x1:60,y0:98.2,y1:100}]),[]);
 assert.deepEqual(fittingBoardSpans(top,200,[{x0:0,x1:60,y0:105,y1:106.8}]),[{x0:0,x1:60}]);
 assert.deepEqual(fittingBoardSpans(top,200,[{x0:20,x1:40,y0:100,y1:101.8}]),[{x0:0,x1:20},{x0:40,x1:60}]);
});
test('rendered adjoining compartments have one board at their shared edge and none beneath the ceiling',()=>{
 const {createFittingRenderer}=require('../src/presentation/viewport/fitting-renderer.ts');
 const panels=[];
 const mp={},renderer=createFittingRenderer({resources:{wood:()=>mp,shade:()=>'',M:()=>({})},mp,md:{},mh:{},h:230,d:60,
  box:(...args)=>panels.push(args),geometry:{isBoxed:()=>false},group:{},getRenderDesign:()=>({}),garment(){}});
 const item={k:'shelf',purpose:'reserve',h:30};
 renderer.mod(item,0,9.8,60);renderer.mod(item,0,39.8,60);
 assert.equal(panels.filter(p=>Math.abs(p[4]-38.9)<.01).length,1);
 panels.length=0;
 renderer.mod({...item,h:37.2},0,191,60);
 assert.equal(panels.length,0,'cabinet ceiling supplies the top board');
 renderer.mod(item,0,70,60,true,false,[]);
 assert.equal(panels.length,0,'explicit divider supplies the fitting board');
});
test('board schedule shares the same rule as the viewport',()=>{
 const {boardSchedule}=require('../src/domain/planner/board-schedule.ts');
 const boards=boardSchedule([{width:60,items:[{k:'short',purpose:'short',h:100,y:0,x:0,w:60},{k:'shelf',purpose:'reserve',h:116.6,y:101.8,x:0,w:60}]}],
  {w:63.6,h:230,d:60},[{i:0,orientation:'horizontal',x0:0,x1:60,y:100.9}]);
 assert.equal(boards.filter(b=>b.source==='fitting').length,0);
 assert.equal(boards.filter(b=>b.source==='divider').length,1);
});
