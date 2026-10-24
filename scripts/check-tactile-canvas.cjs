const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const [width,height,pointer]of(process.env.TACTILE_STUDIO_ONLY?[]:[[375,812,'touch'],[844,390,'touch'],[1440,900,'mouse']])){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<=900,reducedMotion:'reduce'});
  const cdp=await page.context().newCDPSession(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const spec={specVersion:1,wardrobes:[{width:200,height:230,depth:60}]};
  await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  // A design opens with nothing chosen: a tap on the wardrobe chooses it and its measurements show.
  await page.waitForTimeout(500);await selectFurniture(page,{touch:pointer==='touch'});await page.locator('.scrub-w:visible').waitFor();
  const before=await report();
  // Measurements on the model are read-only: dragging one never resizes (sizes are changed in Size).
  {
   const b=await page.locator('[data-scrub-dimension="w"]:visible').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   if(pointer==='touch'){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+4*n,y,id:1}]});await page.waitForTimeout(20);}
    assert.equal(await el('app').getAttribute('data-scrubbing'),null,'No measurement scrub starts');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y,{steps:10});
    assert.equal(await el('app').getAttribute('data-scrubbing'),null,'No measurement scrub starts');await page.mouse.up();
   }
   await page.waitForTimeout(350);
   assert.deepEqual((await report()).wardrobes.map(w=>[w.width,w.height,w.depth]),before.wardrobes.map(w=>[w.width,w.height,w.depth]),'Dragging a measurement does not resize');
   if(!/wardrobe/.test(await el('toolbar').getAttribute('data-context')||''))await selectFurniture(page,{touch:pointer==='touch'});
  }
  // Both touches start in the same bay, away from the dimension labels.
  const box=await el('view').boundingBox(),hBadge=await page.locator('.scrub-h:visible').boundingBox();
  const x=box.x+box.width*.5,y=hBadge.y+hBadge.height/2;
  const shelves=()=>page.evaluate(()=>{
   const draft=Object.keys(localStorage).filter(k=>k.startsWith('wardrobe:draft:')).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
   return draft?.document.wardrobes[0]?.sections.flatMap(s=>s.dividers)||[];
  });
  const waitShelves=async(count)=>{
   for(let n=0;n<40;n++){const boards=await shelves();if(boards.length===count)return boards;await page.waitForTimeout(100);}
   assert.fail('Saved shelf count did not reach '+count);
  };
  const accordion=async(spread,cancel=false)=>{
   const start=30;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-start,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-start,id:1},{x,y:y+start,id:2}]});
   assert.equal(await el('app').getAttribute('data-accordion'),null,'A same-bay pinch is still the camera until the fingers rest');
   await page.waitForTimeout(400);
   assert.notEqual(await el('app').getAttribute('data-accordion'),null,'Fingers resting in one bay own the gesture');
   for(let n=1;n<=10;n++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-start-spread*n/20,id:1},{x,y:y+start+spread*n/20,id:2}]});
    await page.waitForTimeout(20);
   }
   if(cancel==='third'){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
     {x,y:y-start-spread/2,id:1},{x,y:y+start+spread/2,id:2},{x:x+15,y,id:3}]});
   }
   if(!cancel){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x,y:y+start+spread/2,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+15,y:y+start+spread/2,id:2}]});
   }
   await cdp.send('Input.dispatchTouchEvent',{type:cancel===true?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
   assert.equal(await el('app').getAttribute('data-accordion'),null);
  };
  const initialShelves=await shelves();
  await accordion(80);const addedShelves=await waitShelves(2);assert.notDeepEqual(addedShelves,initialShelves,'Spreading adds shelves');
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);assert.deepEqual(await waitShelves(0),initialShelves,'One undo removes all new shelves');
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(300);assert.deepEqual(await waitShelves(2),addedShelves);
  // Drafts save asynchronously: wait for the saved design to settle before reading it.
  await accordion(80,true);await page.waitForTimeout(600);assert.deepEqual(await waitShelves(2),addedShelves,'Cancelled spread keeps the committed shelves');
  await accordion(80,'third');await page.waitForTimeout(600);assert.deepEqual(await waitShelves(2),addedShelves,'A third finger cancels the preview without editing');
  // A pinch removes one board; its initial separation leaves room to pinch.
  await accordion(-40);assert.notDeepEqual(await waitShelves(1),addedShelves,'Pinching removes a shelf board');
  // A pinch that starts moving at once in one bay zooms: it never edits shelves.
  {
   const before=await report();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-30,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-30,id:1},{x,y:y+30,id:2}]});
   // It moves at once: the first step is already past the 8 px a resting finger may drift.
   for(let n=1;n<=8;n++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-30-5-5*n,id:1},{x,y:y+30+5+5*n,id:2}]});await page.waitForTimeout(20);
   }
   assert.equal(await el('app').getAttribute('data-accordion'),null,'A moving pinch in one bay stays with the camera');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
   assert.deepEqual(await report(),before,'A zoom inside a bay does not edit shelves');
  }
  // The shelf gestures leave a bay chosen: back to the whole wardrobe, whose width label shows where the camera is.
  if(!await page.locator('.scrub-w:visible').count()){
   for(let n=0;n<3;n++){await el('c').focus();await page.keyboard.press('Escape');await page.waitForTimeout(200);}
   await selectFurniture(page,{touch:pointer==='touch'});await page.locator('.scrub-w:visible').waitFor();await page.waitForTimeout(400);
  }
  // Where the measurements are on screen: the camera moved if they did.
  const labelsAt=()=>page.locator('.lbl.dim').evaluateAll(es=>es.filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return {t:e.textContent,x:r.x,y:r.y};}));
  const designBeforeZoom=await report(),labelsBeforeZoom=await labelsAt();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:30,y:100,id:1},{x:90,y:100,id:2}]});
  assert.equal(await el('app').getAttribute('data-accordion'),null,'Outside-bay pinches stay with the camera');
  for(let n=1;n<=8;n++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:30-20*n/8,y:100,id:1},{x:90+20*n/8,y:100,id:2}]});await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
  assert.deepEqual(await report(),designBeforeZoom,'Camera zoom cannot edit the design');
  // The camera zooms toward the fingers, so a measurement moves on screen or out of the view.
  const labelsAfterZoom=await labelsAt();
  assert.ok(labelsBeforeZoom.some(a=>{const b=labelsAfterZoom.find(l=>l.t===a.t);return !b||Math.hypot(b.x-a.x,b.y-a.y)>2;}),'The outside-bay pinch zoomed the camera');
  assert.equal(await el('toolbar').getAttribute('data-context'),'wardrobe','A camera pinch keeps the wardrobe chosen');
  await page.screenshot({path:'/tmp/wardrobe-tactile-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height} ${pointer}: read-only measurements, shelf spread/pinch, cancellation, camera pinch and single-step undo/redo`);
  await page.close();
 }
  const page=await browser.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const cdp=await page.context().newCDPSession(page);
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const studio={specVersion:1,room:{width:220,depth:115,height:270},
   ceilings:[{wall:1,shape:'landing',depth:115,points:[[0,205],[80,205],[140,141],[220,141]]}],
   wardrobes:[{against:1,width:216,from:2,depth:60}]};
  await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(studio)));
  const report=()=>page.evaluate(()=>window.wardrobeForge.describe()),el=id=>page.locator(`[data-editor-id="${id}"]`);
  await page.waitForTimeout(500);await selectFurniture(page,{touch:true});
  // Widening it past the walls in Size stops inside the studio.
  await el('toolbar').locator('[data-action="resize"]:visible').click();await el('w').waitFor({state:'visible'});
  await el('w').fill('240');await el('w').press('Tab');await page.waitForTimeout(300);const fitted=await report();
  assert.ok(fitted.wardrobes[0].width>=216 && fitted.wardrobes[0].width<=220,'Width stops inside the prepared studio: '+fitted.wardrobes[0].width);
  await page.screenshot({path:'/tmp/wardrobe-tactile-studio.png'});
  console.log('PASS studio: a width typed past the walls stops inside the studio');await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
