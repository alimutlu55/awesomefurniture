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
   await el('add-furniture-btn').waitFor();
   await page.waitForTimeout(450);
   // A press on a fitting chooses that fitting; Wardrobe chooses the wardrobe itself.
   if(pointer==='touch')await el('wardrobe-btn').tap();else await el('wardrobe-btn').click();await page.waitForTimeout(450);
   await page.getByRole('button',{name:'Resize',exact:true}).click();
   await page.waitForTimeout(350);
   if(width<=900) {
    assert.ok(Math.abs((await el('left').boundingBox()).height-height*.5)<1,'Resize drawer gets 50%');
    assert.ok(Math.abs((await el('view').boundingBox()).height-height*.5)<1,'Resize model gets 50%');
   }
   if(width===375 && pointer==='touch') await page.screenshot({path:'/tmp/wardrobe-sizing-mobile.png'});
   await page.keyboard.press('Escape');await page.waitForTimeout(300);
   await page.getByRole('button',{name:'Shape',exact:true}).click();
   await page.waitForTimeout(350);
   const handle=()=>page.locator('.shape-handle.point[data-side="front"][data-index="0"]');
   const pointField=()=>page.locator('.shape-row[data-point="0"] input[data-k="y"]:not([data-side="rear"])');
   const label=()=>handle().getAttribute('aria-label');
   const focused=async()=>{
    assert.equal(await el('left').isVisible(),true,'A shape edit must keep its panel open');
    assert.equal(await el('left').getAttribute('data-context-section'),'shape');
    assert.equal(await el('topright').isVisible(),false,'Storage/Menu stay hidden during editing');
    assert.ok(await page.locator('.shape-handle.point').count()>=2,'Shape handles remain available');
   };
   const stableHandle=async(target)=>{
    let previous;
    for(let n=0;n<40;n++) {
     const box=await target.boundingBox();
     if(previous && Math.abs(box.x-previous.x)+Math.abs(box.y-previous.y)<.1) return box;
     previous=box;await page.waitForTimeout(100);
    }
    throw Error('Shape handle did not settle');
   };
   const drag=async (dy,cancel=false,target=handle(),dx=0)=>{
    const box=await stableHandle(target),x=box.x+box.width/2,y=box.y+box.height/2;
    const surface=await el('view').boundingBox();
    assert.ok(x>surface.x && x<surface.x+surface.width && y>surface.y && y<surface.y+surface.height,'The handle must stay on-screen and hittable');
    if(pointer==='touch') {
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     for(let step=1;step<=8;step++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/8,y:y+dy*step/8,id:1}]});
      await page.waitForTimeout(20);
     }
     await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    } else {
     await page.mouse.move(x,y);await page.mouse.down();
     await page.mouse.move(x+dx,y+dy,{steps:8});
     if(cancel) {
      await target.dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});
      // Native cancellation has no subsequent pointerup. Release Playwright's
      // held mouse over the original control rather than clicking the canvas.
      await page.mouse.move(x,y);
     }
     await page.mouse.up();
    }
    await page.waitForTimeout(350);
   };
   await focused();
   if(width<=900) {
    const sheet=await el('left').boundingBox(),canvas=await el('view').boundingBox();
    assert.ok(Math.abs(sheet.height-height*.25)<1,'Shape drawer gets 25%');
    assert.ok(Math.abs(canvas.height-height*.75)<1,'Shape model gets 75%');
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
   const plus=page.locator('.shape-handle.split-handle:visible');
   assert.equal(await plus.count(),1,'Only one insertion cursor is visible');
   const cursorBefore=await stableHandle(plus);
   await drag(0,true,plus,35);
   assert.ok(Math.abs((await plus.boundingBox()).x-cursorBefore.x)<1,'Cancelled cursor movement restores its position');
   await drag(0,false,plus,35);
   assert.ok(Math.abs((await plus.boundingBox()).x-cursorBefore.x)>8,'The single cursor moves along the top');
   const count=await page.locator('.shape-handle.point').count();
   if(pointer==='touch') await plus.tap(); else await plus.click();
   await page.waitForTimeout(300);await focused();
   assert.equal(await page.locator('.shape-handle.point').count(),count+2,'Adding a break point keeps editing open');
   // Rebuilt number controls must accept consecutive changes too.
   for(let n=0;n<2;n++) {
    const value=Number(await pointField().inputValue())-2;
    await pointField().fill(String(value));await pointField().press('Tab');
    await page.waitForTimeout(250);await focused();
    assert.equal(Number(await pointField().inputValue()),value);
   }
   const orbit=async()=>{
    const box=await el('view').boundingBox(),x=box.x+box.width/2,y=box.y+box.height-18;
    for(let n=0;n<4;n++){
     if(pointer==='touch'){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      for(let k=1;k<=8;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+112*k/8,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+112,y,{steps:8});await page.mouse.up();}
    }
    await page.waitForTimeout(350);await focused();
   };
   assert.equal(await page.locator('.shape-handle.point[data-side="rear"]:visible').count(),0,'Rear controls do not crowd the front');
   await orbit();
   assert.equal(await page.locator('.shape-handle.point[data-side="front"]:visible').count(),0,'Orbit swaps to a single rear edge');
   const rear=page.locator('.shape-handle.point[data-side="rear"][data-index="0"]');
   const frontBeforeRear=await label(),rearBefore=await rear.getAttribute('aria-label');
   await drag(18,false,rear);await focused();
   assert.notEqual(await rear.getAttribute('aria-label'),rearBefore,'Rear handle changes its own profile');
   assert.equal(await label(),frontBeforeRear,'Rear height editing leaves the front unchanged');
   const rearCommitted=await rear.getAttribute('aria-label');
   await drag(-12,true,rear);await focused();
   assert.equal(await rear.getAttribute('aria-label'),rearCommitted,'Rear cancellation restores both profiles');
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);await focused();
   assert.equal(await rear.getAttribute('aria-label'),rearBefore,'Rear edit undoes in one step');
   await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(300);await focused();
   assert.equal(await rear.getAttribute('aria-label'),rearCommitted);
   const widthRead=async()=>{
    // Front right x is the outer width; the rear shares that footprint.
    const text=await page.locator('.shape-handle.point[data-side="front"]').last().getAttribute('aria-label');
    return Number(text.match(/x ([\d.]+)/)[1]);
   };
   await orbit();
   const oldWidth=await widthRead();
   await drag(0,false,handle(),-22);await focused();
   assert.ok(await widthRead()>oldWidth+2,'Outer corner drags horizontally to grow width');
   const grownWidth=await widthRead();
   await drag(0,true,handle(),-15);await focused();
   assert.equal(await widthRead(),grownWidth,'Cancelled horizontal drag restores width');
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);await focused();
   assert.equal(await widthRead(),oldWidth,'Width and pose undo together');
   await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(300);await focused();
   assert.equal(await widthRead(),grownWidth);
   await orbit();
   const join=page.locator('.shape-handle.point[data-side="rear"][data-index="1"]');
   const joinBefore=await join.getAttribute('aria-label');
   await drag(0,false,join,16);await focused();
   assert.notEqual(await join.getAttribute('aria-label'),joinBefore,'Rear interior break point slides horizontally');
   assert.equal(await widthRead(),grownWidth,'Moving an interior join keeps the width');
   if(width===375 && pointer==='touch') await page.screenshot({path:'/tmp/wardrobe-rear-shaping-mobile.png'});
   if(width===1440) await page.screenshot({path:'/tmp/wardrobe-rear-shaping-desktop.png'});
   await orbit();
   for(const template of ['Sloped','Regular','Custom']) {
    const chip=page.getByRole('button',{name:template,exact:true});
    if(pointer==='touch') await chip.tap();else await chip.click();
    await page.waitForTimeout(300);await focused();
   }
   await drag(10);await focused();
   // Orbit in the Shape session to reach the back edge. Model-body movement
   // and canvas release must not move the wardrobe or dismiss its drawer.
   const surface=await el('view').boundingBox(),ox=surface.x+surface.width/2,oy=surface.y+surface.height-18;
   await orbit();
   assert.equal(await rear.isVisible(),true,'Rear edge is reachable by orbiting');
   if(pointer==='touch') {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:ox,y:oy,id:1}]});
    for(let step=1;step<=10;step++) {
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ox+80*step/10,y:oy,id:1}]});
     await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   } else {
    await page.mouse.move(ox,oy);await page.mouse.down();await page.mouse.move(ox+80,oy,{steps:10});await page.mouse.up();
   }
   await page.waitForTimeout(350);await focused();
   assert.equal(await rear.isVisible(),true,'Rear controls stay available at an angle');
   const angleRearBefore=await rear.getAttribute('aria-label');
   await drag(14,false,rear);await focused();
   assert.notEqual(await rear.getAttribute('aria-label'),angleRearBefore,'Rear handles work from an angled view');
   if(width===375 && pointer==='touch') await page.screenshot({path:'/tmp/wardrobe-rear-shaping-mobile.png'});
   if(width===1440) await page.screenshot({path:'/tmp/wardrobe-rear-shaping-desktop.png'});
   if(width===375 && pointer==='touch') await page.screenshot({path:'/tmp/wardrobe-shape-editing-mobile.png'});
   if(width===1440) await page.screenshot({path:'/tmp/wardrobe-shape-editing-desktop.png'});
   await page.keyboard.press('Escape');await page.waitForTimeout(300);
   assert.equal(await el('left').isVisible(),false,'Explicit Escape still ends panel editing');
   assert.equal(await el('topright').isVisible(),true,'Leaving restores global controls');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}x${height} ${pointer}: repeated drags, cancel, undo/redo, break point, numeric edits, templates, rear edits, horizontal width/joins and explicit exit`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
