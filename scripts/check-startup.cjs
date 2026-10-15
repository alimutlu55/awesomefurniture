// Production-build cold-load benchmark: npm run build && npm run preview, then node scripts/check-startup.cjs
// 4 Mbps / 80 ms RTT / 4x CPU slowdown, 375px at DPR 2. Auth is mocked to isolate rendering.
const assert=require('node:assert/strict');
const { chromium }=require('playwright');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
  const page=await context.newPage();
  await page.route('https://*.supabase.co/**',route=>route.fulfill({status:400,contentType:'application/json',body:'{"error":"test_offline","message":"Profiling without cloud requests"}'}));
  await page.addInitScript(()=>{
   window.startupProfile={frames:[],longTasks:[],grade:[],firstDraw:null};
   new PerformanceObserver(list=>window.startupProfile.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
   let last; const frame=t=>{if(last)window.startupProfile.frames.push({start:last,duration:t-last});last=t;requestAnimationFrame(frame)};requestAnimationFrame(frame);
   const original=CanvasRenderingContext2D.prototype.getImageData;
   CanvasRenderingContext2D.prototype.getImageData=function(...args){const start=performance.now();const result=original.apply(this,args);window.startupProfile.grade.push({start,readEnd:performance.now()});return result;};
   const put=CanvasRenderingContext2D.prototype.putImageData;
   CanvasRenderingContext2D.prototype.putImageData=function(...args){const result=put.apply(this,args);const entry=window.startupProfile.grade.at(-1);if(entry)entry.end=performance.now();return result;};
   for(const api of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=api.prototype.drawElements;api.prototype.drawElements=function(...args){window.startupProfile.firstDraw??=performance.now();return draw.apply(this,args)}}
  });
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:500000,uploadThroughput:250000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PROFILE_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[data-editor-id="more-btn"]').waitFor({timeout:60000});
  await page.waitForFunction(()=>performance.getEntriesByType('resource').filter(e=>/\.(webp|jpg)(?:$|\?)/.test(e.name)).length===6,{},{timeout:60000});
  await page.waitForTimeout(1500);
  const profile=await page.evaluate(()=>({...window.startupProfile,resources:performance.getEntriesByType('resource').filter(e=>/\.(webp|jpg)(?:$|\?)/.test(e.name)).map(e=>({name:e.name.split('/').at(-1),start:e.startTime,end:e.responseEnd,bytes:e.encodedBodySize})),navigation:performance.getEntriesByType('navigation').map(e=>({dom:e.domContentLoadedEventEnd,load:e.loadEventEnd}))}));
  const out=process.env.PROFILE_OUT||'/tmp/wardrobe-startup';
  const bytes=profile.resources.reduce((n,r)=>n+r.bytes,0);
  if (!process.env.STARTUP_BASELINE) {
   assert.equal(errors.length,0);
   assert.ok(bytes>0 && bytes<1000000, 'Cold-load wood textures must stay below 1 MB');
   assert.ok(profile.resources.every(r=>r.bytes>0), 'Every texture must load successfully');
   assert.ok(profile.resources.every(r=>r.name.endsWith('.webp')), 'Never request the source JPEGs');
   assert.deepEqual(profile.grade, [], 'Colour grading must happen offline');
  }
  await page.screenshot({path:out+'.png'});await fs.writeFile(out+'.json',JSON.stringify({...profile,errors},null,2));
  console.log(JSON.stringify({textureBytes:bytes,textureReady:Math.max(...profile.resources.map(e=>e.end)),resources:profile.resources,grade:profile.grade,longTasks:profile.longTasks.sort((a,b)=>b.duration-a.duration).slice(0,8),errors},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
