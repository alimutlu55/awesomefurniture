const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  // A ceiling coming down to the back wall: the wardrobe's top falls from 230 cm at its front to 140 cm at its back.
  const spec={specVersion:1,room:{width:400,depth:200,height:260},ceilings:[{wall:1,shape:'slope',points:[[0,140],[80,230],[200,260]]}],
   wardrobes:[{against:1,from:100,width:200,height:230,depth:80}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),bar=el('toolbar');
  // A design opens with nothing chosen: a tap on the wardrobe chooses it.
  await page.waitForTimeout(450);await selectFurniture(page);
  const v=await el('view').boundingBox();
  // Add item is on the model: choose the wardrobe's space.
  for(let tries=0;tries<4&&!await page.locator('.lbl.add:visible').count();tries++){
   if(await page.locator('.shape-handle.point:visible').count()){await page.keyboard.press('Escape');await page.waitForTimeout(350);continue;}
   if(await el('wardrobe-btn').isVisible())await el('wardrobe-btn').click();
   else await page.mouse.click(v.x+v.width/2,v.y+v.height*.55);
   await page.waitForTimeout(500);
  }
  await page.locator('.lbl.add:visible').first().click();await page.locator('[data-a="divider"]:visible').click();await page.waitForTimeout(350);
  const saved=()=>page.evaluate(()=>{
   const draft=Object.keys(localStorage).filter(k=>k.startsWith('wardrobe:draft:')).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
   return draft?.document.wardrobes[0]?.sections.flatMap(s=>s.dividers).map(d=>d.editorDivider);
  });
  await page.waitForTimeout(2800);const boards=await saved();assert.equal(boards.length,1);assert.equal(boards[0].roofFit,true);
  await page.screenshot({path:`/tmp/wardrobe-roof-divider-${width}.png`});
  // The canvas reads the divider's height; the exact value is typed in its Size panel.
  const badge=page.getByRole('meter',{name:'Divider height',exact:true});await badge.waitFor();
  if(!await el('dheight').isVisible())await bar.locator('[data-action="resize"]:visible').click();
  await el('dheight').fill('80');await el('dheight').press('Enter');await page.waitForTimeout(2800);
  const short=await saved();assert.equal(short[0].roofFit,false);assert.equal(short[0].y1-short[0].y0,80);
  await el('c').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(2800);
  assert.equal((await saved())[0].roofFit,true,'One undo restores the roof cut');
  const view=await el('view').boundingBox();
  await page.mouse.move(view.x+view.width*.1,view.y+view.height*.2);await page.mouse.down();
  await page.mouse.move(view.x+view.width*.1+70,view.y+view.height*.2,{steps:12});await page.mouse.up();await page.waitForTimeout(500);
  await page.screenshot({path:`/tmp/wardrobe-roof-divider-${width}.png`});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: divider fills roof, explicit height stays flat, undo restores roof fitting`);
  await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
