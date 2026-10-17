const assert=require('node:assert/strict');
const {chromium}=require('playwright');
// A tap on a measurement opens Size (focusing its field); while Size is open the measurements are controls.
const armSize=async page=>{const b=await page.locator('.scrub-w:visible').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(600);
 await page.evaluate(()=>{const r=document.querySelector('#editor-root')?.getRootNode?.()??document;(r.activeElement??document.activeElement)?.blur?.();});await page.waitForTimeout(300);};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),depth=()=>page.evaluate(()=>window.wardrobeForge.describe().wardrobes[0].depth);
  await page.locator('.scrub-d:visible').waitFor();await page.waitForTimeout(400);
  // In Furniture the measurements are controls while Size is open.
  await armSize(page);
  const badge=page.locator('.scrub-d:visible');await badge.waitFor();
  assert.equal(await badge.getAttribute('aria-valuemin'),'15');await badge.focus();await page.keyboard.press('Home');await page.waitForTimeout(200);
  assert.equal(await depth(),15);await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);assert.equal(await depth(),60);
  await badge.click();await el('labels').locator('.measurement-badge input').fill('15');await el('labels').locator('.measurement-badge input').press('Enter');
  await page.waitForTimeout(250);assert.equal(await depth(),15);
  const view=await el('view').boundingBox(),h=await page.locator('.scrub-h:visible').boundingBox();
  await page.mouse.click(view.x+view.width/2,h.y+h.height/2);await page.waitForTimeout(250);
  if(await el('pop2').isVisible()){await el('px').click();await page.waitForTimeout(250);}
  if(!await el('d').isVisible()){await el('toolbar').locator('[data-action="resize"]').click();await page.waitForTimeout(350);}
  assert.equal(await el('d').getAttribute('min'),'15');assert.equal(await el('d-range').getAttribute('min'),'15');
  await el('d').fill('20');await el('d').press('Tab');await page.waitForTimeout(200);assert.equal(await depth(),20);
  await el('d-range').evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(250);assert.equal(await depth(),15);
  await el('d-range').blur();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);assert.equal(await depth(),20);
  await el('d').fill('14');await el('d').press('Tab');await page.waitForTimeout(200);assert.equal(await depth(),15);
  await page.screenshot({path:'/tmp/wardrobe-depth-'+width+'.png'});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: depth badge, numeric field and slider reach 15 cm, clamp lower values and preserve undo`);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
