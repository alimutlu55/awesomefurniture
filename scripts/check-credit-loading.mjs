// Held requests verify wallet and account loading without sending emails or creating payments.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base = process.env.LOADING_TEST_URL ?? 'http://127.0.0.1:5177';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];await page.route('**/api/credits**',r=>{requests.push(r);});
 await page.route('**/credit-loading-review',r=>r.fulfill({contentType:'text/html',body:`<body><div id="host"></div><script type="module">
 import {bindCreditWallet} from '/src/presentation/credits/credit-wallet.ts';
 import {bindAccountStep} from '/src/presentation/credits/account-step.ts';
 import {createEditorLifetime} from '/src/presentation/viewport/editor-lifetime.js';
 import {CREDIT_PACKS,CREDIT_FEATURES,packCredits,packSaving} from '/src/domain/credits/credit-catalog.ts';
 import css from '/src/presentation/credits/credits.css?raw';import loadingCss from '/src/presentation/components/loading-state.css?raw';
 const host=document.querySelector('#host'),shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{font:14px system-ui;--panel:#faf8f3;--ink:#302d26;--line:#dfd9ce}'+css+loadingCss+'</style><div id="app"><div id="menu"><div class="dd-title">Menu</div></div></div>';
 const lifetime=createEditorLifetime(), account={email:()=>null,sendCode:()=>new Promise(resolve=>window.review.resolveCode=resolve),verify:()=>new Promise((_,reject)=>window.review.rejectVerify=reject)};
 window.review={payload:{balance:50,account:{anonymous:false,email:'test@example.com',required:false},features:CREDIT_FEATURES.map(f=>({...f,freeLeft:1})),packs:CREDIT_PACKS.map(p=>({...p,total:packCredits(p),saving:packSaving(p)})),history:[],passes:[],providers:[]}};
 review.wallet=bindCreditWallet({dom:{host,$:s=>shadow.querySelector(s)},lifetime,platform:{accessToken:async()=>null,designId:()=>null,returned:()=>null,redirect:()=>{},account},toast:()=>{}});
 review.account=()=>{const section=shadow.querySelector('.cr-account');bindAccountStep({section,account,lifetime,verified:()=>{},back:()=>{}});review.wallet.open({view:'account'});};
 </script></body>`}));
 await page.goto(base + '/credit-loading-review');const chip=page.locator('.cr-chip');await chip.waitFor();assert.equal(await chip.isDisabled(),true);assert.equal(await chip.getAttribute('aria-busy'),'true');
 const payload=await page.evaluate(()=>review.payload);await requests.shift().fulfill({json:payload});await page.getByRole('menuitem',{name:'Credits: 50. Open your wallet',exact:true}).waitFor();assert.equal(await chip.getAttribute('aria-busy'),null);
 await chip.click();await page.locator('.cr-packs.ui-loading-surface').waitFor();assert.equal(await page.locator('.cr-pack').count(),4);await requests.shift().fulfill({json:payload});
 await page.locator('.cr-buy').click();await page.locator('.cr-buy.ui-loading-surface').waitFor();assert.equal(await page.locator('.cr-buy').isDisabled(),true);
 await requests.shift().fulfill({status:503,json:{error:{code:'CREDITS_UNAVAILABLE'}}});await page.locator('.cr-buy:not(.ui-loading-surface)').waitFor();assert.equal(await page.locator('.cr-buy').isEnabled(),true);
 await page.evaluate(()=>review.account());await page.getByRole('textbox',{name:'Email',exact:true}).fill('test@example.com');await page.locator('.cr-email-form').evaluate(el=>el.requestSubmit());await page.locator('.cr-email-form.ui-loading-surface').waitFor();
 await page.evaluate(()=>review.resolveCode('link'));await page.locator('.cr-code-form').waitFor();assert.equal(await page.locator('.cr-email-form').getAttribute('aria-busy'),null);
 await page.locator('input[name="code"]').fill('123456');await page.locator('.cr-code-form').evaluate(el=>el.requestSubmit());await page.locator('.cr-code-form.ui-loading-surface').waitFor();await page.evaluate(()=>review.rejectVerify(new Error('wrong code')));await page.locator('.cr-code-form:not(.ui-loading-surface)').waitFor();assert.equal(await page.locator('input[name="code"]').isEnabled(),true);
 await page.evaluate(()=>review.wallet.open({view:'wait'}));assert.equal(await page.locator('.cr-wait.ui-loading-surface').isVisible(),true);assert.equal(await page.locator('.cr-spinner').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS credit loading: initial balance, retained packs during refresh, checkout failure, email send, verification failure, and payment confirmation.');
}finally{await browser.close();}
