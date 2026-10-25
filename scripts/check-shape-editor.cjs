// The Shape editor in the real editor, desktop with a mouse and a phone with touch: add a shape with nothing
// selected (it goes on the wall in view), drag a corner (one undo step), pick an edge and add a step, type a size,
// cancel a drag, undo, shape it from the side, and give a wall a sloped top then make it a full wall again. Needs the dev server at
// 127.0.0.1:5173 (or MOBILE_TEST_URL). Screenshots go to docs/verification/ (or SHAPE_SHOTS).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const shots=process.env.SHAPE_SHOTS||path.join(__dirname,'..','docs','verification');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
const VIEWS=[{name:'desktop',width:1440,height:900},{name:'phone',width:375,height:812}];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const view of VIEWS) {
  const phone=view.width<=900;
  const page=await browser.newPage({viewport:{width:view.width,height:view.height},isMobile:phone,hasTouch:phone,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  await page.goto(base+'/editor.html#spec='+encodeURIComponent(JSON.stringify({specVersion:1,room:{template:'bedroom'},wardrobes:[]})));
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar'), report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  await el('view').waitFor(); await page.waitForTimeout(1200);
  await page.locator('[data-view-mode="studio"]').click(); await page.waitForTimeout(600);
  const tap=async locator=>{ if(phone) await locator.tap(); else await locator.click(); await page.waitForTimeout(350); };
  const tapAt=async p=>{ if(phone) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y); await page.waitForTimeout(350); };
  const shot=name=>page.screenshot({path:path.join(shots,`shape-${name}-${view.name}.jpg`),quality:80});
  const undos=async()=>Number(await el('undo2').locator('small').textContent()||0);
  const centre=async locator=>{ const b=await locator.boundingBox(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
  const cdp=phone?await page.context().newCDPSession(page):null;
  /** A drag in steps; `between` runs before the pointer is released, `cancel` sends a cancel instead. */
  async function drag(from,to,{between,cancel}={}) {
   const at=i=>({x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10});
   if(phone){ const touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
    await touch('touchStart',from); for(let i=1;i<=10;i++){ await touch('touchMove',at(i)); await page.waitForTimeout(16); }
    if(between) await between(); await touch(cancel?'touchCancel':'touchEnd'); }
   else { await page.mouse.move(from.x,from.y); await page.mouse.down(); for(let i=1;i<=10;i++){ await page.mouse.move(at(i).x,at(i).y); await page.waitForTimeout(16); }
    if(between) await between(); if(cancel) await page.keyboard.press('Escape'); await page.mouse.up(); }
   await page.waitForTimeout(400);
  }

  // A shape with nothing selected goes on the wall in view and opens in the Shape editor.
  await tap(toolbar.locator('[data-action="new"]:visible'));
  await tap(page.locator('.mobile-add-categories [data-category="ceilings"]:visible'));
  await tap(page.locator('[data-add-ceiling="landing"]:visible'));
  await page.waitForTimeout(900);
  assert.equal(await toolbar.getAttribute('data-context'),'ceiling','the new shape is selected');
  assert.equal((await report()).ceilings.length,1,'one shape added, no wall to pick first');
  const corners=page.locator('.surface-shape-svg circle.shape-corner'), edges=page.locator('.surface-shape-svg path.shape-edge');
  assert.ok(await corners.count()>=5,'its corners are drawn');
  await shot('added');

  // Dragging the lowest corner: a live badge, then one undo step.
  const points=[]; for(let i=0;i<await corners.count();i++) points.push(await centre(corners.nth(i)));
  const low=points.reduce((a,p,i)=>p.y>points[a].y?i:a,0), u0=await undos(), before=JSON.stringify((await report()).ceilings);
  await drag(points[low],{x:points[low].x,y:points[low].y-36},{between:async()=>{
   assert.equal(await page.locator('.surface-shape-badge:visible').count(),1,'a live badge while dragging');
   await shot('dragging');
  }});
  assert.notEqual(JSON.stringify((await report()).ceilings),before,'the shape changed');
  assert.equal(await undos(),u0+1,'one undo step for the drag');

  // A cancelled drag leaves everything as it was, with no undo step.
  const kept=JSON.stringify((await report()).ceilings), moved=await centre(corners.nth(low));
  await drag(moved,{x:moved.x+30,y:moved.y-60},{cancel:true});
  assert.equal(JSON.stringify((await report()).ceilings),kept,'cancel puts the shape back');
  assert.equal(await undos(),u0+1,'no undo step for a cancelled drag');

  // Picking the longest edge offers + Step and + Point; a step is one more undo step.
  let longest=null; for(let i=0;i<await edges.count();i++){ const b=await edges.nth(i).boundingBox(); const l=Math.hypot(b.width,b.height); if(!longest||l>longest.l) longest={i,l,b}; }
  await tapAt({x:longest.b.x+longest.b.width/2,y:longest.b.y+longest.b.height/2});
  assert.deepEqual(await page.locator('.surface-shape-pill button:visible').allTextContents(),['+ Step','+ Point']);
  await shot('edge-picked');
  const n=await corners.count(), pill=page.locator('.surface-shape-pill');
  await tap(page.locator('.surface-shape-pill button',{hasText:'+ Step'}));
  assert.ok(await corners.count()>n,'the step adds corners');
  assert.equal(await undos(),u0+2);
  assert.equal(await pill.isVisible(),false,'the pill goes once + Step is used');

  // Typing an exact size: the moved part is still picked, so its length is there to type.
  const field=page.locator('.surface-shape-fields input').first();
  await field.fill('60'); await field.press('Enter'); await page.waitForTimeout(400);
  assert.equal(Math.round(Number(await field.inputValue())),60,'the typed size holds');
  await shot('typed');

  // What stays picked keeps its sizes below; tapping an edge again brings the tools back, and + Point uses them up again.
  const longestEdge=await page.locator('.surface-shape-svg path.shape-edge').evaluateAll(es=>{ const best=es.reduce((a,e)=>e.getTotalLength()>a.getTotalLength()?e:a), m=best.getScreenCTM(), p=best.getPointAtLength(best.getTotalLength()/2), q=new DOMPoint(p.x,p.y).matrixTransform(m); return {x:q.x,y:q.y}; });
  await tapAt(longestEdge);
  assert.equal(await pill.isVisible(),true,'a tap on an edge shows its tools');
  const m=await corners.count();
  await tap(page.locator('.surface-shape-pill button',{hasText:'+ Point'}));
  assert.equal(await corners.count(),m+1,'+ Point adds a corner');
  assert.equal(await pill.isVisible(),false,'the pill goes once + Point is used');
  // Dragging the picked corner shows no pill, nor after it ends.
  const dot=await centre(page.locator('.surface-shape-svg circle.picked'));
  await drag(dot,{x:dot.x,y:dot.y+12},{between:async()=>assert.equal(await pill.isVisible(),false,'no pill while dragging')});
  assert.equal(await pill.isVisible(),false,'none after a drag');
  await tapAt(await centre(page.locator('.surface-shape-svg circle.picked')));
  assert.equal(await pill.isVisible(),true,'a tap on a corner shows Remove corner');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  assert.equal(await pill.isVisible(),false,'Escape lets go');


  // Undo goes back step by step (from the sheet on a phone, where it stands in for the toolbar).
  const undo=phone?page.locator('[data-shape-act="undo"]'):el('undo2');
  while(await undos()>u0) await tap(undo);
  assert.equal(JSON.stringify((await report()).ceilings),before,'undo restores the shape as added');

  // From the side: the shape's other side, shaped by dragging a corner; one undo step, and back to the front.
  await tap(page.locator('[data-shape-view="side"]'));
  await page.waitForTimeout(600);
  assert.equal(await page.locator('[data-shape-view="side"]').getAttribute('aria-pressed'),'true','seen from the side');
  const sidePoints=[]; for(let i=0;i<await corners.count();i++){ const c=await corners.nth(i).boundingBox(); if(c) sidePoints.push({x:c.x+c.width/2,y:c.y+c.height/2}); }
  const outer=sidePoints.reduce((a,q)=>q.x+q.y>a.x+a.y?q:a,sidePoints[0]), sideBefore=await page.locator('.surface-shape-svg path.shape-solid').getAttribute('d'), u1=await undos();
  await drag(outer,{x:outer.x-25,y:outer.y-30});
  assert.notEqual(await page.locator('.surface-shape-svg path.shape-solid').getAttribute('d'),sideBefore,'the side changed');
  assert.equal(await undos(),u1+1,'one undo step for the side');
  await shot('side');
  await tap(page.locator('[data-shape-view="front"]'));
  await page.waitForTimeout(400);

  // A wall: + Point on its top edge, the corner pulled down for a sloped top, then Full wall.
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const b=await el('view').boundingBox();
  for(const [x,y] of [[.5,.35],[.4,.3],[.6,.45]]) { await tapAt({x:b.x+b.width*x,y:b.y+b.height*y}); if(await toolbar.getAttribute('data-context')==='wall') break; }
  assert.equal(await toolbar.getAttribute('data-context'),'wall');
  await tap(toolbar.locator('[data-action="surface-shape"]'));
  await page.waitForTimeout(800);
  let top=null; for(let i=0;i<await edges.count();i++){ const e=await edges.nth(i).boundingBox(); if(e.width>e.height*3&&(!top||e.y<top.y)) top=e; }
  await tapAt({x:top.x+top.width/2,y:top.y+top.height/2});
  await tap(page.locator('.surface-shape-pill button',{hasText:'+ Point'}));
  const picked=await centre(page.locator('.surface-shape-svg circle.picked'));
  await drag(picked,{x:picked.x,y:picked.y+50});
  const sloped=await page.locator('.surface-shape-svg path.shape-solid').getAttribute('d');
  assert.equal(sloped.split('L').length,5,'the wall has five corners: a sloped top');
  await shot('wall-sloped');
  await tap(page.locator('[data-shape-act="reset"]'));
  assert.equal((await page.locator('.surface-shape-svg path.shape-solid').getAttribute('d')).split('L').length,4,'Full wall makes it plain again');

  assert.deepEqual(errors,[]);
  console.log(`PASS ${view.name}: add on the wall in view, corner drag, cancel, + Step, typed size, undo, side view, wall sloped top`);
  await page.close();
 } } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
