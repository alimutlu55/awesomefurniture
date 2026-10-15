const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440])for(const removedLast of [false,true]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:width===375,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,...(removedLast?{room:{template:'wall'}}:{}),wardrobes:[]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  await page.locator('[data-view-mode="studio"]').click();await page.waitForTimeout(450);
  if(removedLast){
   select:for(const y of [.4,.3,.5,.6,.25])for(const x of [.5,.35,.65]){
    const b=await el('view').boundingBox();await page.mouse.click(b.x+b.width*x,b.y+b.height*y);
    if(await el('toolbar').getAttribute('data-context')==='wall')break select;
   }
   assert.equal(await el('toolbar').getAttribute('data-context'),'wall');
   await page.keyboard.press('Delete');await page.waitForTimeout(250);assert.equal((await report()).room.walls.length,0);
  }
  const before=await report();await el('toolbar').locator('[data-action="walls"]:visible,[data-editor-id="walls-btn"]:visible').first().click();await page.waitForTimeout(300);
  await el('pop2').locator('[data-add-room="wall"]:visible').first().click();await page.waitForTimeout(350);
  const after=await report();assert.equal(after.room.walls.length,1);assert.equal(after.wardrobes.length,before.wardrobes.length);
  assert.doesNotMatch((await page.locator('.mobile-feedback').allTextContents()).join(' '),/no free space for another wall/i);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.deepEqual(await report(),before,'One undo restores the empty scene');
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(250);assert.deepEqual(await report(),after);
  if(removedLast)await page.screenshot({path:'/tmp/wardrobe-first-wall-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px ${removedLast?'last wall deleted':'no Studio yet'}: add wall, no false warning, undo and redo`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
