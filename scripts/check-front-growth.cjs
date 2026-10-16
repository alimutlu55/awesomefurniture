const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,room:{width:400,depth:150,height:260},ceilings:[{wall:1,shape:'slope',points:[[0,180],[150,260]]}],
   wardrobes:[{against:1,from:120,width:160,depth:60}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),bar=el('toolbar');
  await page.locator('.scrub-h:visible').waitFor();await page.waitForTimeout(450);
  const v=await el('view').boundingBox(),h=await page.locator('.scrub-h:visible').boundingBox();
  await page.mouse.click(v.x+v.width/2,h.y+h.height/2);await page.waitForTimeout(250);
  if(await el('pop2').isVisible()){await el('px').click();await page.waitForTimeout(250);}
  await bar.locator('[data-action="resize"]').click();await page.waitForTimeout(350);
  await el('h').fill('100');await el('h').press('Tab');await page.waitForTimeout(200);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);await bar.locator('[data-action="shape"]').click();await page.waitForTimeout(400);
  if(width===1440){await page.locator('.shape-handle.split-handle:visible').click();await page.waitForTimeout(350);}
  const index=width===375?0:1;
  const front=()=>page.locator(`.shape-row[data-point="${index}"] input[data-k="y"]:not([data-side="rear"])`);
  const rear=()=>page.locator(`.shape-row[data-point="${index}"] input[data-k="y"][data-side="rear"]`);
  const heights=async()=>[Number(await front().inputValue()),Number(await rear().inputValue())];
  assert.deepEqual(await heights(),[100,100]);
  const cdp=await page.context().newCDPSession(page);
  const drag=async(pixels,cancel=false)=>{
   const handle=page.locator(`.shape-handle.point[data-side="front"][data-index="${index}"]:visible`),b=await handle.boundingBox();
   const x=b.x+b.width/2,y=b.y+b.height/2;
   if(width===375){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-pixels*n/10,id:1}]});await page.waitForTimeout(25);}
    await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-pixels,{steps:10});
    if(cancel){await handle.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.move(x,y);}await page.mouse.up();
   }
   await page.waitForTimeout(350);
  };
  await drag(25);const first=await heights();assert.ok(first[0]>100 && first[0]<180,JSON.stringify({width,first}));assert.equal(first[1],first[0],'Rear uses available headroom');
  let capped=first,beforeFinal=first;
  if(width===1440){
   await front().fill('200');await front().press('Tab');await page.waitForTimeout(350);capped=await heights();
   await page.locator(`.shape-handle.point[data-side="front"][data-index="${index}"]:visible`).focus();
  }else for(let n=0;n<10 && capped[0]<=180;n++){beforeFinal=capped;await drag(120);capped=await heights();}
  assert.ok(capped[0]>180,'Front uses its higher clearance: '+JSON.stringify({width,capped}));assert.equal(capped[1],180,'Rear stops at the physical ceiling');
  await drag(20,true);assert.deepEqual(await heights(),capped,'Cancel restores both edges');
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.deepEqual(await heights(),beforeFinal,'Undo restores both edges in one step');
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(250);assert.deepEqual(await heights(),capped);
  await front().fill('150');await front().press('Tab');await page.waitForTimeout(350);
  assert.deepEqual(await heights(),[150,150],'Lowering below the rear lowers both edges');
  await page.locator(`.shape-handle.point[data-side="front"][data-index="${index}"]:visible`).focus();
  if(width===1440){await page.mouse.move(v.x+v.width*.7,v.y+v.height*.7);await page.mouse.wheel(0,650);await page.waitForTimeout(450);}
  await drag(-25);const lowered=await heights();
  assert.ok(lowered[0]<150,JSON.stringify({width,lowered}));assert.equal(lowered[1],lowered[0],'Rear follows downward drag');
  await drag(-20,true);assert.deepEqual(await heights(),lowered,'Downward cancellation restores both edges');
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.deepEqual(await heights(),[150,150]);
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(250);assert.deepEqual(await heights(),lowered);
  await page.screenshot({path:'/tmp/wardrobe-front-growth-'+width+'.png'});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: rear follows upward and downward edits, stops at ceiling, cancellation and single-step undo/redo`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
