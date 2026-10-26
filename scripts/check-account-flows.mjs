// Drives the sign-in sheet through every flow with a pretend account platform: no account is created and no email sent.
// Run with Vite serving this checkout: ACCOUNT_TEST_URL=http://127.0.0.1:5177 node scripts/check-account-flows.mjs [screenshot-folder]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.ACCOUNT_TEST_URL ?? 'http://127.0.0.1:5177', shots = process.argv[2];

const harness = (email) => `<body style="margin:0;min-height:100vh;background:#e9e5dd"><div id="host"></div><script type="module">
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
 const platform={email:()=>(${JSON.stringify(email)}),
  offer:()=>(window.offerData??null),declined:0,
  adopt:()=>{calls.push(['adopt']);return window.adoptFails?Promise.reject(new Error('503')):never();},
  decline:()=>{calls.push(['decline']);},
  providers:()=>Promise.resolve(window.noGoogle?[]:['google']),
  signIn:(e,p)=>{calls.push(['signIn',e]);return e==='wrong@example.test'?fail('invalid_credentials'):e==='unconfirmed@example.test'?fail('email_not_confirmed'):never();},
  signUp:(e)=>{calls.push(['signUp',e]);return e==='taken@example.test'?fail('user_already_exists'):Promise.resolve('confirm');},
  confirmSignUp:(e,c)=>{calls.push(['confirmSignUp',e,c]);return c==='00000000'?fail('otp_expired'):never();},
  resendSignUp:(e)=>{calls.push(['resendSignUp',e]);return Promise.resolve();},
  google:()=>{calls.push(['google']);return never();},
  sendReset:(e)=>{calls.push(['sendReset',e]);return Promise.resolve();},
  resetPassword:(e,c)=>{calls.push(['resetPassword',e,c]);return never();},
  signOut:()=>{calls.push(['signOut']);return window.unsaved?fail('unsaved_changes'):never();}};
 window.toasts=[];
 window.account=bindAccount({dom:{$:s=>shadow.querySelector(s)},lifetime:createEditorLifetime(),platform,toast:m=>toasts.push(m),closeMenu:()=>{}});
 </script></body>`;

const browser = await chromium.launch({ headless: true });
const passed = [];
try {
  for (const width of [375, 1280]) {
    const run = async (name, email, _unused, steps, { google = true, offer = null } = {}) => {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 812 : 800 }, reducedMotion: 'reduce' });
      if (!google) await page.addInitScript(() => { window.noGoogle = true; });
      if (offer) await page.addInitScript(value => { window.offerData = value; }, offer);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/account-flows', r => r.fulfill({ contentType: 'text/html', body: harness(email) }));
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

    await run('compact sign-in, account link and keyboard navigation', null, null, async ({ page, sheet, fill, submit, shot }) => {
      await page.locator('.ac-menu').click();
      await sheet.waitFor();
      assert.equal(await sheet.getAttribute('data-view'), 'sign-in');
      assert.equal(await sheet.locator('[role="tablist"], .ac-avatar').count(), 0);
      assert.equal(await page.locator('.ac-switch-action').innerText(), 'Create account');
      const email = page.locator('.ac-credentials [name="email"]');
      const password = page.locator('.ac-credentials [name="password"]');
      const button = page.locator('.ac-submit');
      for (const field of [email, password]) {
        const { height } = await field.boundingBox();
        assert.ok(height >= 52 && height <= 56, `input is ${height}px high`);
      }
      assert.equal((await button.boundingBox()).height, 54);
      assert.equal(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight), true, 'the initial form fits without scrolling');
      await shot('sign-in');
      await fill('.ac-credentials', { email: 'person@example.test', password: 'a long password' });
      await page.locator('.ac-switch-action').click();
      assert.equal(await sheet.getAttribute('data-view'), 'sign-up');
      assert.equal(await password.getAttribute('autocomplete'), 'new-password');
      assert.equal(await email.inputValue(), 'person@example.test', 'switching retains entered credentials');
      assert.equal(await page.locator('.ac-hint').isVisible(), true);
      assert.equal(await page.locator('.ac-credentials .ac-to-forgot').isHidden(), true);
      await page.locator('.ac-switch-action').click();
      assert.equal(await password.getAttribute('autocomplete'), 'current-password');
      assert.equal(await page.locator('.ac-hint').isHidden(), true);
      await page.locator('.ac-switch-action').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.ac-sheet .cr-close').evaluate(el => el.matches(':focus')), true, 'Tab wraps inside the sheet');
      await page.keyboard.press('Escape');
      assert.equal(await sheet.isHidden(), true);
      assert.equal(await page.locator('.ac-menu').evaluate(el => el.matches(':focus')), true, 'closing restores focus');
      await page.locator('.ac-menu').click();
      await submit('.ac-credentials');
      assert.equal(await page.locator('.ac-switch-action').isDisabled(), true, 'a pending sign-in cannot switch modes');
    });

    await run('sign up, confirm with the code', null, null, async ({ page, sheet, error, fill, submit, calls, shot }) => {
      assert.equal((await page.locator('.ac-menu').innerText()).trim(), 'Sign in / Sign up');
      await page.locator('.ac-menu').click();
      await sheet.waitFor();
      await page.locator('.ac-google').waitFor();
      assert.equal(await sheet.getAttribute('data-view'), 'sign-in', 'Sign in opens first');
      await page.locator('.ac-switch-action').click();
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
      await page.locator('.ac-switch-action').click();
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

    await run('signed in: the menu item is just Sign out, and it signs out without an account page', 'person@example.test', null, async ({ page, calls }) => {
      assert.equal((await page.locator('.ac-menu').innerText()).trim(), 'Sign out');
      await page.locator('.ac-menu').click();
      assert.equal(await page.locator('.ac-overlay').isHidden(), true, 'no sheet opens');
      assert.deepEqual(await calls(), [['signOut']]);
      assert.deepEqual(await page.evaluate(() => window.toasts), [], 'nothing is announced');
    });
    await run('signed in: a refused sign-out says why, and can be tried again', 'person@example.test', null, async ({ page, calls }) => {
      await page.evaluate(() => { window.unsaved = true; });
      await page.locator('.ac-menu').click();
      await page.waitForFunction(() => window.toasts.length === 1);
      assert.match(await page.evaluate(() => window.toasts[0]), /could not be saved to your account yet, so you were not signed out/);
      assert.equal(await page.locator('.ac-menu').isDisabled(), false, 'the person can try again');
      await page.evaluate(() => { window.unsaved = false; });
      await page.locator('.ac-menu').click();
      assert.deepEqual((await calls()).map(c => c[0]), ['signOut', 'signOut']);
    });

    const offer = { designs: [{ id: 'a', name: 'Bedroom wardrobe' }, { id: 'b', name: 'Attic eaves' }], credits: 12 };
    await run('signed in with work from before: the person is asked, and a failed move can be retried', 'person@example.test', null, async ({ page, sheet, error, calls, shot }) => {
      await sheet.waitFor();
      assert.equal(await page.locator('.ac-head h2').innerText(), 'Add your earlier work?');
      assert.match(await page.locator('.ac-lead').innerText(), /2 designs and 12 credits from before you signed in\. Add them to person@example\.test\? If you do not, they stay out of your account\./);
      assert.deepEqual(await page.locator('.ac-adopt-list li').allInnerTexts(), ['Bedroom wardrobe', 'Attic eaves']);
      assert.deepEqual(await calls(), [], 'asking moves nothing');
      await shot('adopt-offer');
      await page.evaluate(() => { window.adoptFails = true; });
      await page.locator('.ac-adopt-yes').click();
      assert.match(await error.innerText(), /Nothing was moved\. Try again/);
      assert.equal(await page.locator('.ac-adopt-yes').isDisabled(), false, 'the question stays');
      await page.evaluate(() => { window.adoptFails = false; });
      await page.locator('.ac-adopt-yes').click();
      assert.deepEqual((await calls()).map(c => c[0]), ['adopt', 'adopt']);
    }, { offer });
    await run('signed in with work from before: "Do not add" leaves it out, quietly', 'person@example.test', null, async ({ page, sheet, calls }) => {
      await sheet.waitFor();
      await page.locator('.ac-adopt-no').click();
      assert.deepEqual(await calls(), [['decline']]);
      assert.equal(await page.locator('.ac-overlay').isHidden(), true);
      assert.deepEqual(await page.evaluate(() => window.toasts), [], 'declining is not announced');
    }, { offer: { designs: [{ id: 'a', name: 'Bedroom wardrobe' }], credits: 0 } });
    await run('signed in with no work from before: nothing is asked and nothing is announced', 'person@example.test', null, async ({ page }) => {
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.ac-overlay').isHidden(), true);
      assert.deepEqual(await page.evaluate(() => window.toasts), []);
    });
  }
} finally { await browser.close(); }
console.log(passed.join('\n'));
