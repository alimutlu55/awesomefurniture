// Rotate the real camera before opening the picker; no camera test hooks.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {for(const width of [375,1440])for(const [wall,az] of [[1,0],[2,-Math.PI/2],[3,Math.PI],[4,Math.PI/2]]){
  const page=await browser.newPage({viewport:{width,height:812},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const spec={specVersion:1,room:{width:220,depth:500},wardrobes:[]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  await page.locator('[data-editor-id="wardrobe-btn"]').waitFor();await page.waitForTimeout(500);
  const view=await page.locator('[data-editor-id="view"]').boundingBox();
  const delta=(.32-az)/.007,steps=Math.ceil(Math.abs(delta)/120);
  for(let i=0;i<steps;i++){
   const x=view.x+view.width/2,y=view.y+view.height*.2;
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(x+delta/steps,y,{steps:12});await page.mouse.up();
  }
  await page.waitForTimeout(300);
  await page.locator('[data-editor-id="wardrobe-btn"]').click();
  // Waiting catches a picker which unexpectedly rotates back to the default wall.
  await page.waitForTimeout(900);
  await page.getByRole('button',{name:'Regular',exact:true}).click();await page.waitForTimeout(600);
  const report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  const added=(await report()).wardrobes;
  assert.equal(added.length,1);assert.equal(added[0].against,wall,'Camera-facing wall at '+width+' px');
  assert.equal(added[0].width,200,'Targeting a wall does not enlarge the default wardrobe');
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);
  assert.equal((await report()).wardrobes.length,0);
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(500);
  assert.deepEqual((await report()).wardrobes,added,'Redo restores the same wall and size');
  if(wall===2){
   await page.locator('.mobile-feedback').waitFor({state:'hidden'});
   await page.screenshot({path:'/tmp/wardrobe-viewed-wall-'+(width===375?'mobile':'desktop')+'.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS '+width+' px: faced wall '+wall+', picker preserves view, add, undo/redo');
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
