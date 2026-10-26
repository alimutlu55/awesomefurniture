const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
const engine=process.env.LABEL_BROWSER==='webkit'?webkit:chromium;
// Measurements on the model are read-only: a tap or a key on one opens no field and changes nothing. Exact
// values are typed in Size, in fields large enough that a phone does not zoom, and one undo restores them.
(async()=>{const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.CHROME_PATH}:{})});try{
 for(const width of [375,1440]){
  const touch=width===375,page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:touch,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]})));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),size=()=>page.evaluate(()=>{const w=window.furnidraw.describe().wardrobes[0];return {w:w.width,h:w.height,d:w.depth};});
  await page.waitForTimeout(500);await selectFurniture(page,{touch});
  const before=await size();
  for(const key of ['w','d','h']){
   const badge=page.locator(`.scrub-${key}:visible`);await badge.waitFor();
   assert.equal(await badge.getAttribute('role'),'meter','The '+key+' measurement reads, it is not a control');
   assert.equal(Number(await badge.getAttribute('aria-valuenow')),before[key]);
   // Read-only labels let a finger through to the model: tap where it is, as a person would.
   const b=await badge.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);await page.waitForTimeout(300);
   assert.equal(await page.locator('.measurement-badge input').count(),0,'A tap opens no field on the model');
   for(const k of ['ArrowUp','Enter','Home'])await page.keyboard.press(k);
   assert.deepEqual(await size(),before,'Nothing on the model changes the size');
   // The tap went through to whatever is under the label: back to the whole wardrobe for the next one.
   for(let n=0;n<3;n++){await el('c').focus();await page.keyboard.press('Escape');await page.waitForTimeout(200);}
   await selectFurniture(page,{touch});
  }
  await el('toolbar').locator('[data-action="resize"]:visible').click();
  for(const key of ['w','d','h']){
   const field=el(key);await field.waitFor({state:'visible'});
   assert.ok(Number(await field.evaluate(e=>getComputedStyle(e).fontSize.replace('px','')))>=16,'No small-input Safari auto zoom on the '+key+' field');
   await field.fill(String(before[key]+2));await field.press('Tab');await page.waitForTimeout(250);
   assert.equal((await size())[key],before[key]+2);
   assert.equal(Number(await page.locator(`.scrub-${key}`).first().getAttribute('aria-valuenow')),before[key]+2,'The measurement follows the typed value');
   await el('c').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);
   assert.equal((await size())[key],before[key],'One undo restores the value');
  }
  await page.screenshot({path:`/tmp/wardrobe-label-entry-${width}.png`});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: measurements are read-only; Size fields take typed values without phone zoom, one-step undo`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
