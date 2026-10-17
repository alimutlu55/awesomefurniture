const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const engine=process.env.LABEL_BROWSER==='webkit'?webkit:chromium;
// A tap on a measurement opens Size (focusing its field); while Size is open the measurements are controls.
const armSize=async page=>{const b=await page.locator('.scrub-w:visible').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(600);
 await page.evaluate(()=>{const r=document.querySelector('#editor-root')?.getRootNode?.()??document;(r.activeElement??document.activeElement)?.blur?.();});await page.waitForTimeout(300);};
/** Phone: Size is closed, so a tap on a measurement opens Size with its field focused inside the tap (the
 * trusted click iOS needs to show the keyboard); typing there applies, and one undo restores it. */
const phoneEntry=async(page,errors)=>{
 const el=id=>page.locator(`[data-editor-id="${id}"]`);
 await page.evaluate(()=>{window.entryEvents=[];const focus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...a){
  if(this.matches('input'))window.entryEvents.push({id:this.dataset.editorId,inClick:!!window.entryClick&&window.entryClick.eventPhase!==0});return focus.apply(this,a);};
  window.addEventListener('click',e=>{window.entryClick=e;},true);});
 for(const key of ['w','d','h']){
  const badge=page.locator(`.scrub-${key}:visible`),original=Number(await badge.getAttribute('aria-valuenow')),b=await badge.boundingBox();
  await page.evaluate(()=>window.entryEvents=[]);
  await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(500);
  assert.equal(await el('left').getAttribute('data-context-section'),'resize','A tap on the '+key+' measurement opens Size');
  const field=el(key);assert.equal(await field.evaluate(e=>e.getRootNode().activeElement===e),true,'Its field is focused');
  assert.ok((await page.evaluate(()=>window.entryEvents)).some(e=>e.id===key&&e.inClick),'Focus runs inside the tap\'s click');
  await field.fill(String(original+2));await field.press('Enter');await page.waitForTimeout(300);
  assert.equal(Number(await page.locator(`.scrub-${key}`).first().getAttribute('aria-valuenow')),original+2);
  await field.evaluate(e=>e.blur());await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);
  assert.equal(Number(await page.locator(`.scrub-${key}`).first().getAttribute('aria-valuenow')),original,'One undo restores the value');
  await el('left-close').dispatchEvent('click');await page.waitForTimeout(500);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
 }
 assert.deepEqual(errors,[]);console.log('PASS 375px: a tap on each measurement opens Size with its field focused in the tap; typing and one-step undo');
};
(async()=>{const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.CHROME_PATH}:{})});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]})));
  await page.locator('.scrub-w:visible').waitFor();await page.waitForTimeout(500);
  // In Furniture the measurements are controls while Size is open; otherwise a tap opens Size on that field.
  if(width===375){await phoneEntry(page,errors);await page.close();continue;}
  await armSize(page);
  await page.evaluate(()=>{
   window.entryEvents=[];window.entryClick=null;
   const focus=HTMLElement.prototype.focus;
   HTMLElement.prototype.focus=function(...args){
    if(this.matches('.measurement-badge input'))window.entryEvents.push({type:'focus-call',clickActive:!!window.entryClick?.isTrusted && window.entryClick.eventPhase!==0});
    return focus.apply(this,args);
   };
   for(const type of ['pointerup','click','focusin'])window.addEventListener(type,e=>{
    if(type==='click')window.entryClick=e;
    const target=e.composedPath()[0];window.entryEvents.push({type,input:target.tagName==='INPUT'});
   },true);
  });
  const cdp=engine===chromium?await page.context().newCDPSession(page):null;
  for(const [index,key] of ['w','d','h','w','d','h'].entries()){
   const badge=()=>page.locator(`.scrub-${key}:visible`),original=Number(await badge().getAttribute('aria-valuenow'));
   const b=await badge().boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   await page.evaluate(()=>window.entryEvents=[]);
   if(width===375 && cdp){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else if(width===375)await badge().tap();else await badge().click();
   const input=page.locator('.measurement-badge.is-editing input');await input.waitFor();await page.waitForTimeout(400);
   assert.equal(await input.evaluate(e=>e.getRootNode().activeElement===e),true,'The completed tap keeps the input focused');
   const trace=await page.evaluate(()=>window.entryEvents);
   assert.ok(trace.some(e=>e.type==='focus-call'&&e.clickActive),'Focus runs synchronously inside the trusted native click: '+JSON.stringify(trace));
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
