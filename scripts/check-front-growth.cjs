const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {selectFurniture,openShape}=require('./lib/select-furniture.cjs');
// Under a ceiling sloping down to the back wall (180 cm there, 212 cm over the wardrobe's front), the Size drawing's
// side view lets the front of the top rise into its own headroom while the back stays at the ceiling; a height above
// the ceiling is refused; dragging the front corner (a finger on a phone) moves it within that headroom; every edit is
// one undo step.
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const spec={specVersion:1,room:{width:400,depth:150,height:260},ceilings:[{wall:1,shape:'slope',points:[[0,180],[150,260]]}],
   wardrobes:[{against:1,from:120,width:160,depth:60}]};
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  await page.waitForTimeout(450);await selectFurniture(page);
  await openShape(page);
  const d=page.locator('[data-editor-id="wardrobe-size-drawing"]');
  await d.locator('[data-shape-view="side"]').click();await page.waitForTimeout(300);
  // In the side view corner 2 is the front of the top and corner 3 its back; a chosen corner shows its Height.
  const at=async c=>{await d.locator(`.shape-corner[data-corner="${c}"]`).click();await page.waitForTimeout(150);return Number(await d.locator('[data-shape-field="y"]').inputValue());};
  const heights=async()=>[await at(2),await at(3)];
  const front=async v=>{await at(2);const f=d.locator('[data-shape-field="y"]');await f.fill(String(v));await f.press('Tab');await page.waitForTimeout(350);};
  const undo=async(redo=false)=>{await page.locator('[data-editor-id="c"]').focus();await page.keyboard.press(redo?'ControlOrMeta+Shift+z':'ControlOrMeta+z');await page.waitForTimeout(300);};
  assert.deepEqual(await heights(),[180,180],'it opens following the ceiling at the back');
  await front(200);assert.deepEqual(await heights(),[200,180],'the front uses its higher headroom; the back stays at the ceiling');
  await front(230);assert.deepEqual(await heights(),[200,180],'a front above the ceiling is refused');
  await undo();assert.deepEqual(await heights(),[180,180],'one undo');
  await undo(true);assert.deepEqual(await heights(),[200,180],'one redo');
  await front(150);assert.equal((await heights())[0],150,'the front comes down');
  const corner=d.locator('.shape-corner[data-corner="2"]'),r=await corner.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  if(width===375){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-25*n/10,id:1}]});await page.waitForTimeout(25);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-25,{steps:10});await page.mouse.up();}
  await page.waitForTimeout(350);
  const dragged=await heights();
  assert.ok(dragged[0]>150 && dragged[0]<=212,'dragging the front corner up raises it within its headroom: '+JSON.stringify(dragged));
  assert.ok(dragged[1]<=180,'the back never passes the ceiling');
  await undo();assert.equal((await heights())[0],150,'one undo puts the drag back');
  await page.screenshot({path:'/tmp/wardrobe-front-growth-'+width+'.png'});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: under a sloped ceiling the front rises into its headroom, the back stays at the ceiling, too high is refused, drag and single-step undo/redo`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
