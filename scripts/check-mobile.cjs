// Start Vite separately. Run npm run check:mobile (requires a Playwright browser).
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseURL = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';

(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
 try {
  for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]]) {
   const mobile = width <= 900;
   const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion:'reduce' });
   const errors = [];
   page.on('pageerror', error => errors.push(error.message));
   const control = id => page.locator(`[data-editor-id="${id}"]`);
   const click = async locator => mobile ? locator.tap() : locator.click();
   await page.goto(baseURL);
   await control('more-btn').waitFor();
   const inBounds = async locator => {
    const box = await locator.boundingBox();
    const size=page.viewportSize();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `${size.width}×${size.height}: control out of bounds ${JSON.stringify(box)}`);
   };
   for (const id of ['props-btn','more-btn','launch-wizard','undo2','redo2','fitchip','menu-btn']) await inBounds(control(id));
   if (mobile) {
    await inBounds(control('zoom-in'));await click(control('props-btn'));
    await page.waitForTimeout(100);
    const panel=await control('left').boundingBox(),view=await control('view').boundingBox();
    assert.ok(panel && view && (view.y + view.height <= panel.y + 1 || view.x >= panel.x + panel.width), `${width}×${height}: settings cover canvas`);
    await inBounds(control('left'));
    await control('w').fill('220');await control('w').blur();
    assert.equal(await control('w').inputValue(),'220');
    assert.equal(await control('w').getAttribute('inputmode'),'numeric');
    await control('d').focus();
    // Safari keeps the layout height while its keyboard shrinks AND pans the
    // visual viewport. A regular browser resize does not reproduce that state.
    const keyboardHeight=Math.min(300,height-150);
    await page.evaluate(visibleHeight=>{
     Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>visibleHeight});
     Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>110});
     window.visualViewport.dispatchEvent(new Event('resize'));
    },keyboardHeight);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#editor-root').getAttribute('data-keyboard-open'),'');
    assert.equal(await control('more-btn').isVisible(),false);
    const editorBox=await page.locator('#editor-root').boundingBox(),inputBox=await control('d').boundingBox();
    assert.equal(editorBox.y,110);assert.equal(editorBox.height,keyboardHeight);
    assert.ok(inputBox.y>=editorBox.y && inputBox.y+inputBox.height<=editorBox.y+editorBox.height,'Focused input must remain in the visible editor');
    await page.evaluate(()=>{
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
    await click(control('props-btn'));
   }
   for (const [trigger,panel] of [['fitchip','plan-panel'],['menu-btn','menu']]) {
    await click(control(trigger));await inBounds(control(panel));await click(control(trigger));
   }
   await click(control('more-btn'));await inBounds(control('pop2'));
   await click(control('padd').locator('button[data-m="short"]'));
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
    const before=await control('zoom-val').textContent();
    await click(control('zoom-in'));await page.waitForTimeout(600);
    assert.notEqual(await control('zoom-val').textContent(),before,'Zoom button must change camera');
    // Real multi-touch events exercise the pointer registry, pinch and release.
    const cdp=await page.context().newCDPSession(page);
    const v=await control('view').boundingBox();const x=v.x+v.width*.5,y=v.height*.45;
    const beforePinch=await control('zoom-val').textContent();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-55,y,id:1},{x:x+55,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(150);
    assert.notEqual(await control('zoom-val').textContent(),beforePinch,'Pinch must change camera');
    assert.equal(await control('pop3').isVisible(),false,'Releasing pinch must not select an item');
    await cdp.detach();
   }
   await click(control('launch-wizard'));await inBounds(control('wizard'));
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
   assert.deepEqual(errors,[],`${width}×${height}: runtime errors`);
   console.log(`PASS ${width}×${height}: settings, menus, fittings, zoom/pinch, planner, undo/redo, resize`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
