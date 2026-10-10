const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const [width,height] of (process.env.TOOLBAR_LANDSCAPE ? [[844,390]] : [[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]])) {
  const page=await browser.newPage({viewport:{width,height},isMobile:width<=900,hasTouch:width<=900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');
  const el=id=>page.locator(`[data-editor-id="${id}"]`);
  await el('more-btn').waitFor();
  const toolbar=el('toolbar');
  const selected=async()=>{
   const box=await el('view').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height*.45);
   await page.waitForTimeout(350);
  };
  if(width>900) { assert.equal(await el('props-btn').isVisible(),true);assert.equal(await toolbar.locator('.contextual-actions').isVisible(),false); }
  else {
   assert.equal(await el('props-btn').isVisible(),false);
   assert.equal(await toolbar.getAttribute('data-context'),'none');
   assert.equal(await el('launch-wizard').isVisible(),true);
   const checkActionSlots=async()=>{
    const buttons=await toolbar.locator('button.tb:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width};}));
    assert.ok(buttons.length>=4);
    for(let i=1;i<buttons.length;i++){
     assert.ok(Math.abs(buttons[i].width-buttons[0].width)<1,'Every visible action gets an equal-width slot: '+JSON.stringify(buttons));
     assert.ok(Math.abs(buttons[i].x-(buttons[i-1].x+buttons[i-1].width))<1,'No unused spacer between actions');
    }
    assert.deepEqual(await toolbar.locator('button.tb:visible').evaluateAll(es=>es.slice(-2).map(e=>e.dataset.editorId)),['undo2','redo2'],'History occupies the last two slots');
   };
   await checkActionSlots();
   await selected();
   assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
   assert.deepEqual(await toolbar.locator('[data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['move','resize','sections','more']);
   assert.equal(await page.locator('.lbl.add').isVisible(),true,'First tap shows internal Add item');
   if(width===390) await page.screenshot({path:'/tmp/contextual-selected.png'});
   await checkActionSlots();
   await toolbar.locator('[data-action="resize"]').click();await page.waitForTimeout(320);
   assert.equal(await toolbar.isVisible(),false,'Properties take over the toolbar');
   await el('fitchip').click();
   assert.equal(await el('left').isVisible(),false,'Storage replaces properties');
   assert.equal(await el('plan-panel').isVisible(),true);
   assert.equal(await toolbar.isVisible(),false);
   await el('menu-btn').click();
   assert.equal(await el('plan-panel').isVisible(),false,'Menu replaces storage');
   assert.equal(await el('menu').isVisible(),true);
   await el('menu-btn').click();
   assert.equal(await toolbar.isVisible(),true);
   await toolbar.locator('[data-action="resize"]').click();await page.waitForTimeout(320);
   assert.equal(await el('left').isVisible(),true);
   assert.equal(await el('w').isVisible(),true);
   assert.equal(await el('section-row').isVisible(),false);
   for(const key of ['w','h','d']) {
    const slider=el(key+'-range'), before=await el(key).inputValue();
    await slider.evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));e.value=String(Number(e.value)+1);e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(Number(await el(key).inputValue()),Number(before)+1,'Live '+key+' slider');
    await slider.dispatchEvent('pointercancel',{pointerType:'touch',isPrimary:true});
    assert.equal(await el(key).inputValue(),before);
   }
   await el('d').focus();
   const keyboardHeight=Math.min(300,height-150);
   await page.evaluate(visibleHeight=>{
    Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>visibleHeight});
    Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>visibleHeight});
    Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>110});
    window.visualViewport.dispatchEvent(new Event('resize'));
   },keyboardHeight);
   await page.waitForTimeout(100);
   assert.equal(await el('d').evaluate(e=>e.getRootNode().activeElement===e),true);
   assert.equal(await toolbar.isVisible(),false,'Keyboard preserves focused input and hides toolbar');
   const editorBox=await page.locator('#editor-root').boundingBox(),inputBox=await el('d').boundingBox();
   assert.ok(inputBox.y>=editorBox.y && inputBox.y+inputBox.height<=editorBox.y+editorBox.height,'Depth stays above keyboard');
   await el('d').blur();
   await page.evaluate(()=>{delete window.innerHeight;delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
   await page.waitForTimeout(100);
   assert.equal(await el('left').evaluate(e=>getComputedStyle(e).animationName),'mobile-sheet-enter');
   const closeProperties=async()=>{
    await el('left').locator('.mobile-sheet-handle').evaluate(e=>{
     const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
     for(const [type,dy] of [['touchstart',0],['touchmove',90],['touchend',90]]){
      const touch=new Touch({identifier:1,target:e,clientX:x,clientY:y+dy});
      e.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
     }
    });
    await page.waitForTimeout(350);
    assert.equal(await toolbar.isVisible(),true,'Closing restores contextual actions');
   };
   await closeProperties();
   await toolbar.locator('[data-action="sections"]').click();await page.waitForTimeout(320);
   assert.equal(await el('section-row').isVisible(),true);
   assert.equal(await el('w').isVisible(),false);
   await closeProperties();
   await toolbar.locator('[data-action="more"]').click();
   assert.deepEqual(await page.locator('.contextual-popover button').allTextContents(),['Material','Max reach size','Doors','Duplicate','Reset','Remove']);
   await page.locator('.contextual-popover button').filter({hasText:'Material'}).click();
   assert.equal(await el('fins').isVisible(),true);
   await page.locator('.lbl.add').click();await page.waitForTimeout(320);
   assert.equal(await el('left').isVisible(),false,'Adding replaces properties');
   assert.equal(await el('pop2').isVisible(),true);
   assert.equal(await toolbar.isVisible(),false,'Add item replaces the action bar');
   const panelBox=await el('pop2').boundingBox();
   assert.ok(Math.abs(panelBox.y+panelBox.height-height)<1,'Panel uses the bottom space released by the toolbar');
   // Add through the existing domain command and select the new internal item.
   await el('pop2').locator('[data-m="short"]').first().click();await page.waitForTimeout(400);
   selection: for(const y of [.6,.55,.65,.5,.75,.8,.4,.3,.9]) for(const x of [.35,.45,.5,.6,.65]) {
    if(!await el('pop2').isVisible()) {
     const empty=await el('view').boundingBox();
     await page.mouse.click(empty.x+8,empty.y+empty.height*.7);
     await selected();
     await page.locator('.lbl.add').click();await page.waitForTimeout(350);
    }
    const view=await el('view').boundingBox();
    for(let tap=0;tap<2;tap++) {
     await page.mouse.click(view.x+view.width*x,view.y+view.height*y);
     if(await el('pop3').isVisible()) break selection;
    }
   }
   assert.equal(await el('pop3').isVisible(),true,'Selecting an existing item replaces the open catalogue with item settings');
   assert.equal(await el('pop2').isVisible(),false,'Catalogue relinquishes the bottom surface');
   assert.equal(await toolbar.isVisible(),false,'Item settings occupy the single bottom surface');
   await el('ix').click();await page.waitForTimeout(350);
   // Select the inserted item through the scene's real hit testing.
   assert.equal(await toolbar.getAttribute('data-context'),'item');
   assert.deepEqual(await toolbar.locator('[data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['duplicate','remove','replace']);
   await checkActionSlots();
   await toolbar.locator('[data-action="replace"]').click();
   assert.ok(await page.locator('.contextual-popover button').count()>3);
   await page.locator('.contextual-popover button').filter({hasText:/^Shelf$/}).click();await page.waitForTimeout(350);
   // Tap an empty corner to clear selection and restore external dimensions.
   const canvas=await el('view').boundingBox();
   await page.mouse.click(canvas.x+8,canvas.y+canvas.height*.7);await page.waitForTimeout(350);
   assert.equal(await toolbar.getAttribute('data-context'),'none');
   assert.equal(await el('launch-wizard').isVisible(),true);
   await el('launch-wizard').click();await page.waitForTimeout(330);
   const sheet=el('wizard').locator('.wizard-shell'),box=await sheet.boundingBox();
   assert.ok(Math.abs(box.height-height*.85)<2,'Auto design opens at 85%');
   await el('close-wizard').click();
   assert.equal(await page.locator('[data-mobile-sheet-exit]').count(),1,'Animated exit snapshot');
   await page.waitForTimeout(350);
   assert.equal(await page.locator('[data-mobile-sheet-exit]').count(),0,'Exit cleaned up');
   await page.screenshot({path:`/tmp/contextual-${width}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS',width,height);await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
