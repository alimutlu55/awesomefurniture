// Furnishings (beds, rugs) in the real editor, on a desktop with a mouse and a phone with touch: add a Rectangle room,
// then Studio › Add › Furnishings › Bed puts a king bed against a wall, selected, as one undo step. Its Type makes it a
// single, it is dragged by its body on the model, turned by its 3D handle and from More, sized by typing, given a fabric, and a
// bedside table and a rug go beside and under it. On the 2D plan its footprint is dragged and its turn handle shows.
// Needs the dev server at 127.0.0.1:5173 (or MOBILE_TEST_URL). Screenshots go to docs/verification/studio-furnishings/
// (or FURNISHING_SHOTS).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const shots=process.env.FURNISHING_SHOTS||path.join(__dirname,'..','docs','verification','studio-furnishings');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
const VIEWS=[{name:'desktop',width:1440,height:900},{name:'phone',width:375,height:812}].filter(v=>!process.env.ONLY_VIEW||v.name===process.env.ONLY_VIEW);
fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const view of VIEWS) {
  const phone=view.width<=900;
  const page=await browser.newPage({viewport:{width:view.width,height:view.height},isMobile:phone,hasTouch:phone,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{ if(m.type()==='error') console.log('console:',m.text()); });
  await page.goto(base+'/editor.html');
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar');
  const tap=async locator=>{ if(phone) await locator.tap(); else await locator.click(); await page.waitForTimeout(350); };
  const shot=async name=>{ await page.waitForTimeout(400); await page.screenshot({path:path.join(shots,`${name}-${view.name}.jpg`),type:'jpeg',quality:80}); };
  const context=()=>toolbar.getAttribute('data-context');
  const actions=()=>toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action));
  const rulers=()=>page.locator('.room-label:visible').allTextContents();
  const steps=async()=>Number(await el('undo2').locator('small').textContent()||0);
  /** The room's furnishings as saved in the browser draft. */
  const read=()=>page.evaluate(()=>{
   // The newest draft: an earlier session's may still be there.
   const drafts=Object.keys(localStorage).filter(k=>k.startsWith('wardrobe:draft')).map(k=>JSON.parse(localStorage.getItem(k)))
    .sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
   if(!drafts.length) return [];
   const doc=typeof drafts[0].document==='string'?JSON.parse(drafts[0].document):drafts[0].document;
   return doc.studio?.furnishings??[]; });
  /** The furnishings once the draft has caught up with the last change (it is saved a moment after each edit). */
  let lastSaved='';
  const saved=async(ready=now=>JSON.stringify(now)!==lastSaved)=>{
   const deadline=Date.now()+30000;
   let now=await read();
   while(!ready(now)&&Date.now()<deadline){ await page.waitForTimeout(200); now=await read(); }
   lastSaved=JSON.stringify(now); return now;
  };
  const close=async()=>{
   if(await el('left-close').isVisible()) { await tap(el('left-close')); return; }
   const handle=el('left').locator('.mobile-sheet-handle');
   if(!(await handle.isVisible())) return;
   const h=await handle.boundingBox();
   await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
   for(let i=1;i<=10;i++){ await page.mouse.move(h.x+h.width/2,h.y+h.height/2+i*40); await page.waitForTimeout(16); }
   await page.mouse.up();await page.waitForTimeout(500);
  };
  /** Where the room's gap labels are on screen. */
  const labelSpots=()=>page.locator('.room-label:visible').evaluateAll(es=>es.map(e=>{ const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,t:e.textContent}; }));
  /** The furthest any gap label jumped between two steps of a drag, in pixels (each label matched to the nearest one before). */
  let jump=0, last=null;
  // A label is placed on the next animation frame, before the browser paints: a sample caught before that (0, 0) is skipped.
  const watch=async()=>{ const now=(await labelSpots()).filter(p=>p.x||p.y); if(!now.length) return; if(process.env.DEBUG_LABELS) console.log(JSON.stringify(now.map(p=>[Math.round(p.x),Math.round(p.y),p.t]))); if(last) for(const p of now) { const d=Math.min(...last.map(q=>Math.hypot(p.x-q.x,p.y-q.y))); if(Number.isFinite(d)) jump=Math.max(jump,d); } last=now; };
  /** A drag in small steps, by a finger on a phone and the mouse on a desktop; `each` runs after every step. */
  const drag=async(from,to,each=async()=>{})=>{
   if(phone) {
    const cdp=await page.context().newCDPSession(page), point=p=>[{x:p.x,y:p.y,id:1}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(from)});
    for(let i=1;i<=12;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point({x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12})}); await page.waitForTimeout(40); await each(); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   } else {
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    for(let i=1;i<=12;i++){ await page.mouse.move(from.x+(to.x-from.x)*i/12,from.y+(to.y-from.y)*i/12); await page.waitForTimeout(40); await each(); }
    await page.mouse.up();
   }
   await page.waitForTimeout(500);
  };
  const addFurnishing=async key=>{
   await page.keyboard.press('Escape');await page.waitForTimeout(200);
   await tap(toolbar.locator('[data-action="new"]:visible').first());
   await tap(page.locator('.mobile-add-categories [data-category="furnishings"]:visible'));
   await tap(page.locator(`[data-add-furnishing="${key}"]:visible`));
   await page.waitForTimeout(1000);
  };
  await el('add-furniture-btn').waitFor({timeout:90000});
  await page.waitForTimeout(600);

  // A room, then Add › Furnishings: five pieces to choose from.
  await tap(page.getByRole('button',{name:'Studio'}).first());
  await tap(toolbar.locator('[data-action="new"]:visible').first());
  await tap(page.locator('[data-studio="bedroom"]:visible').first());
  await page.waitForTimeout(1200);
  await tap(toolbar.locator('[data-action="new"]:visible').first());
  await tap(page.locator('.mobile-add-categories [data-category="furnishings"]:visible'));
  assert.equal(await page.locator('[data-add-furnishing]:visible').count(),5,'bed, bedside table, desk, armchair and rug');
  await shot('add');
  const before=await steps();
  await tap(page.locator('[data-add-furnishing="bed"]:visible'));
  await page.waitForTimeout(1000);
  assert.equal(await context(),'room-furnishing','the new bed is selected');
  assert.deepEqual(await actions(),['furnishing-type','fixture-size','fixture-finish','more']);
  assert.equal(await steps(),before+1,'adding it is one undo step');
  let [bed]=await saved(now=>now.length===1);
  assert.ok(bed,'the new bed was saved in the draft');
  assert.equal(bed.kind,'bed');assert.equal(bed.type,'king');
  assert.ok((await rulers()).length>=2,'the free floor around it is measured: '+await rulers());
  await shot('bed');

  // Type: a single bed, its headboard where it was.
  await tap(toolbar.locator('[data-action="furnishing-type"]'));
  assert.equal(await page.locator('[data-furnishing-type]:visible').count(),4);
  await tap(page.locator('[data-furnishing-type="single"]'));
  assert.equal(await page.locator('[data-furnishing-type="single"]').getAttribute('aria-pressed'),'true');
  await shot('type');
  await close();
  [bed]=await saved(now=>now[0]?.width===98);
  assert.equal(bed.width,98,'a single is 98 cm wide with its frame');

  // Dragged by its body on the model: it moves, as one step.
  const box=await el('view').boundingBox(), centre={x:box.x+box.width/2,y:box.y+box.height*.5};
  const moved=await steps();
  await drag(centre,{x:centre.x-box.width*.12,y:centre.y},watch);
  // Each step moves the bed about 1% of the view: its gap labels slide along with it, never jumping across it.
  assert.ok(jump<view.width*.05,`gap labels jumped ${Math.round(jump)} px in one step of the drag`);
  const [dragged]=await saved();
  assert.ok(Math.hypot(dragged.x-bed.x,dragged.z-bed.z)>5,`the bed moved: ${JSON.stringify([bed.x,bed.z])} → ${JSON.stringify([dragged.x,dragged.z])}`);
  assert.equal(await steps(),moved+1,'the drag is one undo step');
  assert.equal(await context(),'room-furnishing','still selected');
  await shot('dragged');

  // The 3D turn handle rotates the bed with one undo step.
  const turn = page.locator('.piece-turn:visible');
  await turn.waitFor();
  const ring = await turn.boundingBox();
  const handle = {x:ring.x+ring.width/2,y:ring.y+ring.height/2};
  const turnStep = await steps();
  await drag(handle,{x:handle.x+Math.min(80,view.width*.18),y:handle.y-24});
  const [swept] = await saved(now=>now[0] && now[0].angle!==dragged.angle);
  assert.notEqual(swept.angle,dragged.angle,'dragging the 3D handle turns the bed');
  assert.equal(await steps(),turnStep+1,'turning with the 3D handle is one undo step');
  await shot('turned-3d');
  await tap(el('undo2'));
  assert.equal(await steps(),turnStep,'undo consumes the turn checkpoint');
  const [restored]=await saved(now=>now[0]?.angle===dragged.angle);
  assert.equal(restored.angle,dragged.angle,'undo restores the angle before the drag');

  // More › Turn 90°.
  await tap(toolbar.locator('[data-action="more"]'));
  await tap(page.locator('.contextual-popover [data-action="turn"]'));
  const [turned]=await saved(now=>now[0]?.angle===(dragged.angle+90)%360);
  assert.equal((turned.angle-dragged.angle+360)%360,90,'a quarter turn');
  await tap(el('undo2'));
  await saved(now=>now[0]?.angle===dragged.angle);

  // Size: its length typed; Finish: sage.
  await tap(toolbar.locator('[data-action="fixture-size"]'));
  const length=page.locator('[data-room-field="depth"]');
  assert.equal(await length.inputValue(),'212');
  await length.fill('220');await length.press('Enter');await page.waitForTimeout(300);
  assert.equal(await length.inputValue(),'220');
  await shot('size');
  await close();
  await tap(toolbar.locator('[data-action="fixture-finish"]'));
  await tap(page.locator('[data-furnishing-finish="fabric:sage"]'));
  assert.equal(await page.locator('[data-furnishing-finish="fabric:sage"]').getAttribute('aria-pressed'),'true');
  await close();

  // A bedside table beside it, and a rug under it.
  await addFurnishing('bedside');
  assert.equal(await context(),'room-furnishing');
  await addFurnishing('rug');
  const list=await saved(now=>now.length===3);
  assert.deepEqual(list.map(f=>f.kind),['bed','bedside','rug']);
  await shot('furnished');

  // The plan: three footprints; the bed is dragged by its footprint and shows the turn handle.
  await tap(page.getByRole('button',{name:'2D'}).first());
  await page.waitForTimeout(800);
  assert.equal(await page.locator('[data-furnishing-id]').count(),3);
  const bedPlan=page.locator(`[data-furnishing-id="${list[0].id}"]`), b=await bedPlan.boundingBox();
  const planSteps=await steps();
  await drag({x:b.x+b.width/2,y:b.y+b.height/2},{x:b.x+b.width/2+30,y:b.y+b.height/2});
  assert.equal(await steps(),planSteps+1,'the plan drag is one undo step');
  assert.equal(await page.locator('[data-rotate-id]').count(),1,'the selected bed has a turn handle');
  await shot('plan');
  // Software WebGL in a headless browser takes seconds to redraw the room after the plan changed it: wait for it.
  await page.getByRole('button',{name:'3D'}).first().click({timeout:120000});await page.waitForTimeout(500);

  // Delete removes it, undo brings it back.
  if(!phone) {
   await page.keyboard.press('Delete');await page.waitForTimeout(300);
   assert.notEqual(await context(),'room-furnishing','removed');
   await tap(el('undo2'));
  }
  assert.deepEqual(errors,[],'no page errors');
  await page.close();
 } } finally { await browser.close(); }
 console.log(`Studio furnishings: ${VIEWS.map(view=>view.name).join(' and ')} checks passed. Screenshots in`,shots);
})().catch(e=>{ console.error(e); process.exit(1); });
