const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {selectFurniture}=require('./lib/select-furniture.cjs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
(async()=>{
 for(const engine of (process.env.SIZE_ENGINE?[process.env.SIZE_ENGINE]:['chromium'])){
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROME_PATH}:{})});
  try{for(const room of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('wardrobeForge.lengthUnit','mm'));
   await page.route(base+'/size-phone-fixture',r=>r.fulfill({contentType:'text/html',body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>'}));
   await page.goto(base+'/size-phone-fixture');
   await page.evaluate(async room=>{
    const {mountEditor}=await import('/src/presentation/editor/mount-editor.ts');
    const {buildFromSpec}=await import('/src/application/spec/build-from-spec.ts');
    const {projectToScene}=await import('/src/application/projects/editor-mapper.ts');
    const wardrobes=room?[{against:1,from:0,width:88,height:272,depth:40},{against:4,from:20,width:88,height:272,depth:40}]:[{width:88,height:272,depth:40}];
    const built=buildFromSpec({specVersion:1,...(room?{room:{width:160,depth:160,height:280}}:{}),wardrobes},'size-phone-test');
    if(!built.ok)throw Error(JSON.stringify(built.problems));
    window.phoneEditor=mountEditor({root:document.querySelector('#editor'),initialScene:projectToScene(built.project)});
   },room);
   const el=id=>page.locator(`[data-editor-id="${id}"]`),drawing=el('wardrobe-size-drawing');
   await page.waitForTimeout(700);await selectFurniture(page);
   await el('wardrobe-select').selectOption('1',{force:true});
   await el('toolbar').locator('[data-action="resize"]').click();await page.waitForTimeout(400);
   const compact=async()=>{
    const heights=await drawing.locator('.size-field').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(heights.length>=2);assert.ok(heights.every(h=>h>=40&&h<=48),`${engine} fields are compact: ${heights}`);
    const inputs=await drawing.locator('.size-field input').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(inputs.every(h=>h>0&&h<=48),`${engine} input height: ${inputs}`);
   };
   const fitted=async()=>{
    assert.equal(await drawing.locator('[data-shape-act="fit"]').isVisible(),false,'opening a narrow wardrobe does not auto-zoom');
    const stage=await drawing.locator('.surface-shape-stage').boundingBox();
    for(const corner of await drawing.locator('.shape-corner').all()){
     const r=await corner.boundingBox();
     assert.ok(r.y>=stage.y-1&&r.y+r.height<=stage.y+stage.height+1,`${engine}: every corner fits vertically: ${JSON.stringify({r,stage})}`);
     assert.ok(r.x>=stage.x-1&&r.x+r.width<=stage.x+stage.width+1,`${engine}: every corner fits horizontally`);
    }
   };
   await compact();await fitted();
   await drawing.locator('.surface-shape-stage').screenshot({path:`/tmp/size-fitted-${engine}-${room?'room':'open'}.png`});
   assert.equal(await drawing.locator('[data-shape-field="width"]').inputValue(),'880');
   await drawing.locator('[data-shape-view="side"]').click();await compact();await fitted();
   await drawing.locator('[data-shape-view="front"]').click();await page.waitForTimeout(200);await fitted();
   const point=drawing.locator('[data-corner="3"]'),r=await point.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
   if(engine==='chromium'){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+4*i/8,y:y+18*i/8,id:1}]});
    assert.equal(await drawing.locator('.surface-shape-badge.problem:visible').count(),0,'valid diagonal corner resize has no false collision');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+4,y+18,{steps:8});
    assert.equal(await drawing.locator('.surface-shape-badge.problem:visible').count(),0,'valid diagonal corner resize has no false collision');
    await page.mouse.up();
   }
   await page.waitForTimeout(250);await compact();
   const cabinet=await page.evaluate(()=>window.phoneEditor.scene().wardrobes.find(c=>c.id===1));
   assert.ok(cabinet.state.w<88,'dragging an outer corner resizes its connected upright side');
   assert.ok(cabinet.state.shape.top[0].y<272,'the same drag edits the roof height');
   await page.screenshot({path:`/tmp/size-phone-${engine}-${room?'room':'open'}.png`});
   await drawing.locator('.surface-shape-fields').screenshot({path:`/tmp/size-fields-${engine}-${room?'room':'open'}.png`});
   await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>window.phoneEditor.scene().wardrobes.find(c=>c.id===1).state.w),88,'corner edit undoes atomically');
   assert.deepEqual(errors,[]);console.log(`PASS ${engine} ${room?'walls and adjacent wardrobe':'open floor'}: compact mm fields, complete Front/Side drawings, diagonal resize and undo`);
   await page.close();
  }}finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
