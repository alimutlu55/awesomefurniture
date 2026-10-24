const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
// One measurement component on the model for a wardrobe, a fitting, a fitting's gap and a Studio wall: each reads
// its value (a meter, with no drag or typing hint), keys on it change nothing, and it follows edits made in Size.
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const touch=width===375,page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:touch,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  const load=async spec=>{await page.goto('about:blank');await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));await el('view').waitFor();await page.waitForTimeout(700);};
  /** A measurement reads its value and nothing on it changes the design. */
  const reads=async(badge,value,what)=>{
   await badge.waitFor();
   assert.equal(await badge.getAttribute('role'),'meter',what+' is a reading');
   assert.equal(await badge.getAttribute('data-measurement-readonly'),'true');
   assert.doesNotMatch(await badge.getAttribute('title')||'',/drag|tap|type|arrow/i,what+' offers no editing hint');
   assert.ok(Math.abs(Number(await badge.getAttribute('aria-valuenow'))-value)<.051,what+' reads '+value+': '+await badge.getAttribute('aria-valuenow'));
   const before=JSON.stringify(await report());
   await badge.evaluate(e=>{for(const key of ['ArrowUp','ArrowLeft','Enter','Home'])e.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));});
   await page.waitForTimeout(150);assert.equal(JSON.stringify(await report()),before,'Keys on '+what+' change nothing');
  };
  await load({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]});
  await selectFurniture(page,{touch});
  await reads(page.locator('.scrub-w:visible'),200,'Wardrobe width');
  await el('toolbar').locator('[data-action="resize"]:visible').click();await el('w').fill('211.5');await el('w').press('Tab');await page.waitForTimeout(250);
  assert.equal((await report()).wardrobes[0].width,211.5);await reads(page.locator('.scrub-w:visible'),211.5,'Wardrobe width after Size');
  await el('c').focus();await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.equal((await report()).wardrobes[0].width,200);
  // Add and select a real fitting through the existing UI and scene hit testing.
  await el('left-close').dispatchEvent('click');await page.waitForTimeout(400);
  if(!await page.locator('.lbl.add:visible').count()){await selectFurniture(page,{touch});await page.waitForTimeout(300);}
  await page.locator('.lbl.add:visible').first().click();await page.waitForTimeout(300);
  await el('pop2').locator('[data-m="short"]').first().click();await page.waitForTimeout(350);
  select:for(const y of [.6,.55,.65,.5,.75,.8,.4,.3])for(const x of [.5,.35,.45,.6,.65]){
   const b=await el('view').boundingBox();await page.mouse.click(b.x+b.width*x,b.y+b.height*y);
   if(await el('toolbar').getAttribute('data-context')==='item')break select;
  }
  assert.equal(await el('toolbar').getAttribute('data-context'),'item','A fitting is chosen');
  await el('toolbar').locator('[data-action="resize"]:visible').click();await page.waitForTimeout(400);
  const item=page.getByRole('meter',{name:'Item height',exact:true});await item.waitFor();
  const old=Number(await item.getAttribute('aria-valuenow'));await reads(item,old,'Item height');
  await el('ih').fill(String(old-5));await el('ih').press('Tab');await page.waitForTimeout(300);
  await reads(page.getByRole('meter',{name:'Item height',exact:true}),old-5,'Item height after Size');
  // The gap it has (a fitting on the base board has none below it, only above).
  const gap=page.locator('[role="meter"][aria-label="Distance above item"]:visible, [role="meter"][aria-label="Distance below item"]:visible').first();await gap.waitFor();
  await reads(gap,Number(await gap.getAttribute('aria-valuenow')),'The gap beside the item');
  await page.screenshot({path:'/tmp/wardrobe-shared-badges-'+width+'.png'});console.log(`PASS ${width}px: wardrobe, item and gap measurements read and follow Size`);
  // A Studio wall's length, chosen by real hit testing.
  await load({specVersion:1,room:{width:300,depth:250,height:270},wardrobes:[]});
  await page.locator('[data-view-mode="studio"]').click();await page.waitForTimeout(350);
  const wall=page.getByRole('meter',{name:'Wall length',exact:true});
  selectWall:for(const y of [.4,.3,.5,.6,.25])for(const x of [.5,.35,.65,.25,.75]){
   const b=await el('view').boundingBox();await page.mouse.click(b.x+b.width*x,b.y+b.height*y);
   if(await wall.count())break selectWall;
  }
  await wall.waitFor();await page.waitForTimeout(300);
  const lengths=(await report()).room.walls.map(w=>w.length),length=Number(await wall.getAttribute('aria-valuenow'));
  assert.ok(lengths.some(l=>Math.abs(l-length)<.051),'The wall measurement reads a real wall length: '+length+' of '+lengths);
  await reads(wall,length,'Wall length');
  await page.screenshot({path:'/tmp/wardrobe-shared-studio-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: shared read-only measurements for cabinet, item, clearance and Studio wall`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
