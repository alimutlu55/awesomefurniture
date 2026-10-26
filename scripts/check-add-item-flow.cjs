const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
 try {
  for (const width of [375, 1440]) {
   const page = await browser.newPage({viewport:{width,height:900},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'});
   page.setDefaultTimeout(10000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
   const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60}]};
   await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
   const el=id=>page.locator(`[data-editor-id="${id}"]`), add=()=>page.locator('.lbl.add:visible');
   await el('add-furniture-btn').waitFor();
   const view=await el('view').boundingBox();
   await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);
   await add().waitFor();
   const activate=async locator=>width===375 ? locator.tap() : locator.click();
   const assertFittings=async()=>{
    await el('pop2').waitFor({state:'visible'});
    const products=el('pop2').locator('.mobile-add-products');
    assert.ok(await products.locator('[data-m]:visible').count()>0,'Add item offers fittings');
    assert.equal(await products.locator('[data-add-wardrobe]:visible,[data-add-shape]:visible,[data-product-category="kitchen"]:visible,[data-product-category="room"]:visible').count(),0,'Add item excludes scene products');
    assert.equal(await el('ptitle').textContent(),'Add to this space');
   };
   for(let n=0;n<5;n++) {
    await activate(add());await assertFittings();await activate(el('px'));await add().waitFor();
   }
   await activate(el('toolbar').locator('[data-action="new"]'));
   assert.ok(await el('pop2').locator('[data-add-wardrobe]:visible').count()>0,'Add furniture still offers wardrobes');
   await activate(el('px'));
   const again=await el('view').boundingBox();await page.mouse.click(again.x+again.width/2,again.y+again.height*.45);
   await activate(add());await assertFittings();
   if(width>900) {
    // Simulate the shared collapsed state left by another inspector.
    await el('pop2').locator('.pmin').evaluate(button=>button.click());await el('px').click();await activate(add());await assertFittings();
   }
   const before=await page.evaluate(()=>window.furnidraw.describe());
   await activate(el('pop2').locator('.mobile-add-products [data-m="drawer"]'));
   const after=await page.evaluate(()=>window.furnidraw.describe());
   assert.equal(after.wardrobes.length,before.wardrobes.length,'Adding a fitting never creates furniture');
   const count=report=>report.wardrobes.flatMap(w=>w.sections.flatMap(s=>s.fittings)).filter(f=>f.kind==='drawer').length;
   assert.equal(count(after),count(before)+1,'Drawer is added to the wardrobe');
   await page.screenshot({path:`/tmp/wardrobe-add-item-${width}.png`});
   console.log(`PASS ${width}px: repeated opens and returning from Add furniture show fittings`);
   assert.deepEqual(errors,[]);await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
