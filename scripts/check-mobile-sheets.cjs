// Shared mounted-sheet gesture checks. Run with Vite running.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base=process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  for (const [width,height] of [[390,844],[844,390]].filter(([w])=>!process.env.SHEET_WIDTH||w===Number(process.env.SHEET_WIDTH))) for (const [name,id] of [['Settings','left'],['Add item','pop2'],['Item settings','pop3'],['Divider settings','pop4'],['Auto design','wizard']].filter(([,id])=>!process.env.SHEET_ID||id===process.env.SHEET_ID)) {
   const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   // Mount a known editor independently of the design library and saved sessions.
   await page.route(base+'/mobile-sheet-fixture',route=>route.fulfill({contentType:'text/html',body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor-root{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor-root"></div></body></html>'}));
   await page.goto(base+'/mobile-sheet-fixture');
   await page.evaluate(async id=>{
    const {mountEditor}=await import('/src/presentation/editor/mount-editor.ts');
    const {createEditorState}=await import('/src/application/projects/editor-state.ts');
    const state=createEditorState();state.doors='none';state.open=true;
    state.secs[0]=[{k:'shelf',h:30}];state.item=id==='pop3'?0:-1;
    state.dividers=[{i:0,orientation:'horizontal',x0:0,x1:64.3,y:100,area:{x0:0,x1:64.3,y0:0,y1:218.4}}];
    state.divider=id==='pop4'?0:-1;
    window.sheetEditor=mountEditor({root:document.querySelector('#editor-root'),initialScene:{
     wardrobes:[{id:1,name:'Furniture',x:0,y:0,z:0,angle:0,state}],activeWardrobe:1,nextWardrobeId:2}});
    document.querySelector('#editor-root').style.setProperty('--safe-bottom','34px');
   },id);
   const control=id=>page.locator(`[data-editor-id="${id}"]`);
   await control('add-furniture-btn').waitFor();
   if(id==='left') {
    await page.evaluate(()=>{
     const root=document.querySelector('#editor-root').shadowRoot;
     root.querySelector('[data-editor-id="left"]').dataset.contextSection='resize';
     root.querySelector('[data-editor-id="app"]').classList.add('props-open');
    });
   }
   else if(id==='pop2') {
    await control('add-furniture-btn').tap();
   }
   else if(id==='wizard') await control('launch-wizard').evaluate(b=>b.click());
   else {
    // Mount the item/divider sheet independently of scene selection. Their
    // actual selection and form workflows are covered by check-mobile.cjs.
    await page.evaluate(id=>{
     const root=document.querySelector('#editor-root').shadowRoot;
     const panel=root.querySelector(`[data-editor-id="${id}"]`);
     panel.classList.add('show');panel.dataset.contextSection='resize';
     root.querySelector('[data-editor-id="app"]').classList.add('inspecting');
    },id);
   }
   const panel=id==='wizard'?control(id).locator('.wizard-shell'):control(id);
   await panel.waitFor();
   assert.equal(await control('toolbar').isVisible(),false,`${name}: panel takes over toolbar`);
   const bounded=async()=>{
    if(id==='wizard')return;
    const sheet=await panel.boundingBox(),editor=await control('app').boundingBox();
    assert.ok(sheet.height<=editor.height/2+1,`${name}: drawer must stay within half the visible editor (${sheet.height}/${editor.height})`);
   };
   await bounded();
   const drag=async distance=>{
    await panel.evaluate((e,distance)=>{
     e.scrollTop=0;
     const target=e.querySelector('.mobile-sheet-handle'),b=target.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
     const send=(type,dy)=>{
      const touch=new Touch({identifier:1,target,clientX:x,clientY:y+dy});
      target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));
     };
     send('touchstart',0);send('touchmove',distance);
    },distance);
    assert.ok(await panel.evaluate(e=>e.hasAttribute('data-sheet-dragging')||parseFloat(e.style.translate.split(' ')[1])>0),`${name}: drag from the handle`);
    await bounded();
    const scene=await control('view').boundingBox(),sheet=await panel.boundingBox();
    if(id!=='wizard')assert.ok(scene.y+scene.height>=sheet.y-1,`${name}: no canvas gap during handle dragging`);
    await panel.evaluate(e=>e.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[]})));
   };
   if(id==='wizard') await drag(100);
   await drag(-100);
   assert.equal(await panel.getAttribute('data-sheet-position'),id==='wizard'?'full':'expanded',`${name}: expand from the handle`);
   await bounded();
   await drag(100);
   assert.equal(await panel.getAttribute('data-sheet-position'),'compact',`${name}: lower from the body`);
   if(id!=='wizard') {
    const scrollHandle=await panel.evaluateHandle(e=>[e,...e.querySelectorAll('*')].find(node=>
     node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY))??null);
    const scroller=scrollHandle.asElement();
    if(scroller) {
     await scroller.evaluate(e=>e.scrollTop=0);
     const b=await scroller.boundingBox(),x=b.x+8,y=b.y+b.height*.78,cdp=await page.context().newCDPSession(page);
     const startTarget=await page.evaluate(({x,y})=>{
      const e=document.querySelector('#editor-root').shadowRoot.elementFromPoint(x,y);
      return {tag:e.tagName,cls:e.className,action:getComputedStyle(e).touchAction};
     },{x,y});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     for(let n=1;n<=10;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-65*n/10,id:1}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await page.waitForTimeout(200);
     const scrollState=await scroller.evaluate(e=>({top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight,overflow:getComputedStyle(e).overflowY,position:e.dataset.sheetPosition}));
     if(scrollState.top===0)await page.screenshot({path:'/tmp/wardrobe-sheet-scroll-failure.png'});
     assert.ok(scrollState.top>0,`${name}: first upward swipe scrolls overflowing content (${JSON.stringify({startTarget,scrollState})})`);
     assert.equal(await panel.getAttribute('data-sheet-position'),'compact',`${name}: scrolling does not expand the drawer`);
     await bounded();
     console.log(`PASS ${width}×${height} ${name}: native touch scroll on first swipe`);
    }
    await scrollHandle.dispose();
    await page.evaluate(height=>{
     const root=document.querySelector('#editor-root');
     root.style.height=`${Math.round(height*.6)}px`;root.setAttribute('data-keyboard-open','');
    },height);
    await bounded();
    if(id==='pop4')await page.screenshot({path:`/tmp/wardrobe-sheet-keyboard-${width}.png`});
    await page.evaluate(()=>{
     const root=document.querySelector('#editor-root');root.style.height='100%';root.removeAttribute('data-keyboard-open');
    });
    await bounded();
   }
   await drag(90);
   assert.equal(await panel.isVisible(),false,`${name}: close from the body`);
   assert.equal(await control('toolbar').isVisible(),true,`${name}: closing restores toolbar`);
   console.log(`PASS ${width}×${height} ${name}: handle drag, expand/lower/close${id==='wizard'?', full-screen overlay':', height limit, no gap'}`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
