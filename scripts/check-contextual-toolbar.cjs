const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const [width,height] of (process.env.TOOLBAR_WIDTH ? [[Number(process.env.TOOLBAR_WIDTH),Number(process.env.TOOLBAR_HEIGHT || 900)]] : process.env.TOOLBAR_LANDSCAPE ? [[844,390]] : [[320,568],[390,844],[430,932],[768,1024],[844,390]])) {
  const page=await browser.newPage({viewport:{width,height},isMobile:width<=900,hasTouch:width<=900,reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173');
  const el=id=>page.locator(`[data-editor-id="${id}"]`);
  await el('wardrobe-btn').waitFor();
  const toolbar=el('toolbar');
  const checkEditingRatio=async (id,drawerRatio)=>{
   const sheet=await el(id).boundingBox(),view=await el('view').boundingBox();
   assert.ok(Math.abs(sheet.height-height*drawerRatio)<1,'Incorrect drawer ratio: '+JSON.stringify(sheet));
   assert.ok(Math.abs(view.height-height*(1-drawerRatio))<1,'Incorrect model ratio: '+JSON.stringify(view));
   assert.ok(Math.abs(view.y+view.height-sheet.y)<1,'Model and drawer meet without overlap or a gap');
  };
  const checkKeyboardSplit=async(field)=>{
   await field.focus();
   const keyboardHeight=Math.min(300,height-150);
   await page.evaluate(visibleHeight=>{
    Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>visibleHeight});
    Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>visibleHeight});
    Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>110});
    window.visualViewport.dispatchEvent(new Event('resize'));
   },keyboardHeight);
   await page.waitForTimeout(100);
   assert.equal(await field.evaluate(e=>e.getRootNode().activeElement===e),true);
   assert.equal(await toolbar.isVisible(),false,'Keyboard preserves focused input and hides toolbar');
   const editorBox=await page.locator('#editor-root').boundingBox(),inputBox=await field.boundingBox();
   const keyboardSheet=await field.locator('xpath=ancestor::*[contains(@class,"mobile-bottom-sheet")][1]').boundingBox(),keyboardView=await el('view').boundingBox();
   assert.equal(await el('view').isVisible(),true,'Keyboard keeps the model visible');
   const backdrop=await el('app').evaluate(e=>({image:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).backgroundColor}));
   assert.equal(backdrop.image,'none','Keyboard editing has no separate gray backdrop');
   assert.equal(backdrop.color,await field.locator('xpath=ancestor::*[contains(@class,"mobile-bottom-sheet")][1]').evaluate(e=>getComputedStyle(e).backgroundColor),'Exposed scene background matches the drawer');
   const canvasBox=await el('c').boundingBox();
   assert.ok(Math.abs(canvasBox.height-keyboardView.height)<1,'Canvas fills the preview without a blank strip');
   assert.ok(Math.abs(keyboardSheet.height-editorBox.height*.5)<1,'Size drawer keeps half the visible viewport with keyboard open');
   assert.ok(Math.abs(keyboardView.height-editorBox.height*.5)<1,'Model keeps half the visible viewport with keyboard open');
   assert.ok(Math.abs(keyboardView.y+keyboardView.height-keyboardSheet.y)<1,'Model and size drawer meet above keyboard');
   assert.ok(inputBox.y>=keyboardSheet.y && inputBox.y+inputBox.height<=keyboardSheet.y+keyboardSheet.height,'Focused input scrolls inside the drawer');
   assert.ok(inputBox.y>=editorBox.y && inputBox.y+inputBox.height<=editorBox.y+editorBox.height,'Depth stays above keyboard');
   await page.locator('#editor-root').screenshot({path:'/tmp/wardrobe-keyboard-'+width+'-'+await field.getAttribute('data-editor-id')+'.png'});
   await field.blur();
   await page.evaluate(()=>{delete window.innerHeight;delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
   await page.waitForTimeout(100);
   assert.ok(Math.abs((await el('view').boundingBox()).height-height*.5)<1,'Dismissing keyboard restores the regular size split');
  };
  const selected=async()=>{
   const box=await el('view').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height*.45);
   await page.waitForTimeout(350);
  };
  {
   assert.equal(await el('props-btn').isVisible(),false);
   assert.equal(await toolbar.getAttribute('data-context'),'none');
   // Nothing selected: the furniture to work on. Auto design joins a selected wardrobe's tools.
   assert.equal(await el('launch-wizard').isVisible(),false);
   assert.equal(await el('wardrobe-btn').isVisible(),true);
   assert.equal(await el('cabinets-btn').isVisible(),true);
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
   assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['resize','shape','more']);
   assert.equal(await toolbar.locator('.contextual-actions [data-editor-id="launch-wizard"]').isVisible(),true,'Auto design leads the wardrobe tools');
   assert.equal(await page.locator('.lbl.add').isVisible(),true,'First tap shows internal Add item');
   if(width===390) await page.screenshot({path:'/tmp/contextual-selected.png'});
   await checkActionSlots();
   await toolbar.locator('[data-action="resize"]').click();await page.waitForTimeout(320);
   await checkEditingRatio('left',.5);
   // The safe-area inset belongs inside the 50% drawer, rather than taking model space twice.
   await el('app').evaluate(e=>e.style.setProperty('--safe-bottom','34px'));
   await page.waitForTimeout(320);await checkEditingRatio('left',.5);
   await el('app').evaluate(e=>e.style.removeProperty('--safe-bottom'));
   await page.waitForTimeout(320);
   const wardrobeResizeHeight=(await el('left').boundingBox()).height;
   assert.equal(await toolbar.isVisible(),false,'Properties take over the toolbar');
   for (const id of ['view-modes','topright','topleft']) assert.equal(await el(id).isVisible(),false,'Resize hides '+id);
   // Leave focused editing before opening another global surface.
   await page.keyboard.press('Escape');await page.waitForTimeout(350);
   for (const id of ['view-modes','topright']) assert.equal(await el(id).isVisible(),true,'Closing restores '+id);
   await el('fitchip').click();
   assert.equal(await el('left').isVisible(),false,'Storage opens after properties close');
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
   await checkKeyboardSplit(el('d'));
   assert.equal(await el('left').evaluate(e=>getComputedStyle(e).animationName),'none');
   const closeProperties=async()=>{
    await el('left').locator('.mobile-sheet-handle').evaluate(e=>{
     const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
     for(const [type,dy] of [['touchstart',0],['touchmove',90],['touchend',90]]){
      const touch=new Touch({identifier:1,target:e,clientX:x,clientY:y+dy});
      e.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
     }
    });
    await page.waitForTimeout(350);
    await toolbar.waitFor({state:'visible',timeout:10000});
    assert.equal(await toolbar.isVisible(),true,'Closing restores contextual actions');
   };
   await closeProperties();
   await toolbar.locator('[data-action="shape"]').click();await page.waitForTimeout(320);
   assert.equal(await el('view-modes').isVisible(),false,'Shape hides mode switching');
   assert.equal(await el('topright').isVisible(),false,'Shape hides Storage and Menu');
   assert.equal(await el('left').isVisible(),true,'Shape controls remain available');
   await checkEditingRatio('left',.25);
   if(width===390) await page.screenshot({path:'/tmp/focused-shape-mobile.png'});
   await closeProperties();
   assert.equal(await el('view-modes').isVisible(),true,'Leaving Shape restores mode switching');
   assert.equal(await el('topright').isVisible(),true,'Leaving Shape restores Storage and Menu');
   await toolbar.locator('.contextual-actions [data-action="more"]').click();
   assert.deepEqual(await page.locator('.contextual-popover button').allTextContents(),['New wardrobe','Sections','Material','Doors','Duplicate','Reset','Remove']);
   await page.locator('.contextual-popover button').filter({hasText:'Sections'}).click();await page.waitForTimeout(320);
   assert.equal(await el('section-row').isVisible(),true);
   assert.equal(await el('w').isVisible(),false);
   await closeProperties();
   await toolbar.locator('.contextual-actions [data-action="more"]').click();
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
   await toolbar.waitFor({state:'visible',timeout:10000}); // Let the catalogue exit release the toolbar.
   assert.equal(await el('pop3').isVisible(),false,'Selecting an item does not open the old item sheet');
   assert.equal(await el('pop2').isVisible(),false,'Catalogue relinquishes the bottom surface');
   assert.equal(await toolbar.isVisible(),true,'Item contextual actions take over the bottom surface');
   // Select the inserted item through the scene's real hit testing.
   assert.equal(await toolbar.getAttribute('data-context'),'item');
   assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['duplicate','remove','resize','more']);
   await checkActionSlots();
   await toolbar.locator('[data-action="resize"]').click();
   await page.waitForTimeout(320);
   assert.equal(await el('pop3').isVisible(),true,'Item Resize opens the shared bottom sheet');
   await checkEditingRatio('pop3',.5);
   assert.equal(await el('topright').isVisible(),false,'Item resizing hides global controls');
   assert.equal(await toolbar.isVisible(),false,'Resize replaces the toolbar instead of stacking');
   assert.equal(await el('pop3').evaluate(e=>getComputedStyle(e).animationName),'none');
   assert.ok(Math.abs((await el('pop3').boundingBox()).height-wardrobeResizeHeight)<2,'Wardrobe and item Resize use the same initial height: '+JSON.stringify({wardrobeResizeHeight,item:await el('pop3').boundingBox()}));
   const resizeBox=await el('pop3').boundingBox();
   assert.ok(Math.abs(resizeBox.y+resizeBox.height-height)<1,'Resize sheet is attached to the bottom in every orientation');
   assert.ok(Math.abs(resizeBox.width-width)<1,'Resize uses the same full-width sheet');
   if(width===390)await page.screenshot({path:'/tmp/contextual-resize-sheet.png'});
   assert.equal(await el('ih').isVisible(),true,'Resize reuses item height');
   assert.equal(await el('iw').isVisible(),true,'Resize reuses item width');
   await checkKeyboardSplit(el('ih'));
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
   await toolbar.locator('.contextual-actions [data-action="more"]').click();
   assert.deepEqual(await page.locator('.contextual-popover button').allTextContents(),['Replace','Stores']);
   await page.locator('.contextual-popover button').filter({hasText:'Stores'}).click();
   assert.equal(await el('ipurpose').isVisible(),true,'Stores reuses the storage selector');
   assert.equal(await el('ih').isVisible(),false,'Stores only exposes storage controls');
   await page.keyboard.press('Escape');
   await toolbar.locator('.contextual-actions [data-action="more"]').click();
   await page.locator('.contextual-popover button').filter({hasText:'Replace'}).click();
   assert.ok(await page.locator('.contextual-popover button').count()>3);
   await page.locator('.contextual-popover button').filter({hasText:/^Shelf$/}).click();await page.waitForTimeout(350);
   // Tap an empty corner to clear selection and restore external dimensions.
   const canvas=await el('view').boundingBox();
   await page.mouse.click(canvas.x+8,canvas.y+8);await page.waitForTimeout(350);
   assert.equal(await toolbar.getAttribute('data-context'),'none');
   assert.equal(await el('launch-wizard').isVisible(),false,'Auto design belongs to a selected wardrobe');
   await el('wardrobe-btn').click();await page.waitForTimeout(350);
   assert.equal(await toolbar.getAttribute('data-context'),'wardrobe','Wardrobe selects the wardrobe');
   assert.equal(await el('launch-wizard').isVisible(),true);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await el('launch-wizard').evaluate(b=>b.click());await page.waitForTimeout(330);
   const sheet=el('wizard').locator('.wizard-shell'),box=await sheet.boundingBox();
   assert.ok(Math.abs(box.height-height*.85)<2,'Auto design opens at 85%');
   await el('close-wizard').click();
   assert.equal(await page.locator('[data-mobile-sheet-exit]').count(),1,'Animated exit snapshot');
   await page.locator('[data-mobile-sheet-exit]').waitFor({state:'detached'});
   assert.equal(await page.locator('[data-mobile-sheet-exit]').count(),0,'Exit cleaned up');
   await page.screenshot({path:`/tmp/contextual-${width}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS',width,height);await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
