const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]]) {
   const mobile=width<=900,page=await browser.newPage({viewport:{width,height},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const c=id=>page.locator(`[data-editor-id="${id}"]`),tap=async el=>mobile?el.tap():el.click();
   await page.goto(process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173');await c('props-btn').waitFor();
   const back=page.locator('.mobile-focus-back');
   if(mobile){
    await tap(c('props-btn'));assert.equal(await c('app').getAttribute('data-focus-mode'),'settings');
    for(const mode of ['resize','sections','reach','finish','doors','manage']){
     await tap(page.locator(`[data-focus-action="${mode}"]`));
     assert.equal(await c('app').getAttribute('data-focus-mode'),mode);
     await page.waitForTimeout(100);
     const view=await c('view').boundingBox(),controls=await page.locator('.mobile-focus-controls').boundingBox();
     assert.ok(view.x+view.width<=controls.x+1,'Wardrobe must be left of action controls');
     assert.equal(await c('toolbar').isVisible(),false);assert.equal(await c('props-btn').isVisible(),false);
     if(mode==='resize'){
      await c('d-range').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
      assert.equal(await c('d').inputValue(),'65');
     }
     await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),'settings');
    }
    await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),null);
    for(const [trigger,mode] of [['fitchip','storage'],['menu-btn','menu'],['launch-wizard','auto-design']]){
     await tap(c(trigger));await page.waitForTimeout(100);
     assert.equal(await c('app').getAttribute('data-focus-mode'),mode);
     assert.equal(await c('view').isVisible(),true);
     assert.equal(await c('app').evaluate(e=>e.inert),false,'Focused actions must leave the wardrobe preview available');
     await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),null);
    }
    await page.waitForTimeout(100);const originalView=await c('c').screenshot();
    await tap(c('more-btn'));await page.waitForTimeout(100);
    assert.equal(await c('app').getAttribute('data-focus-mode'),'add');
    assert.equal(await c('padd').locator('.no').first().isVisible().catch(()=>false),false,'Non-fitting choices must be hidden');
    await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),null);
    await page.waitForTimeout(100);assert.deepEqual(await c('c').screenshot(),originalView,'Back must restore the exact previous camera view');
    await tap(c('more-btn'));await tap(c('padd').locator('[data-m="short"]'));
    await page.waitForTimeout(100);assert.equal(await c('app').getAttribute('data-focus-mode'),null,'Adding returns to the previous view');
    const canvas=await c('view').boundingBox();
    selection:for(const y of [.6,.55,.65,.5])for(const x of [.35,.45,.6,.65]){
     for(let n=0;n<2;n++)await page.touchscreen.tap(canvas.x+canvas.width*x,canvas.y+canvas.height*y);
     if(await c('app').getAttribute('data-focus-mode')==='item')break selection;
    }
    assert.equal(await c('app').getAttribute('data-focus-mode'),'item','Selecting an item opens its action menu');
    for(const mode of ['item-resize','item-align','item-purpose','item-finish','item-move','item-type','item-measure']){
     await tap(page.locator(`[data-focus-action="${mode}"]`));assert.equal(await c('app').getAttribute('data-focus-mode'),mode);
     assert.equal(await page.locator('.mobile-focus-controls').isVisible(),true);
     await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),'item');
    }
    await tap(back);
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(100);
    assert.equal(await page.locator('.mobile-focus-controls').isVisible(),false);
    assert.ok(await c('left').locator('[data-editor-id="sliders"]').count(),'Controls return to desktop homes');
   }else{
    await tap(c('more-btn'));assert.equal(await c('pop2').isVisible(),true);assert.equal(await page.locator('.mobile-focus-controls').isVisible(),false);
    assert.equal(await c('app').getAttribute('data-focus-mode'),null);
   }
   assert.deepEqual(errors,[]);console.log(`PASS focus ${width}×${height}`);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
