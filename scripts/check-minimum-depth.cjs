const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {openSize,setSize}=require('./lib/size-field.cjs');
// Depth reaches 15 cm through the Size panel's Depth field, and a smaller one is refused; the canvas measurement reads
// it and cannot change it.
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/editor.html#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),depth=()=>page.evaluate(()=>window.furnidraw.describe().wardrobes[0].depth);
  await el('c').waitFor({state:'visible'});await page.waitForFunction(()=>window.furnidraw?.describe().wardrobes[0]?.depth===60);
  // A tap chooses the wardrobe: its measurements show, read-only.
  await el('c').click();
  const badge=page.locator('.scrub-d:visible');await badge.waitFor();
  assert.equal(await badge.getAttribute('role'),'meter');assert.equal(await badge.getAttribute('aria-valuemin'),'15');
  await openSize(page);
  await setSize(page,'d',20);await page.waitForTimeout(200);assert.equal(await depth(),20);
  await setSize(page,'d',15);await page.waitForTimeout(250);assert.equal(await depth(),15);
  assert.equal(await page.locator('.scrub-d').first().getAttribute('aria-valuenow'),'15','the canvas measurement follows the new depth');
  await el('c').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);assert.equal(await depth(),20);
  // Out of range is refused, never quietly changed into another size (the Size drawing's rule).
  await setSize(page,'d',15);await page.waitForTimeout(200);await setSize(page,'d',14);await page.waitForTimeout(200);assert.equal(await depth(),15,'a depth under 15 cm is refused');
  await page.screenshot({path:'/tmp/wardrobe-depth-'+width+'.png'});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: the depth field reaches 15 cm, refuses less and undoes; the canvas measurement is read-only`);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
