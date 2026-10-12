// The room (Studio) in the real editor: place a room from Add item, select a wall on the model, drag it,
// undo, add a door, type a size, deselect. Desktop with a mouse and a phone with touch. Then two wardrobes
// facing each other: the one in front steps aside when you add to the other. Needs the dev
// server at 127.0.0.1:5173 (or MOBILE_TEST_URL). Screenshots go to docs/verification/ (or STUDIO_SHOTS).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const shots=process.env.STUDIO_SHOTS||path.join(__dirname,'..','docs','verification');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
// Where the back wall is, right of the wardrobe, once the Bedroom is framed (fraction of the view).
const VIEWS=[{name:'desktop',width:1440,height:900,wall:[.68,.38]},{name:'phone',width:375,height:812,wall:[.87,.41]}];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const view of VIEWS) {
  const phone=view.width<=900;
  const page=await browser.newPage({viewport:{width:view.width,height:view.height},isMobile:phone,hasTouch:phone,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/editor.html');
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar');
  const tap=async locator=>{ if(phone) await locator.tap(); else await locator.click(); await page.waitForTimeout(250); };
  const shot=name=>page.screenshot({path:path.join(shots,`studio-${name}-${view.name}.jpg`)});
  const context=()=>toolbar.getAttribute('data-context');
  await el('more-btn').waitFor();

  // A room comes from the Walls button: its sheet holds only walls and rooms.
  if(phone) {
   await tap(el('walls-btn'));
   // It adds to the scene, not to the wardrobe: nothing is selected and no wardrobe categories or fittings show.
   assert.equal(await context(),'none','Walls leaves no wardrobe selected');
   assert.equal(await page.locator('.mobile-add-categories > button:visible').count(),0,'no wardrobe categories under Walls');
   assert.equal(await page.locator('.mobile-add-products [data-m]:visible').count(),0,'no fittings under Walls');
   await tap(page.locator('.mobile-add-products [data-studio="bedroom"]'));
  }
  else { await tap(el('walls-btn')); await tap(page.locator('[data-editor-id="padd-room"] [data-studio="bedroom"]')); }
  await page.waitForTimeout(1400);
  assert.equal(await context(),'none','placing a room leaves nothing selected');
  assert.equal(await page.locator('[data-editor-id="pop2"].show').count(),0,'the Add item panel closes');
  await shot('room');

  // Tapping a wall selects it: handles, its inside length, and its actions in the toolbar.
  const box=await el('view').boundingBox(), at={x:box.x+box.width*view.wall[0],y:box.y+box.height*view.wall[1]};
  if(phone) await page.touchscreen.tap(at.x,at.y); else await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(500);
  assert.equal(await context(),'wall','the back wall is selected');
  assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['door','window','ceiling','wardrobe-here','more']);
  assert.ok(await page.locator('.room-handle.point').count()>=2,'its corners have handles');
  assert.equal(await page.locator('.room-label',{hasText:'400 cm'}).count(),1,'its inside length shows');
  await shot('wall-selected');

  // No grip: the selected wall itself is dragged out; the side walls stretch live; one undo step takes it back.
  assert.equal(await page.locator('.room-grip').count(),0,'a selected wall shows no grip, only its corners');
  const from={x:at.x,y:at.y};
  const undoBefore=Number(await el('undo2').locator('small').textContent()||0);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  // The whole room is in view, smaller on a phone: a shorter drag there moves the wall as far.
  const step=phone?1.2:3;
  for(let i=1;i<=12;i++){ await page.mouse.move(from.x+i*step,from.y-i*step); await page.waitForTimeout(16); }
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
  // Undo selects the wardrobe again; the wall is where its grip was, just below the top edge.
  if(await context()!=='wall') { const back={x:from.x,y:from.y}; if(phone) await page.touchscreen.tap(back.x,back.y); else await page.mouse.click(back.x,back.y); await page.waitForTimeout(400); }
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
 }
 // Two wardrobes facing each other: adding to one must not show the back of the other.
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/editor.html');
 await page.locator('[data-editor-id="more-btn"]').waitFor();
 await page.evaluate(async()=>{
  const { createEditorState } = await import('/src/application/projects/editor-state.ts');
  const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
  const root=document.createElement('div'); root.style.cssText='position:absolute;inset:0'; document.getElementById('editor-root').replaceWith(root);
  mountEditor({ root, initialScene: { activeWardrobe: 1, nextWardrobeId: 3, wardrobes: [
   { id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() },
   { id: 2, name: 'Wardrobe 2', x: 0, y: 0, z: 150, angle: 180, state: createEditorState() }] } });
 });
 await page.waitForTimeout(800);
 await page.locator('[data-editor-id="more-btn"]').tap();await page.waitForTimeout(1500);
 const hidden=await page.locator('[data-editor-id="view"]').getAttribute('data-hidden-wardrobes');
 assert.equal(hidden,'2','the wardrobe in front steps aside: '+hidden);
 await page.screenshot({path:path.join(shots,'studio-facing-wardrobes-phone.jpg')});
 assert.deepEqual(errors,[]);
 console.log('facing wardrobes ok');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
