// Real production pointer handlers, 3D projection and renderer. Test-only instrumentation exposes
// existing ports without adding debug APIs to the product. Run against the local Vite development server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdirSync}=require('node:fs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
const shots=process.env.STUDIO_SHOTS||'/tmp/studio-edge-division';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const phone=width===375,page=await browser.newPage({viewport:{width,height:900},hasTouch:phone,isMobile:phone,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.addInitScript(()=>{
   const real=window.visualViewport;let height;
   const visual=Object.assign(new EventTarget(),{offsetLeft:0,offsetTop:0});
   Object.defineProperties(visual,{width:{get:()=>real.width},height:{get:()=>height??real.height,set:value=>{height=value;}},scale:{get:()=>real.scale}});
   Object.defineProperty(window,'visualViewport',{get:()=>visual});window.__testVisual=visual;
  });
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  await page.route('**/src/presentation/editor/editor-runtime.ts*',async route=>{
   const response=await route.fetch(),body=await response.text(),marker='camera.frameScene({ instant: true });';
   assert.ok(body.includes(marker));
   await route.fulfill({response,body:body.replace(marker,'window.__studioTest = { model, room, camera, resources, rendering, history, selectionState, picking, cameraState }; '+marker)});
  });
  await page.goto(base+'/editor.html');await page.locator('[data-editor-id="c"]').waitFor();
  await page.waitForFunction(()=>!!window.__studioTest);
  const setup=async kind=>{
   await page.evaluate(async({width,kind})=>{
    const {rectangleStudio}=await import('/src/domain/studio/studio-templates.ts');
    const room=rectangleStudio(400,300);
    if(kind==='ceiling')room.ceilings=[{id:'k1',wall:'w1',run:'along',depth:110,profile:[{t:6,y:205.047263},{t:176,y:205.047263},{t:176,y:100},{t:406,y:100}]}];
    const h=window.__studioTest;
    h.model.restore(JSON.stringify({studio:room,wardrobes:[],activeWardrobe:0,nextWardrobeId:1}));h.history.clear();
    h.selectionState.focusOn=false;h.selectionState.room=null;h.rendering.build();
    h.camera.camRelease();h.camera.cameraApply({az:.42,el:.04,dist:width===375?2400:1400,x:0,y:110,z:120});
   },{width,kind});
   await page.waitForTimeout(150);
   const pose=await page.evaluate(()=>window.__studioTest.camera.camNow());
   await page.evaluate(kind=>window.__studioTest.room.editor.select({kind,id:kind==='ceiling'?'k1':'w1'}),kind);
   await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__studioTest.camera.camNow()),pose);
  };
  const snapshot=()=>page.evaluate(()=>window.__studioTest.model.snapshot());
  const pose=()=>page.evaluate(()=>window.__studioTest.camera.camNow());
  const projected=async point=>page.evaluate(async p=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   return window.__studioTest.picking.screenPoint(new THREE.Vector3(p.x,p.y,p.z));
  },point);
  const move=async(from,to)=>{
   if(phone){const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:7,x:from.x,y:from.y}]});
    for(let i=1;i<=24;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:7,x:from.x+(to.x-from.x)*i/24,y:from.y+(to.y-from.y)*i/24}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:24});await page.mouse.up();}
   await page.waitForTimeout(180);
  };
  const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const tap=async locator=>phone?locator.tap():locator.click();
  const plus=()=>page.locator('.room-handle.split-handle').filter({hasText:'+'}).last();
  mkdirSync(shots,{recursive:true});
  for(const [kind,edgeName] of [['ceiling','inner'],['ceiling','rear'],['ceiling','depth'],['wall','side'],['wall','depth']]){
   await setup(kind);
   const initial=await snapshot(),view=await pose(),count=kind==='ceiling'?4:2;
   assert.equal(await page.locator('.room-handle.point').count(),count,'original default dot count');
   if(kind==='ceiling'){
    const size=el=>({width:getComputedStyle(el).width,height:getComputedStyle(el).height});
    assert.deepEqual(await plus().evaluate(size),await page.locator('.room-grip').evaluate(size));
   }
   const edge=await page.evaluate(async({kind,edgeName})=>{
    const {studioBoundaryEdges}=await import('/src/domain/studio/studio-solid.ts');
    const h=window.__studioTest,selection={kind,id:kind==='ceiling'?'k1':'w1'};
    const edges=studioBoundaryEdges(h.model.scene.studio,selection);
    const found=edges.find(e=>edgeName==='depth'?e.location.through&&e.location.edge===(kind==='ceiling'?1:2):
     !e.location.through&&e.location.u===(edgeName==='rear'?0:1)&&Math.abs(e.a.x-e.b.x)<1e-6&&e.a.y!==e.b.y
      &&(kind==='wall'||e.location.edge===1));
    if(!found)throw new Error('Test vertical edge missing');
    return {x:(found.a.x+found.b.x)/2,y:(found.a.y+found.b.y)/2,z:(found.a.z+found.b.z)/2};
   },{kind,edgeName});
   await move(await center(plus()),await projected(edge));
   assert.equal(await snapshot(),initial,'moving only the cursor never edits the design');
   assert.equal(await page.evaluate(()=>window.__studioTest.history.undoCount),0);
   const placed=await page.evaluate(()=>window.__studioTest.room.editor.handles().find(h=>h.kind.endsWith('-split')));
   assert.ok(Math.hypot(placed.x-edge.x,placed.y-edge.y,placed.z-edge.z)<.01,
    kind+' '+edgeName+': cursor reaches the actual edge '+JSON.stringify({placed,edge}));
   await tap(plus());await page.waitForTimeout(150);
   const expectedCount=count+(kind==='ceiling'&&edgeName==='depth'?0:1);
   assert.equal(await page.locator('.room-handle.point').count(),expectedCount,'reuse an existing profile corner or add just one requested point');
   const added=await page.evaluate(p=>window.__studioTest.room.editor.handles().find(h=>h.control&&Math.hypot(h.x-p.x,h.y-p.y,h.z-p.z)<.01),edge);
   assert.ok(Math.hypot(added.x-edge.x,added.y-edge.y,added.z-edge.z)<.01,'activation stays at the chosen edge');
   const dot=page.getByRole('button',{name:added.label,exact:true});
   const shift=kind==='wall'?-20:20;
   const from=await center(dot),target=await projected({...added,x:added.x+shift*added.ux,z:added.z+shift*added.uz});
   await move(from,target);
   const after=await page.evaluate(key=>window.__studioTest.room.editor.handles().find(h=>h.key===key),added.key);
   assert.ok(Math.hypot(after.x-added.x,after.y-added.y,after.z-added.z)>1,kind+': the actual point moves');
   assert.equal(await page.locator('.room-handle.point').count(),expectedCount,'no old copy or opposite-corner handle is added');
   const profiles=await page.evaluate(({kind,id})=>{
    const studio=window.__studioTest.model.scene.studio;
    const shape=(kind==='ceiling'?studio.ceilings[0]:studio.walls[0]).shape;
    return {point:shape.controls.find(c=>c.id===id).point,rings:shape.rings};
   },{kind,id:added.control});
   for(const ring of profiles.rings) assert.deepEqual(ring.points[profiles.point],profiles.rings[0].points[profiles.point],
    kind+' '+edgeName+': corresponding edges move together across the entire thickness');
   assert.deepEqual(await pose(),view,'editing never moves the camera');
   assert.equal(await page.evaluate(()=>window.__studioTest.history.undoCount),2);
   await page.screenshot({path:shots+'/'+kind+'-'+edgeName+'-'+width+'.png'});
  }
  // A normal dimension tap, pointer jitter, unchanged numeric entry and keyboard opening change no geometry.
  await setup('ceiling');const initial=await snapshot(),view=await pose();
  const badge=page.getByRole('slider',{name:'Ceiling height',exact:true}).first();
  await tap(badge);const input=page.locator('[data-scene-measurement] input');await input.waitFor();
  assert.equal(await snapshot(),initial);
  const canvas=page.locator('[data-editor-id="c"]'),bounds=await canvas.boundingBox();
  await page.evaluate(()=>{window.__testVisual.height=450;window.__testVisual.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(150);assert.deepEqual(await canvas.boundingBox(),bounds,'keyboard opening keeps the same projection size');
  assert.equal(await snapshot(),initial);assert.deepEqual(await pose(),view);
  await page.evaluate(()=>{window.__testVisual.height=900;window.__testVisual.dispatchEvent(new Event('resize'));});
  await input.press('Enter');await page.waitForTimeout(120);assert.equal(await snapshot(),initial);assert.deepEqual(await pose(),view);
  const p=await center(badge);await move(p,{x:p.x+8,y:p.y+2});
  assert.equal(await snapshot(),initial,'dimension jitter does not resize the ceiling');await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__studioTest.history.undoCount),0);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px: inner/rear/depth insertion, coupled front and rear edges, no duplicate dots, stable camera, stable dimension taps and equal handle dimensions');
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
