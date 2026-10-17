// Real browser input: a press on an item, then a drag, selects that item and moves it, by mouse and by finger,
// whether no wardrobe is chosen yet or the item is already selected. The view must not move under the pointer
// while the press chooses the wardrobe. Start the dev server or preview; optionally set MOBILE_TEST_URL.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  for(const [width,height,pointer] of [[1280,800,'mouse'],[375,812,'touch']]) for(const start of ['nothing chosen','item chosen']) {
   const touch=pointer==='touch';
   const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:true,reducedMotion:'reduce'});
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   page.setDefaultTimeout(15000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
   await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:120,height:230}]})));
   const el=id=>page.locator(`[data-editor-id="${id}"]`).first();
   const tap=loc=>touch?loc.tap():loc.click();
   const at=(x,y)=>touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
   const centre=async loc=>{const b=await loc.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
   const drawerAt=()=>page.evaluate(()=>window.wardrobeForge.describe().wardrobes[0].sections[0].fittings.map(f=>f.from));
   const context_=()=>el('toolbar').getAttribute('data-context');
   // One drawer on the floor of an empty bay, then nothing chosen (a tap on empty floor).
   await el('wardrobe-btn').waitFor();await page.waitForTimeout(600);
   await tap(el('wardrobe-btn'));await page.waitForTimeout(700);
   await tap(page.locator('.lbl.add:visible').first());await page.waitForTimeout(500);
   await tap(page.locator('.mobile-add-products [data-m="drawer"]:visible').first());await page.waitForTimeout(500);
   await tap(el('px'));await page.waitForTimeout(400);
   const view=await el('view').boundingBox();
   await at(view.x+10,view.y+view.height-10);await page.waitForTimeout(900);
   assert.equal(await context_(),'none');
   // The drawer is just above the floor: between the wardrobe's width line (4 cm below the floor) and its height label (115 cm).
   // The width pill hangs half its height and 4 px below its line.
   const wBox=await page.locator('.scrub-w:visible').boundingBox(),h=await centre(page.locator('.scrub-h:visible'));
   const w={x:wBox.x+wBox.width/2,y:wBox.y-4};
   let press={x:w.x,y:w.y-(w.y-h.y)*(4+20)/(4+115)};
   if(start==='item chosen'){
    await at(press.x,press.y);await page.waitForTimeout(1200);
    assert.equal(await context_(),'item','A tap selects the drawer (and frames it)');
    // Its height label stands beside its middle, its width label below it.
    const ih=await centre(page.locator('.item-dimension').filter({hasText:/^H /}).first()),iw=await centre(page.locator('.item-dimension').filter({hasText:/^W /}).first());
    press={x:iw.x,y:ih.y};
   }
   assert.deepEqual(await drawerAt(),[0]);
   const steps=14,dy=-Math.round(height*.18);
   if(touch){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:press.x,y:press.y,id:1}]});
    for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:press.x,y:press.y+dy*i/steps,id:1}]});await page.waitForTimeout(30);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   } else {
    await page.mouse.move(press.x,press.y);await page.mouse.down();
    for(let i=1;i<=steps;i++){await page.mouse.move(press.x,press.y+dy*i/steps);await page.waitForTimeout(30);}
    await page.mouse.up();
   }
   await page.waitForTimeout(900);
   const [moved]=await drawerAt();
   assert.ok(moved>20,`${pointer} ${width}px, ${start}: the drawer follows the drag up (now at ${moved} cm)`);
   assert.equal(await context_(),'item',`${pointer} ${width}px, ${start}: the dragged drawer is selected`);
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(500);
   assert.deepEqual(await drawerAt(),[0],'One undo puts the drawer back');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${pointer} ${width}px, ${start}: press and drag selects the drawer and moves it to ${moved} cm; one undo`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
