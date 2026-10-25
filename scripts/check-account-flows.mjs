// Drives the sign-in sheet through every flow with a pretend account platform: no account is created and no email sent.
// Run with Vite serving this checkout: ACCOUNT_TEST_URL=http://127.0.0.1:5177 node scripts/check-account-flows.mjs [screenshot-folder]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.ACCOUNT_TEST_URL ?? 'http://127.0.0.1:5177', shots = process.argv[2];

const harness = (email, welcome) => `<body style="margin:0;min-height:100vh;background:#e9e5dd"><div id="host"></div><script type="module">
 import {bindAccount} from '/src/presentation/account/account-sheet.ts';
 import {createEditorLifetime} from '/src/presentation/viewport/editor-lifetime.js';
 import credits from '/src/presentation/credits/credits.css?raw';import account from '/src/presentation/account/account.css?raw';
 import loading from '/src/presentation/components/loading-state.css?raw';
 const host=document.querySelector('#host'),shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<style>:host{font:14px system-ui;--panel:#faf8f3;--ink:#302d26;--line:#dfd9ce;--mute:#76736c;container-type:inline-size;display:block;min-height:100vh}'
  +'#menu{width:280px;margin:12px;background:#fff;border-radius:12px;padding:6px}.mi{display:flex;gap:8px;align-items:center;width:100%;padding:8px;border:0;background:none;font:inherit}'
  +credits+account+loading+'</style><div id="app"><div id="menu"><div data-menu-group="account"><div class="menu-group-title">Account</div></div></div></div>';
 const calls=window.calls=[], never=()=>new Promise(()=>{});
 const fail=code=>Promise.reject(Object.assign(new Error(code),{code}));
 const platform={email:()=>(${JSON.stringify(email)}),welcome:()=>(${JSON.stringify(welcome)}),
  providers:()=>Promise.resolve(window.noGoogle?[]:['google']),
  signIn:(e,p)=>{calls.push(['signIn',e]);return e==='wrong@example.test'?fail('invalid_credentials'):e==='unconfirmed@example.test'?fail('email_not_confirmed'):never();},
  signUp:(e)=>{calls.push(['signUp',e]);return e==='taken@example.test'?fail('user_already_exists'):Promise.resolve('confirm');},
  confirmSignUp:(e,c)=>{calls.push(['confirmSignUp',e,c]);return c==='00000000'?fail('otp_expired'):never();},
  resendSignUp:(e)=>{calls.push(['resendSignUp',e]);return Promise.resolve();},
  google:()=>{calls.push(['google']);return never();},
  sendReset:(e)=>{calls.push(['sendReset',e]);return Promise.resolve();},
  resetPassword:(e,c)=>{calls.push(['resetPassword',e,c]);return never();},
  signOut:()=>{calls.push(['signOut']);return never();}};
 window.toasts=[];
 window.account=bindAccount({dom:{$:s=>shadow.querySelector(s)},lifetime:createEditorLifetime(),platform,toast:m=>toasts.push(m),closeMenu:()=>{}});
 </script></body>`;

const browser = await chromium.launch({ headless: true });
const passed = [];
try {
  for (const width of [375, 1280]) {
    const run = async (name, email, welcome, steps, { google = true } = {}) => {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 812 : 800 }, reducedMotion: 'reduce' });
      if (!google) await page.addInitScript(() => { window.noGoogle = true; });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/account-flows', r => r.fulfill({ contentType: 'text/html', body: harness(email, welcome) }));
      await page.goto(base + '/account-flows');
      await page.locator('.ac-menu').waitFor();
      const sheet = page.locator('.ac-sheet'), error = page.locator('.ac-sheet .cr-error');
      const fill = async (form, values) => { for (const [field, value] of Object.entries(values)) await page.locator(`${form} [name="${field}"]`).fill(value); };
      const submit = form => page.locator(`${form} button[type="submit"]`).click();
      const calls = () => page.evaluate(() => window.calls);
      await steps({ page, sheet, error, fill, submit, calls, shot: async label => { if (shots) await page.screenshot({ path: `${shots}/${label}-${width}.png` }); } });
      assert.deepEqual(errors, [], name);
      passed.push(`PASS ${name} @${width}px`);
      await page.close();
    };

    await run('sign up, confirm with the code', null, null, async ({ page, sheet, error, fill, submit, calls, shot }) => {
      assert.equal((await page.locator('.ac-menu').innerText()).trim(), 'Sign in / Sign up');
      await page.locator('.ac-menu').click();
      await sheet.waitFor();
      await page.locator('.ac-google').waitFor();
      assert.equal(await page.locator('.ac-tabs [role="tab"]').first().innerText(), 'Sign in', 'Sign in is the first tab');
      assert.equal(await page.locator('.ac-tabs [aria-selected="true"]').innerText(), 'Sign in', 'and the one that opens');
      await page.locator('.ac-tabs [data-tab="sign-up"]').click();
      await shot('create-account');
      await fill('.ac-credentials', { email: 'Person@Example.test', password: 'short' });
      await submit('.ac-credentials');
      assert.match(await error.innerText(), /at least 8 characters/);
      await fill('.ac-credentials', { password: 'long enough password' });
      await submit('.ac-credentials');
      await page.locator('.ac-confirm:not([hidden])').waitFor();
      assert.match(await page.locator('.ac-lead').innerText(), /person@example\.test/, 'the email is kept, lower-cased');
      await fill('.ac-confirm', { code: '00000000' });
      await submit('.ac-confirm');
      assert.match(await error.innerText(), /wrong or has expired/);
      await page.locator('.ac-resend').click();
      await page.waitForFunction(() => window.calls.some(c => c[0] === 'resendSignUp'));
      await shot('confirm-code');
      await fill('.ac-confirm', { code: '1234 5678' });
      await submit('.ac-confirm');
      assert.equal(await page.locator('.ac-confirm button[type="submit"]').isDisabled(), true, 'stays busy while the page reloads');
      assert.deepEqual((await calls()).at(-1), ['confirmSignUp', 'person@example.test', '12345678']);
    });

    await run('sign in: wrong password, unconfirmed email, existing email on sign-up', null, null, async ({ page, error, fill, submit, calls, shot }) => {
      await page.evaluate(() => window.account.open({ view: 'sign-in' }));
      await fill('.ac-credentials', { email: 'wrong@example.test', password: 'whatever1' });
      await submit('.ac-credentials');
      assert.match(await error.innerText(), /do not match/);
      await shot('sign-in-error');
      await fill('.ac-credentials', { email: 'unconfirmed@example.test' });
      await submit('.ac-credentials');
      await page.locator('.ac-confirm:not([hidden])').waitFor();
      assert.match(await page.locator('.ac-lead').innerText(), /Confirm your email first/);
      assert.ok((await calls()).some(c => c[0] === 'resendSignUp' && c[1] === 'unconfirmed@example.test'));
      await page.locator('.ac-confirm .ac-to-start').click();
      await page.locator('.ac-tabs [data-tab="sign-up"]').click();
      await fill('.ac-credentials', { email: 'taken@example.test', password: 'long enough password' });
      await submit('.ac-credentials');
      assert.match(await error.innerText(), /already has an account/);
      await page.locator('.ac-google').click();
      assert.deepEqual((await calls()).at(-1), ['google']);
    });

    await run('forgot password: email a code, choose a new password', null, null, async ({ page, error, fill, submit, calls, shot }) => {
      await page.evaluate(() => window.account.open({ view: 'sign-in' }));
      await fill('.ac-credentials', { email: 'person@example.test' });
      await page.locator('.ac-credentials .ac-to-forgot').click();
      assert.equal(await page.locator('.ac-forgot [name="email"]').inputValue(), 'person@example.test');
      await submit('.ac-forgot');
      await page.locator('.ac-reset:not([hidden])').waitFor();
      await fill('.ac-reset', { code: '12345678', password: 'short' });
      await submit('.ac-reset');
      assert.match(await error.innerText(), /at least 8 characters/);
      await shot('reset-password');
      await fill('.ac-reset', { password: 'a new long password' });
      await submit('.ac-reset');
      assert.deepEqual((await calls()).map(c => c[0]), ['sendReset', 'resetPassword']);
    });

    await run('Google is offered only when it is turned on in Supabase', null, null, async ({ page }) => {
      await page.evaluate(() => window.account.open());
      await page.locator('.ac-credentials').waitFor();
      assert.equal(await page.locator('.ac-google').isHidden(), true);
      assert.equal(await page.locator('.ac-or').isHidden(), true);
    }, { google: false });

    await run('signed in: the menu shows the email, the sheet signs out', 'person@example.test', null, async ({ page, sheet, calls, shot }) => {
      assert.match(await page.locator('.ac-menu').innerText(), /person@example\.test/);
      await page.locator('.ac-menu').click();
      await sheet.waitFor();
      assert.match(await page.locator('.ac-lead').innerText(), /Signed in as person@example\.test/);
      await shot('account');
      await page.locator('.ac-sign-out').click();
      assert.deepEqual((await calls()).at(-1), ['signOut']);
    });

    await run('just signed in: says what came along from this browser', 'person@example.test', { email: 'person@example.test', designs: 3, credits: 12 },
      async ({ page, sheet, shot }) => {
        await sheet.waitFor();
        assert.match(await page.locator('.ac-lead').innerText(), /3 designs from this browser are now in your account, with 12 credits\./);
        await shot('welcome');
        await page.locator('.ac-welcome .ac-done').click();
        assert.equal(await page.locator('.ac-overlay').isHidden(), true);
      });
    await run('just signed in with nothing to bring: a short notice', 'person@example.test', { email: 'person@example.test', designs: 0, credits: 0 },
      async ({ page }) => {
        assert.equal(await page.locator('.ac-overlay').isHidden(), true);
        assert.deepEqual(await page.evaluate(() => window.toasts), ['Signed in as person@example.test.']);
      });
  }
} finally { await browser.close(); }
console.log(passed.join('\n'));
