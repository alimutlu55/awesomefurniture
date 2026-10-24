const assert=require('node:assert/strict');
const {chromium}=require('playwright');
// Depth reaches 15 cm through the Size panel (field and slider); the canvas measurement reads it and cannot change it.
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/editor.html#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),depth=()=>page.evaluate(()=>window.wardrobeForge.describe().wardrobes[0].depth);
  await el('c').waitFor({state:'visible'});await page.waitForFunction(()=>window.wardrobeForge?.describe().wardrobes[0]?.depth===60);
  // A tap chooses the wardrobe: its measurements show, read-only.
  await el('c').click();
  const badge=page.locator('.scrub-d:visible');await badge.waitFor();
  assert.equal(await badge.getAttribute('role'),'meter');assert.equal(await badge.getAttribute('aria-valuemin'),'15');
  await el('toolbar').locator('[data-action="resize"]').click();await el('d').waitFor({state:'visible'});await el('d').blur();
  assert.equal(await el('d').getAttribute('min'),'15');assert.equal(await el('d-range').getAttribute('min'),'15');
  await el('d').fill('20');await el('d').press('Tab');await page.waitForTimeout(200);assert.equal(await depth(),20);
  await el('d-range').evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(250);assert.equal(await depth(),15);
  assert.equal(await page.locator('.scrub-d').first().getAttribute('aria-valuenow'),'15','the canvas measurement follows the new depth');
  await el('c').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);assert.equal(await depth(),20);
  await el('d').fill('14');await el('d').press('Tab');await page.waitForTimeout(200);assert.equal(await depth(),15);
  await page.screenshot({path:'/tmp/wardrobe-depth-'+width+'.png'});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: depth field and slider reach 15 cm, clamp lower values and preserve undo; the canvas measurement is read-only`);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
