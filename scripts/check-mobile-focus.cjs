// Run with Vite running: node scripts/check-mobile-focus.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
  for (const [width,height] of [[390,844],[844,390]]) {
   const page = await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
   await page.addInitScript(() => {
    const state=window.focusRendering={resizes:0,blankResizes:0,writes:0,draws:0};
    for(const key of ['width','height']) {
     const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);
     Object.defineProperty(HTMLCanvasElement.prototype,key,{...descriptor,set(value){state.writes++;descriptor.set.call(this,value)}});
    }
    for(const type of [WebGLRenderingContext,WebGL2RenderingContext]) for(const key of ['drawElements','drawArrays']) {
     const draw=type.prototype[key];type.prototype[key]=function(...args){state.draws++;return draw.apply(this,args)};
    }
    const Observer=window.ResizeObserver;
    window.ResizeObserver=class extends Observer {
     constructor(callback){super((entries,observer)=>{
      const writes=state.writes,draws=state.draws;
      callback(entries,observer);
      if(state.writes>writes){state.resizes++;if(state.draws===draws)state.blankResizes++}
     })}
    };
   });
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173');
   const control=id=>page.locator(`[data-editor-id="${id}"]`);
   await control('more-btn').tap();await page.waitForTimeout(700);
   await page.locator('.mobile-add-products [data-m="short"]').tap();
   await control('px').tap();await page.waitForTimeout(700);
   const view=await control('view').boundingBox();
   selection:for(const y of [.6,.55,.65,.5,.7]) for(const x of [.35,.45,.6,.65,.5]) {
    for(let i=0;i<2;i++){
     await page.touchscreen.tap(view.x+view.width*x,view.y+view.height*y);
     if(await control('pop3').isVisible())break selection;
     await page.waitForTimeout(100);
    }
   }
   await control('pop3').waitFor({state:'visible'});
   await page.waitForTimeout(900);
   const rendering=await page.evaluate(()=>window.focusRendering);
   assert.ok(rendering.resizes>2,'Animated panel must exercise canvas resizing');
   assert.equal(rendering.blankResizes,0,'Every canvas resize must redraw before returning to the browser');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}×${height}: animated item focus, ${rendering.resizes} resizes without a blank canvas`);
   await page.close();
  }
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
