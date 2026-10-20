const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { deflateRawSync } = require('node:zlib');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { sceneToProject } = require('../src/application/projects/editor-mapper.ts');
const { createProject } = require('../src/domain/project/project.ts');
const { serializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4181';
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const [width,height] of [[375,900],[844,390]]) for (const reducedMotion of ['reduce','no-preference']) {
   const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
   // Expose the real controller only in this local Vite test response, without
   // adding a debug API to the shipped app or changing its camera behavior.
   await page.route('**/src/presentation/viewport/camera-controller.js*',async route=>{
    const response=await route.fetch(),source=await response.text();
    assert.ok(source.includes('return { cameraAngleDelta,'));
    await route.fulfill({response,body:source.replace('return { cameraAngleDelta,','window.__selectionCamera = {now:camNow,camRelease,cameraApply,model,resources,renderState}; return { cameraAngleDelta,')});
   });
   const state={...createEditorState(),w:100,n:1,secs:[[{k:'drawer',h:22,x:0,y:60,w:96.4},{k:'drawer',h:22,x:0,y:110,w:96.4}]],dividers:[]};
   const scene={wardrobes:[{id:1,name:'Selection camera',x:0,y:0,z:0,angle:0,state}],activeWardrobe:1,nextWardrobeId:2};
   const packed=deflateRawSync(serializeProject(sceneToProject(createProject('selection-camera','Selection camera'),scene))).toString('base64url');
   await page.goto(base+'/#design='+packed);
   const el=id=>page.locator(`[data-editor-id="${id}"]`);
   await el('add-furniture-btn').waitFor();
   const pose={az:0,el:.12,dist:600,x:0,y:130,z:0};
   await page.evaluate(pose=>{const c=window.__selectionCamera;c.camRelease();c.cameraApply(pose);},pose);
   await page.waitForTimeout(300);
   const tap=async(x,y,item)=>{
    const at=await page.evaluate(({x,y})=>{
     const c=window.__selectionCamera,view=document.querySelector('#editor-root').shadowRoot.querySelector('[data-editor-id="view"]').getBoundingClientRect();
     c.resources.cam.updateMatrixWorld(true);
     const p=c.resources.cam.position.clone().set(x,y,31);c.renderState.wardrobeGroups[0].localToWorld(p);p.project(c.resources.cam);
     return {x:view.x+(p.x*.5+.5)*view.width,y:view.y+(-p.y*.5+.5)*view.height};
    },{x,y});
    await page.touchscreen.tap(at.x,at.y);await page.waitForTimeout(750);
    assert.deepEqual(await page.evaluate(()=>window.__selectionCamera.now()),pose,'Tapping a space or fitting must retain every camera axis');
    assert.equal(await page.evaluate(()=>window.__selectionCamera.model.activeCabinet().state.item),item);
   };
   await tap(-40,165,-1); // Select the wardrobe from the existing close view.
   for(let i=0;i<3;i++) {await tap(0,130.8,1);await tap(0,80.8,0);await tap(-40,165,-1);}
   await page.locator('.lbl.add:visible').tap();await page.waitForTimeout(750);
   assert.deepEqual(await page.evaluate(()=>window.__selectionCamera.now()),pose,'Opening Add item retains the close view');
   await tap(0,130.8,1); // Replace the catalogue by selecting an existing fitting.
   assert.equal(await el('pop2').isVisible(),false);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}×${height}, ${reducedMotion}: repeated spaces/items, Add item and panel replacement retain the camera pose.`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
