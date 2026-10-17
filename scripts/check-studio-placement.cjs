// Reproduce creation through the real UI; independently check its reported pose
// against the room's geometry. Run with node --import tsx after a production build.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {buildFromSpec}=require('../src/application/spec/build-from-spec.ts');
const {projectToScene}=require('../src/application/projects/editor-mapper.ts');
const {flushAgainst}=require('../src/domain/studio/studio-placement.ts');
const {studioPlacementObstacles}=require('../src/domain/studio/studio-obstacles.ts');
const {createCabinetGeometry}=require('../src/domain/geometry/cabinet-geometry.js');
const {ceilingClearance}=require('../src/domain/studio/studio-clearance.ts');
const baseURL=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
const roomSpec={specVersion:1,room:{width:150,depth:115,height:270,openings:[{wall:4,kind:'door',width:80}]},
 ceilings:[{wall:1,shape:'landing',depth:115,points:[[0,245],[50,190],[150,190]]}],wardrobes:[]};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  for(const [width,height] of [[375,812],[1440,900]]) for(const scenario of ['sloped','door','tiny']) {
   const tiny=scenario==='tiny',withDoor=scenario==='door';
   const context=await browser.newContext({viewport:{width,height},isMobile:width<=900,hasTouch:width<=900,reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{"message":"Offline regression"}'}));
   const spec=tiny?{specVersion:1,room:{width:70,depth:60},wardrobes:[]}:withDoor?roomSpec:{...roomSpec,room:{...roomSpec.room,openings:[]}};
   const built=buildFromSpec(spec,'studio-regression');assert.ok(built.ok);
   const studio=projectToScene(built.project).studio;
   await page.goto(baseURL+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
   const el=id=>page.locator(`[data-editor-id="${id}"]`),report=()=>page.evaluate(()=>window.wardrobeForge.describe());
   await page.locator('[data-editor-id="add-furniture-btn"]').waitFor();await page.waitForTimeout(500);
   assert.equal((await report()).wardrobes.length,0);
   if(scenario==='sloped' && width===375) await page.screenshot({path:'/tmp/wardrobe-studio-ui-before.png'});
   await page.locator('[data-editor-id="add-furniture-btn"]').click();
   await page.getByRole('button',{name:'Regular',exact:true}).click();await page.waitForTimeout(600);
   if(tiny) {
    assert.equal((await report()).wardrobes.length,0,'No invalid wardrobe is added');
    assert.equal(await page.getByRole('button',{name:'Regular',exact:true}).isVisible(),true,'Failed creation keeps the picker available');
   } else {
    const check=async()=>{
     const result=await report();assert.equal(result.wardrobes.length,1);const w=result.wardrobes[0];
     assert.ok(w.width<=(withDoor?100:150),'Wardrobe fits the narrow room and keeps access to its door');
     assert.ok(w.against!==null && w.from!==null,'The added wardrobe has a real place inside the studio');
     const pose=flushAgainst(studio,'w'+w.against,w.from,{w:w.width,d:w.depth});assert.ok(pose);
     const cabinet={...pose,id:1,y:0,state:{w:w.width,d:w.depth,h:w.height}};
     assert.equal(createCabinetGeometry(()=>[cabinet],()=>studioPlacementObstacles(studio)).cabinetCollides(cabinet),false);
     const shape={template:'custom',top:w.top.map(([x,y])=>({x,y}))};
     assert.equal(ceilingClearance(studio,{...pose,w:w.width,d:w.depth})(shape),false,'Top stays under the real ceiling over the full footprint');
     return w;
    };
    const added=await check();
    await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(350);
    assert.equal((await report()).wardrobes.length,0,'One Undo removes the complete addition');
    await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(500);
    assert.deepEqual(await check(),added,'Redo restores the valid placement');
    const view=await el('view').boundingBox();
    await page.mouse.move(view.x+view.width*.5,view.y+view.height-100);await page.mouse.down();
    await page.mouse.move(view.x+view.width*.5-55,view.y+view.height-100,{steps:10});await page.mouse.up();await page.waitForTimeout(400);
    await page.locator('[data-view-mode="studio"]').click();await page.waitForTimeout(1000);
    await page.locator('.mobile-feedback').waitFor({state:'hidden'});
    const suffix=withDoor?'door':width===375?'mobile':'desktop';
    await page.screenshot({path:'/tmp/wardrobe-studio-ui-'+suffix+'.png'});
   }
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}x${height}: ${scenario}: ${tiny?'unbuildable room rejected without creating a wardrobe':'narrow studio, doorway access, full-depth ceiling fit, undo/redo and orbit'}`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
