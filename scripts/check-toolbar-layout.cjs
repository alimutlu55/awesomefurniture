const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {for(const width of [320,375,430,768,844,1440]){
  const page=await browser.newPage({viewport:{width,height:width===844?390:812},reducedMotion:'reduce'});
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{"message":"Offline regression"}'}));
  const spec={specVersion:1,room:{width:150,depth:115},wardrobes:[]};
  await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const toolbar=page.locator('[data-editor-id="toolbar"]');
  await page.getByRole('button',{name:'Add wardrobe',exact:true}).waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const check=async(expected)=>{
   const b=await toolbar.locator('button.tb:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
   assert.equal(b.length,expected);
   assert.ok(b.every(r=>r.x>=0 && r.x+r.w<=width+1));
   if(width<=900)for(let i=1;i<b.length;i++){
    assert.ok(Math.abs(b[i].w-b[0].w)<1,'Visible buttons share equal slots: '+JSON.stringify(b));
    assert.ok(Math.abs(b[i].x-b[i-1].x-b[i-1].w)<1,'No unused action columns: '+JSON.stringify(b));
    assert.ok(Math.abs(b[i].y-b[0].y)<1,'One aligned row');
   }
   const frame=await toolbar.boundingBox();
   assert.ok(Math.abs(frame.x+frame.width/2-width/2)<1,'Toolbar stays centred');
   if(width<=900)assert.ok(frame.width<=expected*96+20,'Toolbar width follows actual visible actions');
  };
  await check(3);
  if(width<=900){
   // New actions need no layout-specific count or CSS change.
   await toolbar.locator('.contextual-defaults').evaluate(e=>{
    const template=e.querySelector('[data-editor-id="wardrobe-btn"]');
    for(let n=0;n<5;n++){const b=template.cloneNode(true);b.removeAttribute('id');b.dataset.editorId='wardrobe-btn';b.dataset.layoutProbe='true';e.append(b);}
   });
   await check(8);
   await toolbar.locator('[data-layout-probe]').evaluateAll(es=>es.forEach(e=>e.hidden=true));
   await check(3);
   await toolbar.locator('[data-layout-probe]').evaluateAll(es=>es.forEach(e=>e.remove()));
  }
  if(width===375)await page.screenshot({path:'/tmp/wardrobe-empty-toolbar-mobile.png'});
  if(width===1440)await page.screenshot({path:'/tmp/wardrobe-empty-toolbar-desktop.png'});
  await page.locator('[data-view-mode="studio"]').click();await page.waitForTimeout(350);await check(4);
  await page.locator('[data-view-mode="furniture"]').click();await page.waitForTimeout(350);await check(3);
  await page.getByRole('button',{name:'Add wardrobe',exact:true}).click();
  await page.getByRole('button',{name:'Regular',exact:true}).click();await page.waitForTimeout(500);await check(7);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(350);await check(3);
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(350);await check(7);
  console.log('PASS '+width+': empty, Studio, new actions, hidden actions, add, undo and redo');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
