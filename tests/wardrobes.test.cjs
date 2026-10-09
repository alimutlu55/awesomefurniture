const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
function fixture(){
 const {createEditorModel}=require('../src/application/projects/editor-model.js');
 const {createSceneCommands}=require('../src/application/commands/scene-commands.js');
 const {createCabinetGeometry}=require('../src/domain/geometry/cabinet-geometry.js');
 const initial={w:200,h:230,d:60,n:1,wt:[100,100,100,100,100,100],dividers:[],secs:[[{k:'drawer',h:22}],[],[],[],[],[]],profile:{reach:185}};
 const model=createEditorModel({wardrobes:[{id:1,name:'Wardrobe 1',x:0,y:0,z:0,angle:0,state:initial}],activeWardrobe:1,nextWardrobeId:2});
 const commands=createSceneCommands(()=>model.scene,{initialDesign:()=>structuredClone(initial)});
 const context=vm.createContext({...createCabinetGeometry(()=>model.scene.wardrobes),addCabinet:commands.addCabinet,activeCabinet:()=>model.activeCabinet(),sceneSnapshot:()=>model.snapshot(),restoreScene:raw=>model.restore(raw)});
 Object.defineProperties(context,{S:{get:()=>model.activeCabinet().state},wardrobes:{get:()=>model.scene.wardrobes},activeWardrobe:{get:()=>model.scene.activeWardrobe},nextWardrobeId:{get:()=>model.scene.nextWardrobeId}});
 return script=>vm.runInContext(script,context);
}
test('adding cabinets isolates configuration and puts them beside existing furniture',()=>{
 const run=fixture();run('addCabinet();S.w=120;S.secs[0][0].h=30');
 assert.equal(run('wardrobes.length'),2);assert.equal(run('wardrobes[0].state.w'),200);assert.equal(run('wardrobes[0].state.secs[0][0].h'),22);
 assert.ok(run('cabinetBounds(wardrobes[1]).x-cabinetBounds(wardrobes[1]).hw>cabinetBounds(wardrobes[0]).hw'));
});
test('duplicating preserves design and orientation without sharing item objects',()=>{
 const run=fixture();run('wardrobes[0].angle=90;addCabinet(true);S.secs[0][0].h=45');
 assert.equal(run('activeCabinet().angle'),90);assert.equal(run('wardrobes[0].state.secs[0][0].h'),22);
});
test('scene restore recovers additions, placements and active configuration atomically',()=>{
 const run=fixture();run('addCabinet();activeCabinet().angle=270;activeCabinet().z=-80;const saved=sceneSnapshot();S.w=90;addCabinet();restoreScene(saved)');
 assert.equal(run('wardrobes.length'),2);assert.equal(run('activeWardrobe'),2);assert.equal(run('S.w'),200);assert.equal(run('activeCabinet().angle'),270);assert.equal(run('activeCabinet().z'),-80);assert.equal(run('nextWardrobeId'),3);
 run('S.w=175');assert.equal(run('activeCabinet().state.w'),175);
});
test('rotated footprints swap width and depth and fit every cabinet',()=>{
 const run=fixture();run('addCabinet();activeCabinet().angle=90;activeCabinet().z=-70');
 assert.ok(Math.abs(run('cabinetBounds(activeCabinet()).hw')-30)<1e-8);
 assert.ok(Math.abs(run('cabinetBounds(activeCabinet()).hd')-100)<1e-8);
 assert.ok(Math.abs(run('sceneBounds().w')-345)<1e-8);assert.ok(Math.abs(run('sceneBounds().d')-200)<1e-8);
});
test('moving a cabinet in XYZ preserves its local design and restores height with the scene',()=>{
 const run=fixture();
 
 
 run('addCabinet();const saved=sceneSnapshot();Object.assign(activeCabinet(),cabinetTranslation(activeCabinet(),{x:-50,y:40,z:80}))');
 assert.equal(run('activeCabinet().x'),165);assert.equal(run('activeCabinet().y'),40);assert.equal(run('activeCabinet().z'),80);
 assert.equal(run('sceneBounds().h'),270);assert.equal(run('S.secs[0][0].h'),22);
 run('restoreScene(saved)');assert.equal(run('activeCabinet().y||0'),0);assert.equal(run('activeCabinet().z'),0);
});
test('vertical movement respects the floor and moving one cabinet leaves the others in place',()=>{
 const run=fixture();
 run('addCabinet();Object.assign(activeCabinet(),cabinetTranslation(activeCabinet(),{x:30,y:-100,z:-75}))');
 assert.equal(run('activeCabinet().y'),0);assert.equal(run('wardrobes[0].x'),0);assert.equal(run('wardrobes[0].z'),0);assert.equal(run('S.profile.reach'),185);
});
test('physical faces can touch but overlapping cabinet volumes are rejected',()=>{
 const run=fixture();run('addCabinet();activeCabinet().x=200');
 assert.equal(run('cabinetCollides(activeCabinet())'),false);
 run('activeCabinet().x=199.9');assert.equal(run('cabinetCollides(activeCabinet())'),true);
 run('activeCabinet().x=0;activeCabinet().y=230');assert.equal(run('cabinetCollides(activeCabinet())'),false);
 run('activeCabinet().y=229');assert.equal(run('cabinetCollides(activeCabinet())'),true);
});
test('diagonal cabinets use actual rotated faces rather than enclosing rectangles',()=>{
 const run=fixture();run('addCabinet();wardrobes[0].angle=45;activeCabinet().angle=45;activeCabinet().x=70/Math.sqrt(2);activeCabinet().z=70/Math.sqrt(2)');
 assert.equal(run('cabinetCollides(activeCabinet())'),false);
 run('activeCabinet().x=59/Math.sqrt(2);activeCabinet().z=59/Math.sqrt(2)');assert.equal(run('cabinetCollides(activeCabinet())'),true);
});
test('large drag events stop at the first face instead of passing through a neighbour',()=>{
 const run=fixture();run('addCabinet();const stop=safeCabinetTranslation(activeCabinet(),{x:-500,y:0,z:0});Object.assign(activeCabinet(),stop)');
 assert.ok(run('activeCabinet().x>=200 && activeCabinet().x<200.001'));
 assert.equal(run('cabinetCollides(activeCabinet())'),false);
 run('const slide=safeCabinetTranslation(activeCabinet(),{x:activeCabinet().x,y:0,z:100})');assert.equal(run('slide.z'),100);
});
test('rotation stops when a sweeping corner hits even when the final angle would be free',()=>{
 const run=fixture();run('addCabinet();activeCabinet().x=203');
 assert.equal(run('cabinetCollides({...activeCabinet(),angle:90})'),false);
 run('const limited=safeCabinetRotation(activeCabinet(),90)');assert.ok(run('limited>0 && limited<45'));
 run('activeCabinet().angle=limited');assert.equal(run('cabinetCollides(activeCabinet())'),false);
});
test('vertical dragging stops on top of another wardrobe and height changes respect neighbours',()=>{
 const run=fixture();run('addCabinet();activeCabinet().x=0;activeCabinet().y=300;const landing=safeCabinetTranslation(activeCabinet(),{x:0,y:0,z:0})');
 assert.ok(run('landing.y>=230 && landing.y<230.001'));
 run('activeCabinet().y=230');assert.equal(run('cabinetCollides({...wardrobes[0],state:{...wardrobes[0].state,h:240}})'),true);
});
test('contact after a blocked rotation still prevents subsequent inward dragging',()=>{
 const run=fixture();run('addCabinet();activeCabinet().x=203;activeCabinet().angle=safeCabinetRotation(activeCabinet(),90);Object.assign(activeCabinet(),safeCabinetTranslation(activeCabinet(),{x:0,y:0,z:0}))');
 assert.equal(run('cabinetCollides(activeCabinet())'),false);assert.ok(run('activeCabinet().x>202.99'));
});
