const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {designFixture,gestureFixture}=require('./helpers/editor-fixture.cjs');
function fixture(items=[]){
 const c=vm.createContext({S:{w:200,h:230,d:60,n:3,wt:[100,100,100],secs:[[],items,[]],sel:1,item:-1,dividers:[]},G:{},act(fn){fn()},toast(){},deep:true,pillOn:true});
 designFixture(c);
 return{c,run:code=>vm.runInContext(code,c)};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
test('divider in space above a rail preserves existing items and whole-section widths',()=>{
 const {c,run}=fixture([{k:'drawer',h:22},{k:'short',h:106}]),before=JSON.stringify(c.S.secs),weights=JSON.stringify(c.S.wt);
 run('addSpaceDivider()');assert.equal(JSON.stringify(c.S.secs),before);assert.equal(JSON.stringify(c.S.wt),weights);assert.equal(c.S.n,3);
 const d=c.S.dividers[0];near(d.y0,128);near(d.y1,218.4);near(d.x,64.2666666667/2);
 const spaces=run('sectionSpaces(1)');assert.equal(spaces.length,2);spaces.forEach(q=>{near(q.h,90.4);near(q.w,(64.2666666667-1.8)/2)});
});
test('clicked side determines which newly divided space is selected',()=>{
 const {c,run}=fixture([{k:'drawer',h:22}]);run('addSpaceDivider()');
 c.S.space={i:1,x:50,y:100};const right=run('sectionSpaceMeasurements(1)');assert.ok(right.x0>32);
 c.S.space={i:1,x:10,y:100};const left=run('sectionSpaceMeasurements(1)');near(left.x0,0);assert.ok(left.x1<32);
});
test('divider boundaries reject crossing items while allowing support below and touching faces',()=>{
 const {c,run}=fixture([{k:'drawer',h:22},{k:'short',h:106}]);run('addSpaceDivider()');
 assert.equal(run('dividerOverlaps(1,computeLayout(1))'),false);
 assert.equal(run('dividerOverlaps(1,[{x0:0,x1:64,relY0:128,relY1:150}])'),true);
 const d=c.S.dividers[0];c.layout=[{x0:0,x1:d.x-.9,relY0:128,relY1:150}];assert.equal(run('dividerOverlaps(1,layout)'),false);
 near(run('itemFreeAbove(1,1)'),0);
});
test('narrow child space still accepts a horizontal divider',()=>{
 const {c,run}=fixture();run('addSpaceDivider();addShelfBoard()');assert.equal(c.S.dividers.length,2);assert.equal(c.S.dividers[1].orientation,'horizontal');
});

test('items in divider child cells remain valid and centre alignment across the partition is rejected',()=>{
 const {c,run}=fixture([{k:'drawer',h:22},{k:'short',h:106}]);run('addSpaceDivider()');
 const d=c.S.dividers[0],w=d.x-.9;c.S.secs[1].push({k:'shelf',h:30,w,x:0,y:128});
 assert.equal(run('sectionLayoutValid(1)'),true);
 c.S.secs[1][2].x=(64.2666666667-w)/2;assert.equal(run('sectionLayoutValid(1)'),false);
 c.S.secs[1][2].x=0;c.S.secs[1].push({k:'shelf',h:30,w,x:0,y:158});assert.equal(run('sectionLayoutValid(1)'),true);
});

test('orientation changes stay in the selected region and preserve its existing support',()=>{
 const {c,run}=fixture([{k:'drawer',h:22},{k:'short',h:106}]);run('addSpaceDivider()');const before=JSON.stringify(c.S.secs);
 c.S.dividers[0]=run("dividerOrientation(0,'horizontal')");assert.equal(c.S.dividers[0].orientation,'horizontal');near(c.S.dividers[0].y,173.2);
 assert.equal(run('sectionSpaces(1).length'),2);assert.equal(JSON.stringify(c.S.secs),before);
 c.S.dividers[0]=run("dividerOrientation(0,'vertical')");near(c.S.dividers[0].y0,128);near(c.S.dividers[0].y1,218.4);
});
test('moving a divider stops at physical boundaries without changing any items',()=>{
 const {c,run}=fixture();run('addSpaceDivider();moveDividerTo(0,-100)');near(c.S.dividers[0].x,.9);
 run('moveDividerTo(0,500)');near(c.S.dividers[0].x,64.2666666667-.9);
});
test('divider dragging cannot pass through an item or another divider in a large step',()=>{
 const {c,run}=fixture();run('addSpaceDivider()');c.S.secs[1]=[{k:'shelf',h:30,w:25,x:0,y:100}];const before=JSON.stringify(c.S.secs);
 run('moveDividerTo(0,0)');near(c.S.dividers[0].x,25.9);assert.equal(JSON.stringify(c.S.secs),before);
 c.S.secs[1]=[];c.S.dividers.push({i:1,x:45,y0:0,y1:218.4});run('moveDividerTo(0,60)');near(c.S.dividers[0].x,43.2);
});
test('horizontal divider blocks upward item resizing and stops at touching support',()=>{
 const {c,run}=fixture([{k:'drawer',h:22}]);run('addSpaceDivider()');c.S.dividers[0]=run("dividerOrientation(0,'horizontal')");run('moveDividerTo(0,0)');near(run('dividerRect(S.dividers[0]).y0'),22);near(run('itemFreeAbove(1,0)'),0);
});

test('divider clearances update along the movement axis and retain actual depth',()=>{
 const {c,run}=fixture();run('addSpaceDivider()');let m=run('dividerMeasurements(0)');near(m.before,31.2333333333);near(m.after,31.2333333333);near(m.depth,58);
 run('moveDividerTo(0,40)');m=run('dividerMeasurements(0)');near(m.before,39.1);near(m.after,23.3666666667);
 c.S.dividers[0]=run("dividerOrientation(0,'horizontal')");run('moveDividerTo(0,100)');m=run('dividerMeasurements(0)');near(m.before,99.1);near(m.after,117.5);
});
test('divider clearances stop at neighbouring items rather than reporting through them',()=>{
 const {c,run}=fixture();run('addSpaceDivider()');c.S.secs[1]=[{k:'shelf',w:25,x:0,y:100,h:30}];const m=run('dividerMeasurements(0)');near(m.low,25);near(m.before,6.2333333333);
});
test('live divider drag refreshes existing visuals without rebuilding and saves one undo entry',()=>{
 const {c,run}=fixture();run('addSpaceDivider()');c.S.doors='none';Object.assign(c,{camRelease(){},tgt:{y:115},tgtY:115,vs:0,vsT:0,vz:1,vzT:1,hist:[],redoH:[],histUI(){},showPop(){},refreshes:0,rebuilds:0,frontPoint:e=>e.point,sceneSnapshot:()=>JSON.stringify(c.S),refreshDividerVisual(){c.refreshes++},update(){c.rebuilds++},cv:{setPointerCapture(){},hasPointerCapture(){return false}}});
 c.dividerGesture=null;gestureFixture(c);
 run('beginDividerDrag({pointerId:1,clientX:0,clientY:0,point:{x:0,y:0}},0)');
 run('moveDividerDrag({pointerId:1,clientX:10,clientY:0,point:{x:5,y:0}});moveDividerDrag({pointerId:1,clientX:20,clientY:0,point:{x:10,y:0}})');
 assert.equal(c.refreshes,2);assert.equal(c.rebuilds,0);assert.equal(c.hist.length,0);
 run('finishDividerDrag()');assert.equal(c.hist.length,1);assert.equal(c.rebuilds,1);
});

test('editing left and right clearance positions the divider using its actual faces',()=>{
 const {c,run}=fixture();run('addSpaceDivider();setDividerClearance(0,"before",20)');near(run('dividerMeasurements(0).before'),20);
 run('setDividerClearance(0,"after",10)');near(run('dividerMeasurements(0).after'),10);near(c.S.dividers[0].x,53.3666666667);
});
test('editing horizontal distances supports zero and respects occupied boundaries',()=>{
 const {c,run}=fixture([{k:'drawer',h:22}]);run('addSpaceDivider()');c.S.dividers[0]=run('dividerOrientation(0,"horizontal")');
 run('setDividerClearance(0,"before",0)');near(run('dividerMeasurements(0).before'),0);near(run('dividerRect(S.dividers[0]).y0'),22);
 run('setDividerClearance(0,"after",30)');near(run('dividerMeasurements(0).after'),30);
});
test('invalid and excessive dimension input cannot cross physical boundaries',()=>{
 const {c,run}=fixture();run('addSpaceDivider()');const before=JSON.stringify(c.S.dividers);
 assert.equal(run('setDividerClearance(0,"before",NaN)'),false);assert.equal(run('setDividerClearance(0,"before",-2)'),false);assert.equal(JSON.stringify(c.S.dividers),before);
 run('setDividerClearance(0,"before",1000)');near(run('dividerMeasurements(0).after'),0);near(run('dividerMeasurements(0).before'),62.4666666667);
});

// What moves with a board (wardrobe-rules/attachments.js). Section 1 is 64.27 cm wide and 218.4 cm clear.
const BW=64.2666666667,TOP=218.4,full=(x)=>({i:1,orientation:'vertical',x,y0:0,y1:TOP,area:{x0:0,x1:BW,y0:0,y1:TOP}});
test('a divider fits the height where it stands: standing on a fitting, and down to the floor past it',()=>{
 const {c,run}=fixture([{k:'drawer',h:40,w:30,x:0,y:0}]);
 c.S.dividers=[{i:1,orientation:'vertical',x:15,y0:40,y1:TOP,area:{x0:0,x1:30,y0:40,y1:TOP}}];
 run('moveDividerTo(0,50)');near(c.S.dividers[0].x,50);near(c.S.dividers[0].y0,0);near(c.S.dividers[0].y1,TOP);
 run('moveDividerTo(0,10)');near(c.S.dividers[0].x,30.9);near(c.S.dividers[0].y0,0);
});
test('a divider travels the whole section, not only the space it was made in',()=>{
 const {c,run}=fixture();c.S.dividers=[{...full(20),area:{x0:0,x1:30,y0:0,y1:TOP}}];
 run('moveDividerTo(0,55)');near(c.S.dividers[0].x,55);
});
test('a shelf fixed between the side and a divider stretches with it; a shelf held only by the divider slides',()=>{
 const {c,run}=fixture();
 c.S.dividers=[full(40),{i:1,orientation:'horizontal',x0:0,x1:39.1,y:100,area:{x0:0,x1:39.1,y0:0,y1:TOP}},{i:1,orientation:'horizontal',x0:20,x1:39.1,y:150,area:{x0:0,x1:39.1,y0:0,y1:TOP}}];
 assert.equal(run('moveDividerTo(0,50)'),'all');
 near(c.S.dividers[1].x0,0);near(c.S.dividers[1].x1,49.1);
 near(c.S.dividers[2].x0,30);near(c.S.dividers[2].x1,49.1);
 run('moveDividerTo(0,10)');near(c.S.dividers[1].x1,BW/2*0+(c.S.dividers[0].x-.9));assert.ok(c.S.dividers[1].x1-c.S.dividers[1].x0>=15-.01,'a stretched shelf stays at least 15 cm long');
});
test('a fitting beside a divider goes with it: stretched between the side and the divider',()=>{
 const {c,run}=fixture([{k:'drawer',h:30,w:39.1,x:0,y:0}]);c.S.dividers=[full(40)];c.S.dividers[0].y0=0;
 run('moveDividerTo(0,50)');near(c.S.secs[1][0].w,49.1);near(c.S.secs[1][0].x,0);
 run('moveDividerTo(0,0)');assert.ok(c.S.secs[1][0].w>=run('itemMinW(S.secs[1][0])')-.01,'never narrower than the fitting allows');
});
test('fittings and dividers standing on a shelf ride with it; a divider reaching up to it stretches',()=>{
 const {c,run}=fixture([{k:'shelf',h:20,w:20,x:40,y:100.9}]);
 c.S.dividers=[{i:1,orientation:'horizontal',x0:0,x1:BW,y:100,area:{x0:0,x1:BW,y0:0,y1:TOP}},{i:1,orientation:'vertical',x:20,y0:100.9,y1:TOP,area:{x0:0,x1:BW,y0:100.9,y1:TOP}},{i:1,orientation:'vertical',x:30,y0:0,y1:99.1,area:{x0:0,x1:BW,y0:0,y1:99.1}}];
 assert.equal(run('moveDividerTo(0,120)'),'all');
 near(c.S.secs[1][0].y,120.9);
 near(c.S.dividers[1].y0,120.9);near(c.S.dividers[1].y1,TOP);
 near(c.S.dividers[2].y0,0);near(c.S.dividers[2].y1,119.1);
});
test('a divider made shorter keeps its length when a slope cuts it on the way and comes back',()=>{
 const c=vm.createContext({S:{w:200,h:230,d:60,n:1,wt:[100,100,100,100,100,100],secs:[[],[],[],[],[],[]],sel:0,item:-1,dividers:[],shape:{template:'sloped',top:[{x:0,y:100},{x:200,y:230}]}},G:{},act(fn){fn()},toast(){},deep:true,pillOn:true});
 designFixture(c);const run=code=>vm.runInContext(code,c);
 c.S.dividers=[{i:0,orientation:'vertical',x:150,y0:0,y1:120,want:120,area:{x0:0,x1:196.4,y0:0,y1:218.4}}];
 run('moveDividerTo(0,20)');assert.ok(c.S.dividers[0].y1<120,'cut by the slope near the low side');
 run('moveDividerTo(0,150)');near(c.S.dividers[0].y1,120);
 c.S.dividers=[{i:0,orientation:'vertical',x:20,y0:0,y1:run('ceilingIn(0,19.1,20.9)'),area:{x0:0,x1:196.4,y0:0,y1:218.4}}];
 run('moveDividerTo(0,150)');near(c.S.dividers[0].y1,run('ceilingIn(0,149.1,150.9)'));
});
test('a fitting moved takes along what stands on it: a divider and a fitting placed on its top',()=>{
 const {c,run}=fixture([{k:'drawer',h:40,w:30,x:0,y:0},{k:'shelf',h:20,w:20,x:5,y:40}]);
 c.S.dividers=[{i:1,orientation:'vertical',x:27,y0:40,y1:TOP,area:{x0:0,x1:30,y0:40,y1:TOP}}];
 c.S.item=0;const plan=run('planFreeMove({i:1,j:0},1,{x:30,y:0})');assert.equal(plan.valid,true);
 run('applyMove(planFreeMove({i:1,j:0},1,{x:30,y:0}))');
 const drawer=c.S.secs[1].find(it=>it.k==='drawer'),shelf=c.S.secs[1].find(it=>it.k==='shelf');
 assert.ok(drawer.x>20,'the drawer moved: '+drawer.x);
 near(c.S.dividers[0].x,27+drawer.x);near(c.S.dividers[0].y0,40);near(shelf.x,5+drawer.x);near(shelf.y,40);
});
test('a divider added under a sloped top reaches the top where it stands, and follows it as it slides',()=>{
 const c=vm.createContext({S:{w:200,h:230,d:60,n:1,wt:[100,100,100,100,100,100],secs:[[],[],[],[],[],[]],sel:0,item:-1,dividers:[],shape:{template:'room',top:[{x:0,y:230},{x:110,y:140},{x:200,y:140}]}},G:{},act(fn){fn()},toast(){},deep:true,pillOn:true});
 designFixture(c);const run=code=>vm.runInContext(code,c),top=x=>run(`ceilingIn(0,${x-.9},${x+.9})`);
 c.S.space={i:0,x:150,y:60};run('addSpaceDivider()');
 const d=()=>c.S.dividers[0];near(d().y1,top(d().x));assert.ok(d().y1>run('ceilingIn(0,0,196.4)')+1,'taller than the section\'s lowest point');
 for(const x of [70,40,10]){ run(`moveDividerTo(0,${x})`);near(d().y1,top(x)); }
});
