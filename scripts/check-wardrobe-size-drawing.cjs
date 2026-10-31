// Wardrobes and studio surfaces share one drawing editor; no legacy panels or duplicate sliders.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const [width,height] of [[390,844],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<=900,hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  await page.goto(base+'/editor/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]})));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),drawing=el('wardrobe-size-drawing');
  await el('view').waitFor();await page.waitForTimeout(800);await selectFurniture(page);
  await el('toolbar').locator('[data-action="resize"]').click();await page.waitForTimeout(500);
  assert.equal(await el('left-title').textContent(),'Size');
  assert.equal(await drawing.locator('.surface-shape-svg').isVisible(),true);
  assert.equal(await el('shape-templates').isVisible(),false);assert.equal(await el('shape-panels').isVisible(),false);
  assert.equal(await el('sliders').isVisible(),false);assert.equal(await el('left').locator('input[type="range"]:visible').count(),0);
  if(width<=900)assert.ok(Math.abs((await el('left').boundingBox()).height-height*.5)<1);
  const field=k=>drawing.locator(`[data-shape-field="${k}"]`),report=()=>page.evaluate(()=>window.furnidraw.describe());
  assert.deepEqual(await drawing.locator('.surface-shape-field>span:first-child').allTextContents(),['Width','Height','Depth','From the floor']);
  await field('width').fill('220');await field('width').press('Enter');await page.waitForTimeout(200);
  assert.equal((await report()).wardrobes[0].width,220);
  await field('height').fill('210');await field('height').press('Enter');await page.waitForTimeout(200);
  assert.equal((await report()).wardrobes[0].height,210);
  await field('depth').fill('70');await field('depth').press('Enter');await page.waitForTimeout(200);
  assert.equal((await report()).wardrobes[0].depth,70);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.equal((await report()).wardrobes[0].depth,60);
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(250);assert.equal((await report()).wardrobes[0].depth,70);
  await drawing.locator('[data-shape-view="side"]').click();await page.waitForTimeout(250);
  assert.equal(await drawing.locator('[data-shape-view="side"]').getAttribute('aria-pressed'),'true');
  await field('width').fill('65');await field('width').press('Enter');await page.waitForTimeout(250);
  assert.equal((await report()).wardrobes[0].depth,65);
  await drawing.locator('[data-shape-view="front"]').click();await page.waitForTimeout(300);
  const top=drawing.locator('[data-edge="2"]');
  await top.scrollIntoViewIfNeeded();const edge=await top.boundingBox();
  await page.mouse.click(edge.x+edge.width/2,edge.y+edge.height/2);await page.waitForTimeout(150);
  await drawing.locator('[data-shape-act="point"]').click();await page.waitForTimeout(250);
  assert.equal(await drawing.locator('.shape-corner').count(),5,'top point is added through the shared drawing');
  const corner=drawing.locator('.shape-corner.picked');await corner.scrollIntoViewIfNeeded();
  const p=await corner.boundingBox(),before=JSON.stringify((await report()).wardrobes[0].top);
  const x=p.x+p.width/2,y=p.y+p.height/2;
  if(width<=900){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+22*i/8,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+22,{steps:8});await page.mouse.up();
  }
  await page.waitForTimeout(300);
  assert.notEqual(JSON.stringify((await report()).wardrobes[0].top),before,'a drawing corner reshapes the wardrobe');
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);
  assert.equal(JSON.stringify((await report()).wardrobes[0].top),before,'one undo restores the complete corner drag');
  await page.screenshot({path:`/tmp/wardrobe-shared-size-${width}.png`});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: shared Front/Side drawing, numeric dimensions, point drag, undo/redo, no legacy controls or sliders`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
