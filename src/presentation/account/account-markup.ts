const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>';
export const PERSON = '<svg class="ac-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"/></svg>';
// Google's sign-in mark, as its brand guidelines ask for on a "Continue with Google" button.
const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5Z"/>'
  + '<path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.7 6c4.5-4.1 6.6-10.2 6.6-17.4Z"/>'
  + '<path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2Z"/>'
  + '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48Z"/></svg>';

/** The sheet: the sign-in and create-account form, the code steps, the account and the welcome. */
export function accountSheet() {
  const field = (name: string, label: string, attributes: string) =>
    `<label class="cr-field"><span>${label}</span><input name="${name}" ${attributes} required></label>`;
  const code = field('code', 'Code', 'inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" placeholder="12345678"');
  return '<div class="cr-sheet ac-sheet" role="dialog" aria-modal="true" aria-labelledby="ac-title" tabindex="-1">'
    + `<button type="button" class="cr-close" aria-label="Close">${CLOSE}</button>`
    + `<header class="ac-head"><span class="ac-avatar">${PERSON}</span><div><h2 id="ac-title"></h2><p class="ac-lead"></p></div></header>`
    + '<div class="cr-tabs ac-tabs" role="tablist" aria-label="Account"><button type="button" role="tab" data-tab="sign-in">Sign in</button>'
    + '<button type="button" role="tab" data-tab="sign-up">Sign up</button></div>'
    + `<section class="ac-start"><button type="button" class="ac-google" hidden>${GOOGLE}<span>Continue with Google</span></button>`
    + '<p class="ac-or" hidden><span>or with your email</span></p>'
    + '<form class="ac-form ac-credentials" novalidate>' + field('email', 'Email', 'type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"')
    + field('password', 'Password', 'type="password" minlength="8"') + '<p class="ac-hint">At least 8 characters.</p>'
    + '<button type="submit" class="cr-primary ac-submit"></button><button type="button" class="cr-quiet ac-to-forgot">Forgot your password?</button></form></section>'
    + `<form class="ac-form ac-confirm" novalidate hidden>${code}<button type="submit" class="cr-primary">Confirm and sign in</button>`
    + '<button type="button" class="cr-quiet ac-resend">Send a new code</button><button type="button" class="cr-quiet ac-to-start">Use another email</button></form>'
    + '<form class="ac-form ac-forgot" novalidate hidden>' + field('email', 'Email', 'type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"')
    + '<button type="submit" class="cr-primary">Email me a code</button><button type="button" class="cr-quiet ac-to-start">Back to sign in</button></form>'
    + `<form class="ac-form ac-reset" novalidate hidden>${code}` + field('password', 'New password', 'type="password" autocomplete="new-password" minlength="8"')
    + '<button type="submit" class="cr-primary">Save and sign in</button><button type="button" class="cr-quiet ac-to-forgot">Send a new code</button></form>'
    + '<section class="ac-account" hidden><button type="button" class="cr-primary ac-done">Continue designing</button>'
    + '<button type="button" class="cr-quiet ac-sign-out">Sign out</button></section>'
    + '<section class="ac-adopt" hidden><ul class="ac-adopt-list"></ul>'
    + '<button type="button" class="cr-primary ac-adopt-yes">Add to my account</button>'
    + '<button type="button" class="cr-quiet ac-adopt-no">Do not add</button></section>'
    + '<section class="ac-welcome" hidden><button type="button" class="cr-primary ac-done">Continue designing</button></section>'
    + '<p class="cr-error" role="alert" hidden></p>'
    + '<p class="ac-privacy">We keep only your email. Designs you made in this browser come with you.</p></div>';
}

/** The ⋮ menu's first item: who is signed in, or the way to sign in. */
export function accountMenuItem(email: string | null) {
  return email ? `${PERSON}<span>Account</span><small class="ac-menu-email">${escape(email)}</small>` : `${PERSON}<span>Sign in / Sign up</span>`;
}
