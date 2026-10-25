import type { AccountPlatform, GuestOffer } from './account.ports';
import { accountErrorMessage, needsConfirmation } from './account-errors';
import { accountMenuItem, accountSheet } from './account-markup';
import { createLoadingState } from '../components/loading-state';

export type AccountView = 'sign-up' | 'sign-in' | 'confirm' | 'forgot' | 'reset' | 'adopt';
export interface AccountOpenOptions {
  /** Why the sheet opened: buying or using credits needs an account. */
  readonly reason?: 'credits';
  readonly view?: AccountView;
}

interface Ports {
  dom: { $(selector: string): HTMLElement };
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  platform: AccountPlatform;
  /** Closes the editor menu the account item sits in. */
  closeMenu(): void;
  /** The editor's short notice: used only when signing out is refused. */
  toast(message: string): void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CREDITS_LEAD = 'Credits belong to your account, so they are safe on every device. It is free and takes a minute.';
const COPY: Record<AccountView, readonly [string, string]> = {
  'sign-up': ['Sign up for free', 'Keep your designs and credits safe, and open them on any device.'],
  'sign-in': ['Welcome back', 'Sign in to see your designs and credits on this device.'],
  confirm: ['Check your email', ''],
  forgot: ['Reset your password', 'We will email you a code to choose a new password.'],
  reset: ['Choose a new password', ''],
  adopt: ['Add your earlier work?', ''],
};

/** What was found from before signing in, and the question: nothing moves until the person says yes. */
export function offerCopy(offer: GuestOffer, email: string) {
  const n = offer.designs.length;
  const found = [n ? `${n} ${n === 1 ? 'design' : 'designs'}` : '', offer.credits ? `${offer.credits} credits` : ''].filter(Boolean).join(' and ');
  return `This browser has ${found} from before you signed in. Add ${n === 1 && !offer.credits ? 'it' : 'them'} to ${email}? If you do not, they stay out of your account.`;
}

/**
 * "Sign in / Sign up" last in the ⋮ menu, and the sheet it opens: Google, or an email and a password with a
 * code to confirm the email. Designing never needs an account; credits do (the wallet opens this sheet).
 */
export function bindAccount({ dom, lifetime, platform, closeMenu, toast }: Ports) {
  const page = dom.$('#app').ownerDocument;
  const item = page.createElement('button');
  item.type = 'button'; item.className = 'mi ac-menu'; item.setAttribute('role', 'menuitem');
  item.innerHTML = accountMenuItem(platform.email());
  const group = dom.$('#menu').querySelector('[data-menu-group="account"]') ?? dom.$('#menu');
  // Last in the group: Credits (the wallet) sits above it, right after the group's title.
  group.append(item);

  const overlay = page.createElement('div');
  overlay.className = 'cr-overlay ac-overlay'; overlay.hidden = true; overlay.innerHTML = accountSheet();
  dom.$('#app').append(overlay);
  const $ = <T extends HTMLElement = HTMLElement>(selector: string, within: ParentNode = overlay) => within.querySelector<T>(selector)!;
  const sheet = $('.cr-sheet'), heading = $('.ac-head h2'), lead = $('.ac-lead'), error = $('.cr-error'), tabs = $('.ac-tabs'), start = $('.ac-start');
  const credentials = $<HTMLFormElement>('.ac-credentials'), confirm = $<HTMLFormElement>('.ac-confirm');
  const forgot = $<HTMLFormElement>('.ac-forgot'), reset = $<HTMLFormElement>('.ac-reset');
  const adopt = $('.ac-adopt'), google = $<HTMLButtonElement>('.ac-google');
  const loading = new Map<HTMLElement, ReturnType<typeof createLoadingState>>([credentials, confirm, forgot, reset, adopt]
    .map(section => [section, createLoadingState(section)]));
  let view: AccountView = 'sign-in', entry: AccountView = 'sign-in', address = '', reason: 'credits' | null = null;
  let busy = false, previousFocus: HTMLElement | null = null;

  const input = (form: HTMLFormElement, name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const say = (message: string | null) => { error.hidden = !message; error.textContent = message ?? ''; };
  const focusFirst = () => {
    const section = [start, confirm, forgot, reset, adopt].find(s => !s.hidden);
    section?.querySelector<HTMLElement>('input:not([value]), input, .cr-primary')?.focus();
  };

  function show(next: AccountView, message = '') {
    view = next; sheet.dataset.view = next; say(null);
    const starting = next === 'sign-up' || next === 'sign-in';
    if (starting) entry = next;
    heading.textContent = COPY[next][0];
    lead.textContent = message || (reason && starting ? CREDITS_LEAD : COPY[next][1]);
    tabs.hidden = !starting; start.hidden = !starting;
    confirm.hidden = next !== 'confirm'; forgot.hidden = next !== 'forgot'; reset.hidden = next !== 'reset';
    adopt.hidden = next !== 'adopt';
    tabs.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.tab === next)));
    if (starting) {
      input(credentials, 'password').autocomplete = next === 'sign-up' ? 'new-password' : 'current-password';
      $('.ac-hint', credentials).hidden = next !== 'sign-up';
      $('.ac-submit', credentials).textContent = next === 'sign-up' ? 'Sign up' : 'Sign in';
      $('.ac-to-forgot', credentials).hidden = next !== 'sign-in';
    }
    focusFirst();
  }
  function setBusy(section: HTMLElement | null, on: boolean) {
    busy = on;
    if (section) { if (on) loading.get(section)?.start(); else loading.get(section)?.stop(); }
    overlay.querySelectorAll<HTMLButtonElement | HTMLInputElement>('form button, form input, .ac-google')
      .forEach(control => { control.disabled = on; });
  }
  /** One request at a time. A request that signs in reloads the page, so the sheet stays busy until then. */
  async function run(section: HTMLElement | null, work: () => Promise<void>) {
    if (busy) return;
    say(null); setBusy(section, true);
    try { await work(); } catch (e) { say(accountErrorMessage(e)); } finally { setBusy(section, false); }
  }
  function refuse(form: HTMLFormElement, name: string, message: string) { say(message); input(form, name).focus(); }
  const askForCode = (message = `Enter the code we sent to ${address}. It can take a minute to arrive.`) => {
    input(confirm, 'code').value = ''; show('confirm', message);
  };

  function open(options: AccountOpenOptions = {}) {
    reason = options.reason ?? null;
    if (overlay.hidden) previousFocus = page.activeElement as HTMLElement | null;
    overlay.hidden = false;
    show(options.view ?? 'sign-in');
  }
  function close() {
    if (overlay.hidden || busy) return;
    overlay.hidden = true;
    previousFocus?.focus();
  }

  let leaving = false;
  lifetime.listen(item, 'click', () => {
    closeMenu();
    if (platform.email() === null) { open(); return; }
    // Signed in, the item is Sign out: it saves the open design, erases this browser's copy and starts again as a guest.
    // The only thing said is a refusal (the design could not be saved yet).
    if (leaving) return;
    leaving = true; item.disabled = true;
    void platform.signOut().catch(e => { toast(accountErrorMessage(e)); leaving = false; item.disabled = false; });
  });
  lifetime.listen(tabs, 'click', e => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]')?.dataset.tab;
    if ((tab === 'sign-up' || tab === 'sign-in') && !busy) show(tab);
  });
  lifetime.listen(google, 'click', () => { void run(null, () => platform.google()); });
  lifetime.listen(credentials, 'submit', event => {
    event.preventDefault();
    const email = input(credentials, 'email').value.trim().toLowerCase(), password = input(credentials, 'password').value;
    if (!EMAIL.test(email)) return refuse(credentials, 'email', 'Enter your email address.');
    if (view === 'sign-up' && password.length < 8) return refuse(credentials, 'password', 'Choose a password of at least 8 characters.');
    if (!password) return refuse(credentials, 'password', 'Enter your password.');
    address = email;
    void run(credentials, async () => {
      if (view === 'sign-up') { await platform.signUp(email, password); askForCode(); return; }
      try { await platform.signIn(email, password); } catch (e) {
        if (!needsConfirmation(e)) throw e;
        await platform.resendSignUp(email).catch(() => undefined);
        askForCode(`Confirm your email first: we sent a new code to ${email}.`);
      }
    });
  });
  lifetime.listen(confirm, 'submit', event => {
    event.preventDefault();
    const code = input(confirm, 'code').value.replace(/\D/g, '');
    if (code.length < 6) return refuse(confirm, 'code', 'Enter the code from the email.');
    void run(confirm, () => platform.confirmSignUp(address, code));
  });
  lifetime.listen($('.ac-resend'), 'click', () => {
    void run(confirm, async () => { await platform.resendSignUp(address); lead.textContent = `A new code is on its way to ${address}.`; });
  });
  overlay.querySelectorAll('.ac-to-start').forEach(button => lifetime.listen(button, 'click', () => show(entry)));
  lifetime.listen($('.ac-to-forgot', credentials), 'click', () => {
    input(forgot, 'email').value = input(credentials, 'email').value; show('forgot');
  });
  lifetime.listen(forgot, 'submit', event => {
    event.preventDefault();
    const email = input(forgot, 'email').value.trim().toLowerCase();
    if (!EMAIL.test(email)) return refuse(forgot, 'email', 'Enter your email address.');
    address = email;
    void run(forgot, async () => {
      await platform.sendReset(email);
      input(reset, 'code').value = ''; input(reset, 'password').value = '';
      show('reset', `Enter the code we sent to ${email} and choose a new password.`);
    });
  });
  lifetime.listen($('.ac-to-forgot', reset), 'click', () => {
    void run(reset, async () => { await platform.sendReset(address); lead.textContent = `A new code is on its way to ${address}.`; });
  });
  lifetime.listen(reset, 'submit', event => {
    event.preventDefault();
    const code = input(reset, 'code').value.replace(/\D/g, ''), password = input(reset, 'password').value;
    if (code.length < 6) return refuse(reset, 'code', 'Enter the code from the email.');
    if (password.length < 8) return refuse(reset, 'password', 'Choose a password of at least 8 characters.');
    void run(reset, () => platform.resetPassword(address, code, password));
  });
  lifetime.listen($('.ac-adopt-yes'), 'click', () => {
    // A failed move changes nothing and the question stays: the person can try again.
    void run(adopt, () => platform.adopt().catch(() => { throw Object.assign(new Error('Not added.'), { code: 'adopt_failed' }); }));
  });
  lifetime.listen($('.ac-adopt-no'), 'click', () => {
    platform.decline(); close();
  });
  lifetime.listen($('.cr-close'), 'click', close);
  lifetime.listen(overlay, 'mousedown', e => { if (e.target === overlay) close(); });
  lifetime.listen(page, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(el => el.offsetParent !== null);
    const root = sheet.getRootNode() as Document | ShadowRoot, active = root.activeElement;
    if (e.shiftKey && active === focusable[0]) { e.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!e.shiftKey && active === focusable.at(-1)) { e.preventDefault(); focusable[0]?.focus(); }
  });
  lifetime.cleanup(() => { loading.forEach(state => state.stop()); overlay.remove(); item.remove(); });

  // Google is offered once Auth says it is turned on.
  void platform.providers().then(list => { const on = list.includes('google'); google.hidden = !on; $('.ac-or').hidden = !on; });

  // Signed in with work from this browser as a guest: ask before anything moves. Nothing else is announced.
  const offer = platform.offer();
  if (offer) {
    const names = offer.designs.slice(0, 3).map(design => design.name).concat(offer.designs.length > 3 ? [`and ${offer.designs.length - 3} more`] : []);
    $('.ac-adopt-list').replaceChildren(...names.map(name => { const li = page.createElement('li'); li.textContent = name; return li; }));
    overlay.hidden = false; previousFocus = page.activeElement as HTMLElement | null;
    show('adopt', offerCopy(offer, platform.email() ?? 'your account'));
  }

  return {
    open, close,
    /** A guest: buying or using credits opens this sheet first. */
    get guest() { return platform.email() === null; },
  };
}
export type AccountApi = ReturnType<typeof bindAccount>;
