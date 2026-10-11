// The room (Studio) in the real editor: place a room from Add item, select a wall on the model, drag it,
// undo, add a door, type a size, deselect. Desktop with a mouse and a phone with touch. Needs the dev
// server at 127.0.0.1:5173. Screenshots go to docs/verification/ (or STUDIO_SHOTS).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const shots=process.env.STUDIO_SHOTS||path.join(__dirname,'..','docs','verification');
// Where the back wall is, right of the wardrobe, once the Bedroom is framed (fraction of the view).
const VIEWS=[{name:'desktop',width:1440,height:900,wall:[.68,.38]},{name:'phone',width:375,height:812,wall:[.87,.41]}];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const view of VIEWS) {
  const phone=view.width<=900;
  const page=await browser.newPage({viewport:{width:view.width,height:view.height},isMobile:phone,hasTouch:phone,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/editor.html');
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar');
  const tap=async locator=>{ if(phone) await locator.tap(); else await locator.click(); await page.waitForTimeout(250); };
  const shot=name=>page.screenshot({path:path.join(shots,`studio-${name}-${view.name}.jpg`)});
  const context=()=>toolbar.getAttribute('data-context');
  await el('more-btn').waitFor();

  // A room comes from Add item, in its Walls category.
  await tap(el('more-btn'));
  if(phone) { await tap(page.locator('[data-category="room"]')); await tap(page.locator('.mobile-add-products [data-studio="bedroom"]')); }
  else { await page.locator('.room-add > summary').click(); await tap(page.locator('[data-editor-id="padd-room"] [data-studio="bedroom"]')); }
  await page.waitForTimeout(1400);
  assert.equal(await context(),'none','placing a room leaves nothing selected');
  assert.equal(await page.locator('[data-editor-id="pop2"].show').count(),0,'the Add item panel closes');
  await shot('room');

  // Tapping a wall selects it: handles, its inside length, and its actions in the toolbar.
  const box=await el('view').boundingBox(), at={x:box.x+box.width*view.wall[0],y:box.y+box.height*view.wall[1]};
  if(phone) await page.touchscreen.tap(at.x,at.y); else await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(500);
  assert.equal(await context(),'wall','the back wall is selected');
  assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['wall-size','split','door','window','more']);
  assert.ok(await page.locator('.room-handle.point').count()>=2,'its corners have handles');
  assert.equal(await page.locator('.room-label',{hasText:'400 cm'}).count(),1,'its inside length shows');
  await shot('wall-selected');

  // Dragging its grip moves it out; the side walls stretch live; one undo step takes it back.
  const grip=await page.locator('.room-grip').first().boundingBox(), from={x:grip.x+grip.width/2,y:grip.y+grip.height/2};
  const undoBefore=Number(await el('undo2').locator('small').textContent()||0);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  for(let i=1;i<=12;i++){ await page.mouse.move(from.x+i*3,from.y-i*3); await page.waitForTimeout(16); }
  const live=await page.locator('.room-label').allTextContents();
  await page.mouse.up();await page.waitForTimeout(300);
  assert.ok(live.length>=3,'while dragging, the walls it stretches show their lengths: '+live);
  const deeper=live.map(t=>parseFloat(t)).filter(n=>n>350&&n<500);
  assert.ok(deeper.length>=2,'the side walls grew: '+live);
  assert.equal(Number(await el('undo2').locator('small').textContent()||0),undoBefore+1,'one undo step for the drag');
  await shot('wall-dragged');
  await tap(el('undo2'));
  assert.equal(Number(await el('undo2').locator('small').textContent()||0),undoBefore,'undone');

  // Door: added to the selected wall (refused there: the wardrobe stands in front), then exact sizes.
  if(await context()!=='wall') { if(phone) await page.touchscreen.tap(at.x,at.y); else await page.mouse.click(at.x,at.y); await page.waitForTimeout(400); }
  await tap(toolbar.locator('[data-action="door"]'));
  assert.equal(await context(),'opening','the new door is selected');
  await tap(toolbar.locator('[data-action="opening-size"]'));
  const width=page.locator('[data-room-field="width"]');
  assert.equal(await width.isVisible(),true,'the Size fields open');
  await width.fill('70');await width.press('Enter');await page.waitForTimeout(300);
  assert.equal(await width.inputValue(),'70','the door is 70 cm wide');
  await shot('door-size');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  assert.equal(await context(),'none','Escape closes the fields, then leaves the door');
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('studio '+view.name+' ok');
 } } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
