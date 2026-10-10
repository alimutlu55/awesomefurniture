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
     assert.ok(view.y+view.height<=controls.y+1,'Wardrobe must be above action controls');
     assert.ok(Math.abs(controls.height/(view.height+controls.height)-.25)<.01,'Tools must occupy 25% of the editor');
     assert.ok(Math.abs(view.width-controls.width)<1,'Bottom controls must span the editor width');
     assert.equal(await c('toolbar').isVisible(),false);
     assert.equal(await c('pop2').isVisible(),false,'Unrelated item picker must remain hidden');assert.equal(await c('props-btn').isVisible(),false);
     if(mode==='resize'){
      const dimensions=await Promise.all(['w','h','d'].map(id=>c(id).boundingBox()));
      assert.ok(dimensions.every(box=>Math.abs(box.y-dimensions[0].y)<1),'Dimensions must form one horizontal row');
      assert.ok(dimensions[0].x<dimensions[1].x&&dimensions[1].x<dimensions[2].x,'Dimension order must be horizontal');
      assert.equal(await c('w').evaluate(e=>getComputedStyle(e.closest('.size-field')).borderRadius),'0px');
      await c('d').scrollIntoViewIfNeeded();
      assert.ok(await c('d').evaluate(e=>{const box=e.getBoundingClientRect(),panel=e.closest('.mobile-focus-body').getBoundingClientRect();return box.left>=panel.left&&box.right<=panel.right;}),'Depth must be reachable by horizontal scrolling');
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
    await page.waitForTimeout(500);const originalView=await c('c').screenshot();
    await tap(c('more-btn'));await page.waitForTimeout(100);
    assert.equal(await c('app').getAttribute('data-focus-mode'),'add');
    assert.equal(await c('padd').locator('.no').first().isVisible().catch(()=>false),false,'Non-fitting choices must be hidden');
    await tap(back);assert.equal(await c('app').getAttribute('data-focus-mode'),null);
    await page.waitForTimeout(500);
    const restoredView=await c('c').screenshot();
    if(!restoredView.equals(originalView)){
     const diff=await page.evaluate(async images=>{
      const pixels=await Promise.all(images.map(async src=>{const img=new Image();img.src='data:image/png;base64,'+src;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;}));
      let changed=0,max=0;for(let i=0;i<pixels[0].length;i++){const delta=Math.abs(pixels[0][i]-pixels[1][i]);if(delta)changed++;max=Math.max(max,delta);}return {changed,max,total:pixels[0].length};
     },[originalView.toString('base64'),restoredView.toString('base64')]);
     // GPU rasterization can differ by one shade after projection resizing.
     assert.ok(diff.max<=1&&diff.changed/diff.total<.001,`Back must restore the previous camera view: ${JSON.stringify(diff)}`);
    }
    await tap(c('more-btn'));await tap(c('padd').locator('[data-m="short"]'));
    await page.waitForTimeout(100);assert.equal(await c('app').getAttribute('data-focus-mode'),null,'Adding returns to the previous view');
    const canvas=await c('view').boundingBox();
    selection:for(const y of [.6,.55,.65,.5])for(const x of [.35,.45,.6,.65]){
     for(let n=0;n<2;n++)await page.touchscreen.tap(canvas.x+canvas.width*x,canvas.y+canvas.height*y);
     if(await c('app').getAttribute('data-focus-mode')==='item')break selection;
    }
    assert.equal(await c('app').getAttribute('data-focus-mode'),'item','Selecting an item opens its action menu');
    for(const mode of ['item-resize','item-align','item-purpose','item-finish','item-move','item-swap','item-type','item-measure']){
     await tap(page.locator(`[data-focus-action="${mode}"]`));assert.equal(await c('app').getAttribute('data-focus-mode'),mode);
     assert.equal(await page.locator('.mobile-focus-controls').isVisible(),true);
     if(mode==='item-finish'){
      assert.equal(await c('ifin').locator('button').count(),6);
      await tap(c('ifin').locator('[data-f="Walnut"]'));
      assert.equal(await c('ifin').locator('[data-f="Walnut"]').evaluate(e=>e.classList.contains('on')),true,'Finish must update the selected item');
     }
     if(mode==='item-type'){
      assert.ok(await c('itype').locator('button').count()>0,'Type picker must contain item choices');
      await tap(c('itype').locator('[data-t="shelf"]'));
      assert.equal(await c('itype').locator('[data-t="shelf"]').evaluate(e=>e.classList.contains('on')),true,'Type selection must update the item');
     }
     if(mode==='item-resize'){
      const before=Number(await c('ih').inputValue());await c('ih').fill(String(before-1));await c('ih').blur();
      assert.equal(Number(await c('ih').inputValue()),before-1,'Item size must update');
     }
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
