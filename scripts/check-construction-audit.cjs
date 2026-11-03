const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width,height] of [[1280,900],[375,812]]) {
      const page = await browser.newPage({viewport:{width,height},isMobile:width===375,hasTouch:width===375,reducedMotion:'reduce'});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      const prefix=process.env.AUDIT_SHAPE ? process.env.AUDIT_SHAPE+'-' : '';
      const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60,...(process.env.AUDIT_SHAPE ? {shape:process.env.AUDIT_SHAPE,doors:'hinged'} : {}),for:{long:6,short:10,shoes:8}}]};
      await page.goto((process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5174')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
      const el=id=>page.locator(`[data-editor-id="${id}"]`);
      await el('add-furniture-btn').waitFor(); await page.waitForTimeout(1200);
      const view=await el('view').boundingBox();
      await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);
      await page.waitForTimeout(300);
      await el('toolbar').locator('[data-action="make"]').click();
      await page.waitForTimeout(400);
      await page.screenshot({path:`artifacts/construction-audit/${prefix}make-${width}.png`});
      await el('toolbar').locator('[data-action="make-assembly"]').click();
      const studio=page.locator('.assembly-studio'); await studio.waitFor({state:'visible'});
      await studio.locator('.as-scrub').fill('1000'); await page.waitForTimeout(500);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      assert.deepEqual(errors,[]);
      await page.screenshot({path:`artifacts/construction-audit/${prefix}assembly-${width}.png`});
      console.log(`${width}px: Make and Assembly Studio rendered, no page errors or horizontal overflow`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
