const assert=require('node:assert/strict');
const {chromium}=require('playwright');
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
  await page.locator('.scrub-w:visible').waitFor();await page.waitForTimeout(500);
  const before=await report();
  const drag=async(key,dx,dy=0,cancel=false)=>{
   const target=page.locator(`[data-scrub-dimension="${key}"]:visible`),box=await target.boundingBox();
   const x=box.x+box.width/2,y=box.y+box.height/2;
   if(pointer==='touch'){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let n=1;n<=10;n++){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/10,y:y+dy*n/10,id:1}]});await page.waitForTimeout(20);
    }
    assert.ok(await el('app').getAttribute('data-scrubbing'));assert.equal(await el('toolbar').isVisible(),false);
    await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.waitForTimeout(150);
    assert.ok(await el('app').getAttribute('data-scrubbing'));
    if(cancel){await el('labels').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.move(x,y);}
    await page.mouse.up();
   }
   await page.waitForTimeout(350);assert.equal(await el('app').getAttribute('data-scrubbing'),null);
  };
  await drag('w',40);const grown=await report();assert.equal(grown.wardrobes[0].width,214);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(300);assert.deepEqual(await report(),before,'One undo restores the whole scrub');
  await page.keyboard.press('ControlOrMeta+Shift+z');await page.waitForTimeout(300);assert.deepEqual(await report(),grown);
  await drag('w',-25,0,true);assert.deepEqual(await report(),grown,'Cancellation restores width and contents');
  await drag('d',25);assert.equal((await report()).wardrobes[0].depth,69);
  await drag('h',0,-20);assert.equal((await report()).wardrobes[0].height,237);
  const wLabel=page.locator('.scrub-w:visible');await wLabel.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);
  assert.equal((await report()).wardrobes[0].width,215,'Keyboard accesses the same dimension');await wLabel.blur();
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
  await accordion(80,true);assert.deepEqual(await shelves(),addedShelves,'Cancelled spread keeps the committed shelves');
  await accordion(80,'third');assert.deepEqual(await shelves(),addedShelves,'A third finger cancels the preview without editing');
  // A pinch removes one board; its initial separation leaves room to pinch.
  await accordion(-40);assert.notDeepEqual(await waitShelves(1),addedShelves,'Pinching removes a shelf board');
  // A pinch that starts moving at once in one bay zooms: it never edits shelves.
  {
   const before=await report();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-30,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-30,id:1},{x,y:y+30,id:2}]});
   for(let n=1;n<=8;n++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-30-5*n,id:1},{x,y:y+30+5*n,id:2}]});await page.waitForTimeout(20);
   }
   assert.equal(await el('app').getAttribute('data-accordion'),null,'A moving pinch in one bay stays with the camera');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);
   assert.deepEqual(await report(),before,'A zoom inside a bay does not edit shelves');
  }
  const designBeforeZoom=await report(),labelBeforeZoom=await page.locator('.scrub-w:visible').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:30,y:100,id:1},{x:90,y:100,id:2}]});
  assert.equal(await el('app').getAttribute('data-accordion'),null,'Outside-bay pinches stay with the camera');
  for(let n=1;n<=8;n++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:30-20*n/8,y:100,id:1},{x:90+20*n/8,y:100,id:2}]});await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
  assert.deepEqual(await report(),designBeforeZoom,'Camera zoom cannot edit the design');
  const labelAfterZoom=await page.locator('.scrub-w:visible').boundingBox();
  assert.ok(Math.abs(labelAfterZoom.y-labelBeforeZoom.y)>2,'The outside-bay pinch zoomed the camera');
  const toolbarBox=await el('toolbar').boundingBox();
  assert.ok(labelAfterZoom.y+labelAfterZoom.height<=toolbarBox.y-7,'Dimension pills stay hittable above the toolbar after zoom');
  await page.screenshot({path:'/tmp/wardrobe-tactile-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height} ${pointer}: dimension scrubs, keyboard, cancellation, shelf spread/pinch and single-step undo/redo`);
  await page.close();
 }
  const page=await browser.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const cdp=await page.context().newCDPSession(page);
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const studio={specVersion:1,room:{width:220,depth:115,height:270},
   ceilings:[{wall:1,shape:'landing',depth:115,points:[[0,205],[80,205],[140,141],[220,141]]}],
   wardrobes:[{against:1,width:216,from:2,depth:60}]};
  await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(studio)));
  await page.locator('.scrub-w:visible').waitFor();await page.waitForTimeout(500);
  const report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  const scrub=async(key,dx,dy)=>{
   const b=await page.locator(`[data-scrub-dimension="${key}"]:visible`).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let n=1;n<=10;n++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/10,y:y+dy*n/10,id:1}]});await page.waitForTimeout(20);
   }
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
  };
  await scrub('w',80,0);const fitted=await report();
  assert.ok(fitted.wardrobes[0].width>216 && fitted.wardrobes[0].width<=220,'Width scrub stops inside the prepared studio');
  const left=fitted.wardrobes[0].top[0][1],right=fitted.wardrobes[0].top.at(-1)[1];
  await scrub('h-left',0,20);let changed=await report();
  assert.equal(changed.wardrobes[0].top[0][1],left-7);assert.equal(changed.wardrobes[0].top.at(-1)[1],right);
  await scrub('h-right',0,20);changed=await report();
  assert.equal(changed.wardrobes[0].top.at(-1)[1],right-7,'Right height scrubs independently');
  await page.screenshot({path:'/tmp/wardrobe-tactile-studio.png'});
  console.log('PASS studio: width respects walls, two height pills edit their own edges under the stepped ceiling');await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
