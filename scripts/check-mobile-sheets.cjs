// Shared mounted-sheet gesture checks. Run with Vite running.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  for (const [width,height] of [[390,844],[844,390]]) for (const [name,id] of [['Settings','left'],['Add item','pop2'],['Item settings','pop3'],['Divider settings','pop4'],['Auto design','wizard']]) {
   const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   await page.goto(process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173');
   const control=id=>page.locator(`[data-editor-id="${id}"]`);
   await control('wardrobe-btn').waitFor();
   if(id==='left') {
    const box=await control('view').boundingBox();
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height*.45);
    assert.equal(await control('pop2').isVisible(),false,'Selecting a wardrobe does not trigger a new Add item button');
    await control('toolbar').locator('[data-action="resize"]').tap();
   }
   else if(id==='pop2') {
    // Add item is on the model: select the wardrobe, then its section's Add item.
    const box=await control('view').boundingBox();
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height*.45);await page.waitForTimeout(400);
    await page.locator('.lbl.add:visible').first().tap();
   }
   else if(id==='wizard') await control('launch-wizard').evaluate(b=>b.click());
   else {
    // Mount the item/divider sheet independently of scene selection. Their
    // actual selection and form workflows are covered by check-mobile.cjs.
    await page.evaluate(id=>{
     const root=document.querySelector('#editor-root').shadowRoot;
     root.querySelector(`[data-editor-id="${id}"]`).classList.add('show');
     root.querySelector('[data-editor-id="app"]').classList.add('inspecting');
    },id);
   }
   const panel=id==='wizard'?control(id).locator('.wizard-shell'):control(id);
   await panel.waitFor();
   assert.equal(await control('toolbar').isVisible(),false,`${name}: panel takes over toolbar`);
   const drag=async distance=>{
    await panel.evaluate((e,distance)=>{
     e.scrollTop=0;
     const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
     const send=(type,dy)=>{
      const touch=new Touch({identifier:1,target:e,clientX:x,clientY:y+dy});
      e.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
     };
     send('touchstart',0);send('touchmove',distance);
    },distance);
    assert.ok(await panel.evaluate(e=>e.hasAttribute('data-sheet-dragging')||parseFloat(e.style.translate.split(' ')[1])>0),`${name}: drag from the panel body`);
    const scene=await control('view').boundingBox(),sheet=await panel.boundingBox();
    assert.ok(scene.y+scene.height>=sheet.y-1,`${name}: no canvas gap during body dragging`);
    await panel.evaluate(e=>e.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[]})));
   };
   if(id==='wizard') await drag(100);
   await drag(-100);
   assert.equal(await panel.getAttribute('data-sheet-position'),id==='wizard'?'full':'expanded',`${name}: expand from the body`);
   await drag(100);
   assert.equal(await panel.getAttribute('data-sheet-position'),'compact',`${name}: lower from the body`);
   await drag(90);
   assert.equal(await panel.isVisible(),false,`${name}: close from the body`);
   assert.equal(await control('toolbar').isVisible(),true,`${name}: closing restores toolbar`);
   console.log(`PASS ${width}×${height} ${name}: body drag, expand/lower/close, no gap`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
