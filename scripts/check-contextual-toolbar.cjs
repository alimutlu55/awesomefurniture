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
   assert.equal(await el('launch-wizard').isVisible(),false);
   const checkActionSlots=async()=>{
    const buttons=await toolbar.locator('button.tb:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width};}));
    assert.ok(buttons.length>=4);
    for(let i=1;i<buttons.length;i++){
     // Actions share one slot width; history (Undo, Redo) has its own pair of slots.
     const first=i<buttons.length-2?0:buttons.length-2;
     assert.ok(Math.abs(buttons[i].width-buttons[first].width)<1,'Every visible action gets an equal-width slot: '+JSON.stringify(buttons));
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
   const wardrobeResizeHeight=(await el('left').boundingBox()).height;
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
   assert.deepEqual(await page.locator('.contextual-popover button').allTextContents(),['Shape','Material','Max reach size','Doors','Duplicate','Reset','Remove']);
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
     if(await toolbar.getAttribute('data-context')==='item' && !await el('pop2').isVisible()) break selection;
    }
   }
   assert.equal(await el('pop3').isVisible(),false,'Selecting an item does not open the old item sheet');
   assert.equal(await el('pop2').isVisible(),false,'Catalogue relinquishes the bottom surface');
   assert.equal(await toolbar.isVisible(),true,'Item contextual actions take over the bottom surface');
   // Select the inserted item through the scene's real hit testing.
   assert.equal(await toolbar.getAttribute('data-context'),'item');
   assert.deepEqual(await toolbar.locator('[data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['duplicate','remove','resize','more']);
   await checkActionSlots();
   await toolbar.locator('[data-action="resize"]').click();
   await page.waitForTimeout(320);
   assert.equal(await el('pop3').isVisible(),true,'Item Resize opens the shared bottom sheet');
   assert.equal(await toolbar.isVisible(),false,'Resize replaces the toolbar instead of stacking');
   assert.equal(await el('pop3').evaluate(e=>getComputedStyle(e).animationName),'mobile-sheet-enter');
   assert.ok(Math.abs((await el('pop3').boundingBox()).height-wardrobeResizeHeight)<2,'Wardrobe and item Resize use the same initial height: '+JSON.stringify({wardrobeResizeHeight,item:await el('pop3').boundingBox()}));
   const resizeBox=await el('pop3').boundingBox();
   assert.ok(Math.abs(resizeBox.y+resizeBox.height-height)<1,'Resize sheet is attached to the bottom in every orientation');
   assert.ok(Math.abs(resizeBox.width-width)<1,'Resize uses the same full-width sheet');
   if(width===390)await page.screenshot({path:'/tmp/contextual-resize-sheet.png'});
   assert.equal(await el('ih').isVisible(),true,'Resize reuses item height');
   assert.equal(await el('iw').isVisible(),true,'Resize reuses item width');
   assert.equal(await el('ipurpose').isVisible(),false,'Resize only exposes size controls');
   assert.equal(await el('ititle').textContent(),'Size');
   const fields=el('pop3').locator('.resize-field-control');
   assert.deepEqual(await fields.evaluateAll(es=>es.sort((a,b)=>a.getBoundingClientRect().y-b.getBoundingClientRect().y).map(e=>e.dataset.axis)),['width','height'],'Width and height use stacked rows');
   for(const field of await fields.all()){
    const row=await field.locator('label').boundingBox(),slider=await field.locator('input[type="range"]').boundingBox();
    assert.ok(slider.y>=row.y+row.height,'Each slider sits below its dimension row');
    assert.ok(slider.width>resizeBox.width-40,'Each slider spans the sheet content');
   }
   const itemHeight=Number(await el('ih').inputValue());
   await el('ih').fill(String(itemHeight-1));await el('ih').press('Tab');
   assert.equal(Number(await el('ih').inputValue()),itemHeight-1,'Existing resize command applies the new height');
   const heightSlider=el('pop3').locator('[data-axis="height"] input[type="range"]');
   await heightSlider.evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},itemHeight-2);
   assert.equal(Number(await el('ih').inputValue()),itemHeight-2,'Slider previews the item size before release');
   await heightSlider.evaluate(e=>e.dispatchEvent(new Event('pointercancel',{bubbles:true})));
   assert.equal(Number(await el('ih').inputValue()),itemHeight-1,'Cancelling a slider drag restores the original size');
   await heightSlider.evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.value=String(value-.5);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},itemHeight-2);
   await el('pop3').locator('.mobile-sheet-handle').click();
   assert.equal(await el('pop3').getAttribute('data-sheet-position'),'expanded','Resize reuses the shared expand affordance');
   await el('ix').click();await page.waitForTimeout(350);
   assert.equal(await toolbar.isVisible(),true,'Closing resize restores item contextual actions');
   await el('undo2').click();
   await toolbar.locator('[data-action="resize"]').click();await page.waitForTimeout(320);
   assert.equal(Number(await el('ih').inputValue()),itemHeight-1,'One undo restores the whole slider drag');
   assert.equal(await el('pop3').getAttribute('data-sheet-position'),'compact','Each Resize opening uses the same initial sheet setting');
   await el('ix').click();await page.waitForTimeout(350);
   await toolbar.locator('[data-action="more"]').click();
   assert.deepEqual(await page.locator('.contextual-popover button').allTextContents(),['Replace','Stores']);
   await page.locator('.contextual-popover button').filter({hasText:'Stores'}).click();
   assert.equal(await el('ipurpose').isVisible(),true,'Stores reuses the storage selector');
   assert.equal(await el('ih').isVisible(),false,'Stores only exposes storage controls');
   await page.keyboard.press('Escape');
   await toolbar.locator('[data-action="more"]').click();
   await page.locator('.contextual-popover button').filter({hasText:'Replace'}).click();
   assert.ok(await page.locator('.contextual-popover button').count()>3);
   await page.locator('.contextual-popover button').filter({hasText:/^Shelf$/}).click();await page.waitForTimeout(350);
   // Tap an empty corner to clear selection and restore external dimensions.
   const canvas=await el('view').boundingBox();
   await page.mouse.click(canvas.x+8,canvas.y+8);await page.waitForTimeout(350);
   assert.equal(await toolbar.getAttribute('data-context'),'none');
   assert.equal(await el('launch-wizard').isVisible(),false);
   await el('launch-wizard').evaluate(b=>b.click());await page.waitForTimeout(330);
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
