// Real browser input regression: commits, cancellation and history must keep Shape editing open.
// Start the production preview; optionally set MOBILE_TEST_URL and CHROME_PATH.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseURL = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  for (const [width,height,pointer] of [[375,812,'touch'],[844,390,'touch'],[375,812,'mouse'],[1440,900,'mouse']]) {
   const context = await browser.newContext({viewport:{width,height},isMobile:width<=900,hasTouch:true,reducedMotion:'reduce'});
   const page = await context.newPage(), cdp = await context.newCDPSession(page);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // No live account or existing design is changed by this test.
   await page.route('https://*.supabase.co/**',route=>route.fulfill({status:400,contentType:'application/json',body:'{"message":"Offline test"}'}));
   const spec={specVersion:1,wardrobes:[{width:200,height:230,for:{short:12,shoes:4}}]};
   await page.goto(baseURL+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
   const el=id=>page.locator(`[data-editor-id="${id}"]`);
   await el('more-btn').waitFor();
   await page.waitForTimeout(450);
   const view=await el('view').boundingBox();
   await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);
   await page.getByRole('button',{name:'Shape',exact:true}).click();
   await page.waitForTimeout(350);
   const handle=()=>page.getByRole('button',{name:/Break point 1,/});
   const pointField=()=>page.locator('.shape-row[data-point="0"] input[data-k="y"]');
   const label=()=>handle().getAttribute('aria-label');
   const focused=async()=>{
    assert.equal(await el('left').isVisible(),true,'A shape edit must keep its panel open');
    assert.equal(await el('left').getAttribute('data-context-section'),'shape');
    assert.equal(await el('topright').isVisible(),false,'Storage/Menu stay hidden during editing');
    assert.ok(await page.locator('.shape-handle.point').count()>=2,'Shape handles remain available');
   };
   const stableHandle=async()=>{
    let previous;
    for(let n=0;n<40;n++) {
     const box=await handle().boundingBox();
     if(previous && Math.abs(box.x-previous.x)+Math.abs(box.y-previous.y)<.1) return box;
     previous=box;await page.waitForTimeout(100);
    }
    throw Error('Shape handle did not settle');
   };
   const drag=async (dy,cancel=false)=>{
    const box=await stableHandle(),x=box.x+box.width/2,y=box.y+box.height/2;
    const surface=await el('view').boundingBox();
    assert.ok(x>surface.x && x<surface.x+surface.width && y>surface.y && y<surface.y+surface.height,'The handle must stay on-screen and hittable');
    if(pointer==='touch') {
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     for(let step=1;step<=8;step++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*step/8,id:1}]});
      await page.waitForTimeout(20);
     }
     await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    } else {
     await page.mouse.move(x,y);await page.mouse.down();
     await page.mouse.move(x,y+dy,{steps:8});
     if(cancel) await handle().dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});
     await page.mouse.up();
    }
    await page.waitForTimeout(350);
   };
   await focused();
   if(width<=900) {
    const sheet=await el('left').boundingBox(),canvas=await el('view').boundingBox();
    assert.ok(Math.abs(sheet.height-height/2)<1,'Editing drawer gets 50%');
    assert.ok(Math.abs(canvas.height-height/2)<1,'Model gets 50%');
   }
   const before=await label();
   await drag(22);await focused();
   const first=await label();assert.notEqual(first,before,'The first drag changes the geometry');
   await drag(16);await focused();
   const second=await label();assert.notEqual(second,first,'A second edit works without reopening Shape');
   await drag(-14,true);await focused();
   assert.equal(await label(),second,'Cancelling a drag restores the last committed shape');
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);await focused();
   assert.equal(await label(),first,'Undo reverts one complete drag');
   await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(300);await focused();
   assert.equal(await label(),second,'Redo restores it without leaving Shape');
   // Tap the real on-model + marker: pointerup precedes click and must not dismiss the sheet.
   const plus=page.locator('.shape-handle.split-handle').first();
   const count=await page.locator('.shape-handle.point').count();
   if(pointer==='touch') await plus.tap(); else await plus.click();
   await page.waitForTimeout(300);await focused();
   assert.equal(await page.locator('.shape-handle.point').count(),count+1,'Adding a break point keeps editing open');
   // Rebuilt number controls must accept consecutive changes too.
   for(let n=0;n<2;n++) {
    const value=Number(await pointField().inputValue())-2;
    await pointField().fill(String(value));await pointField().press('Tab');
    await page.waitForTimeout(250);await focused();
    assert.equal(Number(await pointField().inputValue()),value);
   }
   for(const template of ['Sloped','Regular','Custom']) {
    const chip=page.getByRole('button',{name:template,exact:true});
    if(pointer==='touch') await chip.tap();else await chip.click();
    await page.waitForTimeout(300);await focused();
   }
   await drag(10);await focused();
   if(width===375 && pointer==='touch') await page.screenshot({path:'/tmp/wardrobe-shape-editing-mobile.png'});
   if(width===1440) await page.screenshot({path:'/tmp/wardrobe-shape-editing-desktop.png'});
   await page.keyboard.press('Escape');await page.waitForTimeout(300);
   assert.equal(await el('left').isVisible(),false,'Explicit Escape still ends panel editing');
   assert.equal(await el('topright').isVisible(),true,'Leaving restores global controls');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}x${height} ${pointer}: repeated drags, cancel, undo/redo, break point, numeric edits, templates and explicit exit`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
