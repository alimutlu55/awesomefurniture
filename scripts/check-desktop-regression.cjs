// Start Vite separately. Run npm run check:mobile (requires a Playwright browser).
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseURL = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';

(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
 try {
  for (const [width, height] of [[1440,900]]) {
   const mobile = width <= 900;
   const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion:'reduce' });
   const errors = [];
   page.on('pageerror', error => errors.push(error.message));
   const control = id => page.locator(`[data-editor-id="${id}"]`);
   const click = async locator => mobile ? locator.tap() : locator.click();
   const pullSheet = async (panel,distance,surface) => {
    const autoDesign=await panel.evaluate(e=>e.classList.contains('wizard-shell'));
    const sceneBefore=autoDesign?await control('view').boundingBox():null;
    const handle=surface?panel.locator(surface).first():panel.locator('.mobile-sheet-handle').first();
    await handle.scrollIntoViewIfNeeded();
    const box=await handle.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    const touch=await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:9}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+distance,id:9}]});
    await page.waitForFunction(e=>parseFloat(e.style.translate.split(' ')[1])>0 || e.hasAttribute('data-sheet-dragging'),await panel.elementHandle());
    if(autoDesign || await panel.evaluate(e=>e.classList.contains('mobile-bottom-sheet'))){
     const scene=await control('view').boundingBox(),sheet=await panel.boundingBox();
     if(autoDesign) assert.ok(Math.abs(scene.height-sceneBefore.height)<1,'Dragging Auto design must keep the canvas size stable');
     assert.ok(scene.y+scene.height>=sheet.y-1,'No empty gap between the canvas and any dragged bottom sheet');
    }
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.detach();
   };
   await page.goto(baseURL);
   await control('more-btn').waitFor();
   const inBounds = async locator => {
    const box = await locator.boundingBox();
    const size=page.viewportSize();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${size.width}×${size.height}: control out of bounds ${JSON.stringify(box)}`);
   };
   for (const id of ['props-btn','more-btn','launch-wizard','undo2','redo2','fitchip','menu-btn']) await inBounds(control(id));
   if (mobile) {
    const movement=await page.context().newCDPSession(page);
    // Use the upper body to avoid the movement handles in short landscape views.
    const canvas=await control('view').boundingBox(),cx=canvas.x+canvas.width/2,cy=canvas.y+canvas.height*.36;
    await page.touchscreen.tap(cx,cy); // Select the wardrobe before dragging it.
    assert.equal(await page.locator('.wardrobe-move[data-move-axis]').count(),0,'Mobile wardrobe axes are removed');
    const actions=page.locator('.wardrobe-actions');
    assert.equal(await control('item-bar').evaluate(e=>e.classList.contains('selection-action-bar')),true,'Items use the shared action toolbar');
    await actions.waitFor();
    assert.equal(await actions.evaluate(e=>e.classList.contains('selection-action-bar')),true,'Wardrobes use the same action toolbar');
    assert.equal(await actions.evaluate(e=>getComputedStyle(e).borderRadius),await control('item-bar').evaluate(e=>getComputedStyle(e).borderRadius),'Selection toolbars share their existing design');
    assert.equal(await actions.locator('[data-ib]').count(),2,'Duplicate and Remove use the shared action toolbar');
    assert.equal(await actions.locator('.ground-rotate,[data-ib="rot"]').count(),0,'Rotation stays separate from the action toolbar');
    await page.locator('.ground-rotate').waitFor();
    await movement.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+35,y:cy,id:1}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await control('undo2').isEnabled(),true,'Dragging the wardrobe body must commit its movement');
    await click(control('undo2'));
    assert.equal(await control('undo2').isEnabled(),false,'One body drag must create one undo entry');
    await page.touchscreen.tap(cx,cy);
    await movement.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+15,y:cy,id:1}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx+15,y:cy,id:1},{x:cx+60,y:cy,id:2}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+5,y:cy,id:1},{x:cx+70,y:cy,id:2}]});
    await movement.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await control('undo2').isEnabled(),false,'Switching a wardrobe drag to pinch must roll back the move');
    await movement.detach();
    assert.equal(await control('zoom-in').isVisible(),false);assert.equal(await control('zoom-out').isVisible(),false);await click(control('props-btn'));
    await page.waitForTimeout(100);
    const panel=await control('left').boundingBox(),view=await control('view').boundingBox();
    assert.ok(panel && view && (view.y + view.height <= panel.y + 1 || view.x >= panel.x + panel.width), `${width}×${height}: settings cover canvas`);
    await inBounds(control('left'));
    assert.equal(await control('left').evaluate(e=>e.classList.contains('mobile-bottom-sheet')),true);
    assert.ok(await control('left').evaluate(e=>e.scrollHeight>e.clientHeight),'Settings must have vertically scrollable content');
    await control('left').evaluate(e=>e.scrollTop=80);
    assert.ok(await control('left').evaluate(e=>e.scrollTop)>0,'Settings must scroll down');
    await control('left').evaluate(e=>e.scrollTop=0);
    await pullSheet(control('left'),24,'h2.ct');
    assert.equal(await control('left').isVisible(),true,'A short pull must return the panel to its place');
    const compactHeight=(await control('left').boundingBox()).height;
    await pullSheet(control('left'),-100);
    assert.equal(await control('left').getAttribute('data-sheet-position'),'expanded','Pulling up expands Settings');
    assert.ok((await control('left').boundingBox()).height>compactHeight,'Expanded Settings must be taller');
    await pullSheet(control('left'),100);
    assert.equal(await control('left').getAttribute('data-sheet-position'),'compact','Pulling down lowers Settings without closing');
    assert.equal(await control('left').isVisible(),true);
    await pullSheet(control('left'),90);
    assert.equal(await control('props-btn').getAttribute('aria-expanded'),'false','Pulling down must close Settings');
    await click(control('props-btn'));
    for (const id of ['w','h','d']) {
     const slider=control(id+'-range'),before=await control(id).inputValue();
     await slider.scrollIntoViewIfNeeded();
     const preview=String(Number(before)+10);
     await slider.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},preview);
     assert.equal(await control(id).inputValue(),preview,`${id}: size must update before release`);
     await page.waitForFunction(text=>document.querySelector('#editor-root').shadowRoot.querySelector('[data-editor-id="labels"]').textContent.includes(text),`${id.toUpperCase()} ${preview} cm`);
     assert.equal(await control('undo2').isEnabled(),false,'A slider preview must not create Undo entries');
     await slider.dispatchEvent('pointercancel',{pointerType:'touch',isPrimary:true});
     assert.equal(await control(id).inputValue(),before,'Interrupted sliding must restore the original size');
     const track=await slider.boundingBox();
     await page.touchscreen.tap(track.x+track.width*.7,track.y+track.height/2);
     assert.notEqual(await control(id).inputValue(),before,`${id}: touch slider must change size`);
     assert.equal(await slider.inputValue(),await control(id).inputValue(),`${id}: slider and number must agree`);
     await click(control('undo2'));
     assert.equal(await control(id).inputValue(),before,`${id}: one Undo must restore size`);
     assert.equal(await slider.inputValue(),before,`${id}: Undo must restore slider`);
    }
    await control('w').scrollIntoViewIfNeeded();
    await control('w').fill('220');await control('w').blur();
    assert.equal(await control('w').inputValue(),'220');
    assert.equal(await control('w-range').inputValue(),'220');
    assert.equal(await control('w').getAttribute('inputmode'),'numeric');
    await control('d').focus();
    // Exercise a keyboard that shrinks both reported heights and pans the
    // visual viewport. Comparing those two current heights misses the keyboard.
    const keyboardHeight=Math.min(300,height-150);
    await page.evaluate(visibleHeight=>{
     Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>visibleHeight});
     Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>visibleHeight});
     Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>110});
     window.visualViewport.dispatchEvent(new Event('resize'));
    },keyboardHeight);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#editor-root').getAttribute('data-keyboard-open'),'');
    assert.equal(await control('d').evaluate(e=>e.getRootNode().activeElement===e),true,'Depth must retain focus while the keyboard opens');
    assert.equal(await control('more-btn').isVisible(),false);
    const editorBox=await page.locator('#editor-root').boundingBox(),inputBox=await control('d').boundingBox();
    assert.equal(editorBox.y,110);assert.equal(editorBox.height,keyboardHeight);
    assert.ok(inputBox.y>=editorBox.y && inputBox.y+inputBox.height<=editorBox.y+editorBox.height,'Focused input must remain in the visible editor');
    await page.evaluate(()=>{
     delete window.innerHeight;
     Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>150});
     window.visualViewport.dispatchEvent(new Event('scroll'));
    });
    assert.equal((await page.locator('#editor-root').boundingBox()).y,150);
    await control('d').blur();
    await page.evaluate(()=>{
     delete window.visualViewport.height;delete window.visualViewport.offsetTop;
     window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#editor-root').getAttribute('data-keyboard-open'),null);
    await click(control('sec-plus'));assert.equal((await control('section-count').innerText()).trim(),'2');
    const editArea=await control('view').boundingBox();
    await page.touchscreen.tap(editArea.x+editArea.width*.1,editArea.y+editArea.height*.7);
    assert.equal(await control('props-btn').getAttribute('aria-expanded'),'false','Tapping the editing canvas must close Settings');
    assert.equal(await control('left').isVisible(),false);
    await click(control('props-btn'));
    await control('view').locator('canvas').dispatchEvent('pointerup',{pointerType:'touch',pointerId:41,isPrimary:true});
    assert.equal(await control('props-btn').getAttribute('aria-expanded'),'false','A touch release without a compatibility click must close Settings');
    await click(control('props-btn'));
    await control('labels').dispatchEvent('pointerup',{pointerType:'touch',pointerId:42,isPrimary:true});
    assert.equal(await control('props-btn').getAttribute('aria-expanded'),'false','Touching overlays in the editing area must close Settings');
   }
   for (const [trigger,panel] of [['fitchip','plan-panel'],['menu-btn','menu']]) {
    await click(control(trigger));await inBounds(control(panel));
    if(mobile){await pullSheet(control(panel),90);assert.equal(await control(panel).isVisible(),false);}else await click(control(trigger));
   }
   await click(control('more-btn'));await inBounds(control('pop2'));
   if(mobile){await pullSheet(control('pop2'),90);assert.equal(await control('pop2').isVisible(),false);await click(control('more-btn'));}
   if(mobile){
    const categories=page.locator('.mobile-add-categories'),products=page.locator('.mobile-add-products');
    await page.waitForTimeout(250);
    assert.equal(await control('br').isVisible(),false,'Zoom controls are hidden while adding');
    const panel=await control('pop2').boundingBox(),view=await control('view').boundingBox();
    assert.ok(view.y+view.height<=panel.y+1,`Add catalogue must leave the model unobstructed: ${JSON.stringify({view,panel})}`);
    await click(categories.locator('[data-category="storage"]'));
    assert.equal(await products.locator('[data-add-wardrobe]').isVisible(),false,'Wardrobes wait behind the Wardrobe pill, not under Storage');
    assert.equal(await products.locator('[data-m="short"]').isVisible(),false);
    await click(categories.locator('[data-category="hanging"]'));
    assert.equal(await products.locator('[data-m="short"]').isVisible(),true);
    await click(categories.locator('[data-category="all"]'));
    await products.locator('button').last().scrollIntoViewIfNeeded();
    assert.ok(await products.evaluate(e=>e.scrollLeft>0),'Product catalogue must scroll horizontally');
    await products.locator('[data-m="short"]').scrollIntoViewIfNeeded();
    await click(products.locator('[data-m="short"]'));
   }else await click(control('padd').locator('button[data-m="short"]'));
   assert.equal(await control('undo2').isEnabled(),true);
   await click(control('px'));
   await page.waitForFunction(()=>!document.querySelector('#editor-root').shadowRoot.querySelector('[data-editor-id="app"]').classList.contains('inspecting'));
   await page.waitForTimeout(100);
   if (mobile) {
    // The added hanging rail occupies the lower half of the centered cabinet.
    const view=await control('view').boundingBox();
    // Hit boxes are projected by the camera, so sample the occupied lower bay
    // across portrait and landscape instead of assuming a fixed pixel position.
    selection: for(const y of [.6,.55,.65,.5]) for(const x of [.35,.45,.6,.65]) {
     for(let tap=0;tap<2;tap++) {
      await page.touchscreen.tap(view.x+view.width*x,view.y+view.height*y);
      if(await control('pop3').isVisible()) break selection;
     }
    }
    await control('pop3').waitFor({state:'visible',timeout:3000});
    await inBounds(control('pop3'));
    assert.equal(await control('pop3').evaluate(e=>e.classList.contains('mobile-bottom-sheet')),true,'Item settings use the shared sheet component');
    const itemPanel=await control('pop3').boundingBox();
    const shortLandscape=width>=600 && height<=500;
    assert.ok(itemPanel.height<=(shortLandscape ? height-144 : Math.min(height*.28,240))+1,'Item sheet adapts to portrait or short landscape space');
    assert.equal(await control('pop3').evaluate(e=>getComputedStyle(e).borderTopLeftRadius),'18px','Shared sheet keeps its rounded corners');
    assert.equal(await control('pop3').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','Shared sheet has no gray frame');
    assert.equal(await control('ih').evaluate(e=>getComputedStyle(e).fontSize),'16px');
    const originalHeight=await control('ih').inputValue();
    await control('ih').fill(String(Number(originalHeight)-1));await control('ih').blur();
    assert.equal(Number(await control('ih').inputValue()),Number(originalHeight)-1);
    await click(control('move-controls').locator('xpath=..').locator('summary').first());
    await click(control('move-mode'));await inBounds(page.locator('.mobile-cancel-move'));
    await click(page.locator('.mobile-cancel-move'));assert.equal(await page.locator('.mobile-cancel-move').isVisible(),false);
    await click(control('ix'));
   }
   await click(control('undo2'));await click(control('redo2'));
   if (mobile) {
    assert.equal(await control('br').isVisible(),false,'Mobile zoom buttons stay hidden');
    // Real multi-touch events exercise the pointer registry, pinch and release.
    const cdp=await page.context().newCDPSession(page);
    // Choose exposed canvas, avoiding floating item controls after focus changes.
    const point=await control('view').evaluate(e=>{
     const r=e.getBoundingClientRect(),root=e.getRootNode();
     for(const fy of [.1,.25,.4,.55,.7]) for(const fx of [.5,.3,.7]) {
      const x=r.x+r.width*fx,y=r.y+r.height*fy;
      if([-55,-25,25,55].every(dx=>root.elementFromPoint(x+dx,y)?.tagName==='CANVAS')) return {x,y};
     }
     return null;
    });
    assert.ok(point,'Pinch needs exposed canvas away from overlay controls');
    const {x,y}=point;
    const beforePinch=await control('zoom-val').textContent();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});
    await page.waitForTimeout(32);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-55,y,id:1},{x:x+55,y,id:2}]});
    await page.waitForTimeout(32);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(150);
    assert.notEqual(await control('zoom-val').textContent(),beforePinch,'Pinch must change camera');
    assert.equal(await control('pop3').isVisible(),false,'Releasing pinch must not select an item');
    await cdp.detach();
   }
   await click(control('launch-wizard'));await inBounds(control('wizard'));
   if(mobile){
    const sheet=control('wizard').locator('.wizard-shell');
    assert.equal(await sheet.evaluate(e=>e.classList.contains('mobile-bottom-sheet')),true,'Auto design uses the shared bottom sheet');
    const box=await sheet.boundingBox();
    assert.ok(Math.abs(box.width-width)<1,'Auto design sheet fills the editor width');
    assert.ok(Math.abs(box.height-height)<1 && Math.abs(box.y)<1,'Auto design opens full screen');
    assert.equal(await sheet.evaluate(e=>getComputedStyle(e).borderTopLeftRadius),'18px');
    assert.equal(await sheet.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
    assert.equal(await sheet.evaluate(e=>getComputedStyle(e).boxShadow),'none');
    const body=sheet.locator('.wizard-body');
    assert.ok(await body.evaluate(e=>e.scrollHeight>e.clientHeight),'Auto design content must scroll vertically');
    await body.evaluate(e=>e.scrollTop=100);
    assert.ok(await body.evaluate(e=>e.scrollTop)>0,'Auto design must scroll down');
    await body.evaluate(e=>e.scrollTop=0);
    assert.equal(await body.evaluate(e=>e.scrollTop),0,'Auto design must scroll back up');
    await pullSheet(sheet,100,'.wizard-head h2');
    assert.equal(await sheet.getAttribute('data-sheet-position'),'compact','Auto design can be lowered');
    assert.equal(await control('wizard').isVisible(),true);
    await pullSheet(sheet,-100);
    assert.equal(await sheet.getAttribute('data-sheet-position'),'full','Pulling up restores full screen');
    assert.ok(Math.abs((await sheet.boundingBox()).height-height)<1);
    await pullSheet(sheet,100);await pullSheet(sheet,90);
    assert.equal(await control('wizard').isVisible(),false);await click(control('launch-wizard'));
    assert.equal(await sheet.getAttribute('data-sheet-position'),'full','Reopening Auto design always starts full screen');
   }
   await page.locator('.idea button.apply').first().waitFor({timeout:30000});
   if(mobile){assert.equal(await control('need-short').evaluate(e=>getComputedStyle(e).fontSize),'16px');}
   await click(page.locator('.idea button.apply').first());
   assert.equal(await control('wizard').isVisible(),false);
   assert.equal(await control('undo2').isEnabled(),true);
   await click(control('undo2'));await click(control('redo2'));
   if (mobile) {
    // Browser UI and keyboards can reduce the available height after mounting.
    await page.setViewportSize({width,height:Math.max(300,height-250)});
    await page.waitForTimeout(150);
    await inBounds(control('more-btn'));
    await page.setViewportSize({width:height,height:width});
    await page.waitForTimeout(150);
    await inBounds(control('menu-btn'));
   }
   if(mobile){
    // Use a fresh editor so the action test does not alter the gesture scenarios.
    const actionPage=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await actionPage.goto(baseURL);
    const actionControl=id=>actionPage.locator(`[data-editor-id="${id}"]`);
    await actionControl('more-btn').waitFor();
    const r=await actionControl('view').boundingBox();
    await actionPage.touchscreen.tap(r.x+r.width*.5,r.y+r.height*.36);
    const group=actionPage.locator('.wardrobe-actions');await group.waitFor();
    await group.locator('[data-wardrobe-action="duplicate"]').tap();
    assert.equal(await actionControl('wardrobe-select').locator('option').count(),2,'Duplicate creates another wardrobe');
    await actionPage.locator('.wardrobe-actions [data-wardrobe-action="remove"]').tap();
    assert.equal(await actionControl('wardrobe-select').locator('option').count(),1,'Remove deletes the selected duplicate');
    await actionControl('undo2').tap();
    assert.equal(await actionControl('wardrobe-select').locator('option').count(),2,'Undo restores the removed wardrobe');
    await actionControl('undo2').tap();
    assert.equal(await actionControl('wardrobe-select').locator('option').count(),1,'Undo restores the scene before duplication');
    await actionPage.close();
   }
   assert.deepEqual(errors,[],`${width}×${height}: runtime errors`);
   console.log(`PASS ${width}×${height}: settings, menus, fittings, zoom/pinch, planner, undo/redo, resize`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
