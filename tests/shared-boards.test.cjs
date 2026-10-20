const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fittingBoardSpans,fittingPanels}=require('../src/domain/geometry/shared-board-spans.ts');
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
 const rectangles=[{x0:0,x1:60,y0:9.8,y1:39.8},{x0:0,x1:60,y0:39.8,y1:69.8}];
 const shared=fittingPanels(rectangles,9.8,228.2,[]);
 rectangles.forEach((r,i)=>renderer.mod(item,0,r.y0,60,true,false,shared[i].top,shared[i].bottom,shared[i].support));
 assert.equal(panels.filter(p=>Math.abs(p[4]-38.9)<.01).length,1);
 panels.length=0;
 renderer.mod({...item,h:37.2},0,191,60);
 assert.equal(panels.length,1,'cabinet ceiling supplies the top board while the isolated fitting retains its bottom');
 panels.length=0;
 renderer.mod(item,0,70,60,true,false,[],[],[]);
 assert.equal(panels.length,0,'explicit divider supplies the fitting board');
});
test('isolated compartments get two boards; stacked compartments share one boundary',()=>{
 const isolated=fittingPanels([{x0:0,x1:60,y0:50,y1:90}],9.8,228.2,[])[0];
 assert.equal(isolated.top.length,1);assert.equal(isolated.bottom.length,1);
 assert.ok(Math.abs(isolated.support[0].rise-1.8)<.001);
 const stacked=fittingPanels([{x0:0,x1:60,y0:50,y1:90},{x0:0,x1:60,y0:90,y1:130}],9.8,228.2,[]);
 assert.equal(stacked.flatMap(p=>[...p.top,...p.bottom]).length,3);
 assert.equal(stacked[1].bottom.length,0);
 assert.equal(stacked[1].support[0].rise,0,'Upper contents rest on the shared lower top');
});
test('partial adjoining widths share only the overlapping portion of the bottom board',()=>{
 const panels=fittingPanels([{x0:0,x1:30,y0:50,y1:90},{x0:0,x1:60,y0:90,y1:130}],9.8,228.2,[]);
 assert.deepEqual(panels[1].bottom,[{x0:30,x1:60,y0:90,y1:91.8}]);
 assert.deepEqual(panels[1].support.map(p=>[p.x0,p.x1]),[[0,30],[30,60]]);
 assert.equal(panels[1].support[0].rise,0);assert.ok(Math.abs(panels[1].support[1].rise-1.8)<.001);
});
test('frame and explicit shelves supply support without duplicate fitting boards',()=>{
 const panels=fittingPanels([{x0:0,x1:60,y0:9.8,y1:228.2}],9.8,228.2,[])[0];
 assert.deepEqual(panels.top,[]);assert.deepEqual(panels.bottom,[]);
 const explicit=fittingPanels([{x0:0,x1:60,y0:80,y1:120}],9.8,228.2,[{x0:0,x1:60,y0:80,y1:81.8}])[0];
 assert.deepEqual(explicit.bottom,[]);assert.ok(Math.abs(explicit.support[0].rise-1.8)<.001);
});
test('box contents sit on the support board, including isolated and shared compartments',()=>{
 const {createFittingRenderer}=require('../src/presentation/viewport/fitting-renderer.ts');
 for(const k of ['seasonal','shelf','basket'])for(const shared of [false,true]){
  const meshes=[],mp={};
  const renderer=createFittingRenderer({resources:{wood:()=>mp,shade:()=>'',M:color=>({color})},mp,md:{},mh:{},h:230,d:60,
   box:(...args)=>meshes.push(args),group:{},getRenderDesign:()=>({profile:{}}),garment(){}});
  const rect={x0:0,x1:60,y0:80,y1:120},panels=fittingPanels([rect],9.8,228.2,shared?[{x0:0,x1:60,y0:78.2,y1:80}]:[])[0];
  renderer.mod({k,purpose:'seasonal',h:40,boxes:1},0,80,60,true,false,panels.top,panels.bottom,panels.support);
  const box=meshes.find(m=>m[6].color==='#b7aa91');
  assert.ok(box);assert.ok(Math.abs(box[4]-box[1]/2-(shared?80:81.8))<.001,k+' boxes sit on their board');
  assert.equal(meshes.filter(m=>m[6]===mp&&m[1]===1.8).length,shared?1:2);
 }
});
test('isolated hanging rails omit the bottom board while other fittings retain both boundaries',()=>{
 const {createFittingRenderer}=require('../src/presentation/viewport/fitting-renderer.ts');
 for(const [k,h] of [['drawer',22],['sdrawer',14],['short',106],['long',160],['lift',106],['pants',80],['folded',28],['shoe',30],['shelf',30],['seasonal',40],['basket',40],['void',20]]){
  const meshes=[],mp={};
  const renderer=createFittingRenderer({resources:{wood:()=>mp,shade:()=>'',M:()=>({})},mp,md:{},mh:{},h:300,d:60,
   box:(...args)=>meshes.push(args),group:{add(){}},getRenderDesign:()=>({profile:{longDrop:150}}),garment(){}});
  renderer.mod({k,h,purpose:k==='seasonal'?'seasonal':'reserve'},0,50,60);
  const boards=meshes.filter(m=>m[6]===mp&&m[1]===1.8);
  assert.equal(boards.length,['short','long','lift'].includes(k)?1:2,k+' has only the boards it needs');
  if(['short','long','lift'].includes(k))assert.ok(boards.every(b=>b[4]>50+1.8),'No board is drawn at the hanging zone floor');
 }
});
test('hanging rails have no generated bottom board; adjacent shelves and explicit dividers remain',()=>{
 for(const k of ['short','long','lift']){
  const rail={k,x0:0,x1:60,y0:80,y1:190};
  const isolated=fittingPanels([rail],9.8,250,[])[0];
  assert.equal(isolated.top.length,1);assert.deepEqual(isolated.bottom,[]);assert.deepEqual(isolated.support,[]);
  const below={k:'shelf',x0:0,x1:60,y0:50,y1:80};
  const stacked=fittingPanels([below,rail],9.8,250,[]);
  assert.equal(stacked[0].top.length,1,'The shelf below retains its top board');
  assert.deepEqual(stacked[1].bottom,[]);
  const explicit=fittingPanels([rail],9.8,250,[{x0:0,x1:60,y0:78.2,y1:80}])[0];
  assert.equal(explicit.support.length,1,'An explicitly placed shelf remains below the rail');
 }
});
test('board schedules omit the generated bottom board for every hanging rail',()=>{
 const {boardSchedule}=require('../src/domain/planner/board-schedule.ts');
 for(const k of ['short','long','lift']){
  const boards=boardSchedule([{width:60,items:[{k,h:106,y:50,x:0,w:60}]}],{w:63.6,h:230,d:60},[]).filter(b=>b.source==='fitting');
  assert.equal(boards.length,1,k+' retains only its top board');
  assert.ok(boards[0].position.y>9.8+50+1.8);
 }
});
test('cutting drawings omit rail bottom boards and retain an explicitly added shelf',()=>{
 const {cabinetBoards}=require('../src/domain/drawings/cabinet-boards.ts');
 const {createEditorState}=require('../src/application/projects/editor-state.ts');
 for(const k of ['short','long','lift']){
  const state={...createEditorState(),w:63.6,n:1,secs:[[{k,h:106,y:50,x:0,w:60}]],dividers:[]};
  const shelves=()=>cabinetBoards(state).filter(b=>b.name==='Shelf');
  assert.equal(shelves().length,1,k+' has only its top board in the cutting drawings');
  assert.ok(shelves()[0].y0>9.8+50+1.8);
  state.dividers.push({i:0,orientation:'horizontal',x0:0,x1:60,y:35});
  assert.equal(shelves().length,2,'The separately placed shelf is still included');
 }
});
test('board schedule records two isolated boards and one shared stacked boundary',()=>{
 const {boardSchedule}=require('../src/domain/planner/board-schedule.ts');
 const cfg={w:63.6,h:230,d:60};
 const item={k:'seasonal',purpose:'seasonal',h:40,y:50,x:0,w:60};
 assert.equal(boardSchedule([{width:60,items:[item]}],cfg,[]).filter(b=>b.source==='fitting').length,2);
 const shared=boardSchedule([{width:60,items:[item,{...item,y:90}]}],cfg,[]).filter(b=>b.source==='fitting');
 assert.equal(shared.length,3);
 assert.equal(shared.filter(b=>Math.abs(b.position.y-(9.8+90-.9))<.001).length,1);
});
test('board schedule shares the same rule as the viewport',()=>{
 const {boardSchedule}=require('../src/domain/planner/board-schedule.ts');
 const boards=boardSchedule([{width:60,items:[{k:'short',purpose:'short',h:100,y:0,x:0,w:60},{k:'shelf',purpose:'reserve',h:116.6,y:101.8,x:0,w:60}]}],
  {w:63.6,h:230,d:60},[{i:0,orientation:'horizontal',x0:0,x1:60,y:100.9}]);
 assert.equal(boards.filter(b=>b.source==='fitting').length,0);
 assert.equal(boards.filter(b=>b.source==='divider').length,1);
});
