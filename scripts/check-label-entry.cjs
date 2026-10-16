const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]})));
  await page.locator('.scrub-w:visible').waitFor();await page.waitForTimeout(500);
  await page.evaluate(()=>{
   window.entryEvents=[];
   for(const type of ['pointerup','click','focusin'])window.addEventListener(type,e=>{
    const target=e.composedPath()[0];window.entryEvents.push({type,input:target.tagName==='INPUT'});
   },true);
  });
  const cdp=await page.context().newCDPSession(page);
  for(const [index,key] of ['w','d','h','w','d','h'].entries()){
   const badge=()=>page.locator(`.scrub-${key}:visible`),original=Number(await badge().getAttribute('aria-valuenow'));
   const b=await badge().boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   await page.evaluate(()=>window.entryEvents=[]);
   if(width===375){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else await badge().click();
   const input=page.locator('.measurement-badge.is-editing input');await input.waitFor();await page.waitForTimeout(400);
   assert.equal(await input.evaluate(e=>e.getRootNode().activeElement===e),true,'The completed tap keeps the input focused');
   const trace=await page.evaluate(()=>window.entryEvents);
   assert.ok(trace.some(e=>e.type==='focusin'&&e.input),'The tap focuses the inline editor: '+JSON.stringify(trace));
   assert.ok(Number(await input.evaluate(e=>getComputedStyle(e).fontSize.replace('px','')))>=16,'No small-input Safari auto zoom');
   if(width===375){
    await page.setViewportSize({width,height:420});await page.waitForTimeout(350);
    assert.equal(await page.locator('#editor-root').getAttribute('data-keyboard-open'),'','The software keyboard layout is active');
    assert.equal(await input.evaluate(e=>e.getRootNode().activeElement===e),true,'Keyboard resize keeps the same field focused');
    const field=await input.boundingBox(),root=await page.locator('#editor-root').boundingBox();
    assert.ok(field.y>=root.y && field.y+field.height<=root.y+root.height,'The editor stays above the keyboard');
    await input.tap();await page.waitForTimeout(200);assert.equal(await input.count(),1,'Tapping inside the open field does not dismiss it');
   }
   await input.press('ControlOrMeta+a');await input.pressSequentially(String(original+1.5),{delay:60});
   assert.equal(await input.count(),1,'Typing never replaces the active field');
   if(index===5)await page.screenshot({path:`/tmp/wardrobe-label-entry-${width}.png`});
   await input.press('Enter');await page.waitForTimeout(250);assert.equal(await input.count(),0);
   assert.equal(Number(await badge().getAttribute('aria-valuenow')),original+1.5);
   if(width===375){await page.setViewportSize({width,height:812});await page.waitForTimeout(250);}
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);
   assert.equal(Number(await badge().getAttribute('aria-valuenow')),original,'One undo restores the value');
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: six repeated label taps stay open through keyboard resize, typing and one-step undo`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
