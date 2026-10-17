const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:80}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),bar=el('toolbar');
  await page.locator('.scrub-h:visible').waitFor();await page.waitForTimeout(450);
  const v=await el('view').boundingBox(),h=await page.locator('.scrub-h:visible').boundingBox();
  await page.mouse.click(v.x+v.width/2,h.y+h.height/2);await page.waitForTimeout(250);
  if(await el('pop2').isVisible()){await el('px').click();await page.waitForTimeout(250);}
  await bar.locator('[data-action="shape"]').click();await page.waitForTimeout(350);
  for(const index of [0,1]){
   const rear=page.locator(`.shape-row[data-point="${index}"] input[data-k="y"][data-side="rear"]`);
   await rear.fill('140');await rear.press('Tab');await page.waitForTimeout(200);
  }
  await page.locator('.shape-handle.point[data-side="front"]').first().focus();
  await page.keyboard.press('Escape');await page.waitForTimeout(350);
  // Add item is on the model, in the selected section.
  if(!await page.locator('.lbl.add:visible').count()){
   await el('wardrobe-btn').click();await page.waitForTimeout(500);
  }
  await page.locator('.lbl.add:visible').first().click();await page.locator('[data-a="divider"]:visible').click();await page.waitForTimeout(350);
  const saved=()=>page.evaluate(()=>{
   const draft=Object.keys(localStorage).filter(k=>k.startsWith('wardrobe:draft:')).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
   return draft?.document.wardrobes[0]?.sections.flatMap(s=>s.dividers).map(d=>d.editorDivider);
  });
  await page.waitForTimeout(2800);const boards=await saved();assert.equal(boards.length,1);assert.equal(boards[0].roofFit,true);
  await page.screenshot({path:`/tmp/wardrobe-roof-divider-${width}.png`});
  const badge=page.getByRole('slider',{name:'Divider height',exact:true});
  if(width===375)await badge.tap();else await badge.click();
  const input=page.locator('.measurement-badge.is-editing input');await input.fill('80');await input.press('Enter');await page.waitForTimeout(2800);
  const short=await saved();assert.equal(short[0].roofFit,false);assert.equal(short[0].y1-short[0].y0,80);
  await page.getByRole('slider',{name:'Divider height',exact:true}).blur();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(2800);
  assert.equal((await saved())[0].roofFit,true,'One undo restores the roof cut');
  const view=await el('view').boundingBox();
  await page.mouse.move(view.x+view.width*.1,view.y+view.height*.2);await page.mouse.down();
  await page.mouse.move(view.x+view.width*.1+70,view.y+view.height*.2,{steps:12});await page.mouse.up();await page.waitForTimeout(500);
  await page.screenshot({path:`/tmp/wardrobe-roof-divider-${width}.png`});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: divider fills roof, explicit height stays flat, undo restores roof fitting`);
  await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
