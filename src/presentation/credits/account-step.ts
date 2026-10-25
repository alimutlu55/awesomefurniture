import type { CreditAccount } from './credits.ports';
import { accountStep } from './wallet-markup';
import { createLoadingState } from '../components/loading-state';

interface Ports {
  section: HTMLElement;
  account: CreditAccount;
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  /** The email is verified (or the page is reloading into the account it belongs to). */
  verified(): void;
  back(): void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "Keep your credits safe": an email and a one-time code turn this guest into an account, keeping its designs. */
export function bindAccountStep({ section, account, lifetime, verified, back }: Ports) {
  section.innerHTML = accountStep(account.email());
  const emailForm = section.querySelector<HTMLFormElement>('.cr-email-form')!, codeForm = section.querySelector<HTMLFormElement>('.cr-code-form')!;
  const emailInput = emailForm.elements.namedItem('email') as HTMLInputElement, codeInput = codeForm.elements.namedItem('code') as HTMLInputElement;
  const error = section.querySelector<HTMLElement>('.cr-error')!, note = section.querySelector<HTMLElement>('.cr-code-note')!;
  let mode: 'link' | 'sign-in' = 'link', email = '';

  const say = (message: string | null) => { error.hidden = !message; error.textContent = message ?? ''; };
  const emailLoading = createLoadingState(emailForm), codeLoading = createLoadingState(codeForm);
  lifetime.cleanup(() => { emailLoading.stop(); codeLoading.stop(); });
  const busy = (form: HTMLFormElement, on: boolean) => {
    const loading = form === emailForm ? emailLoading : codeLoading;
    if (on) loading.start(); else loading.stop();
    form.querySelectorAll('button,input').forEach(el => { (el as HTMLButtonElement).disabled = on; });
  };

  lifetime.listen(emailForm, 'submit', event => {
    event.preventDefault();
    if (emailLoading.active) return;
    email = emailInput.value.trim().toLowerCase();
    if (!EMAIL.test(email)) { say('Enter your email address.'); emailInput.focus(); return; }
    say(null); busy(emailForm, true);
    account.sendCode(email).then(next => {
      mode = next;
      note.textContent = next === 'sign-in'
        ? `${email} already has an account. Enter the code we sent to open it here; this design comes with you.`
        : `We sent a code to ${email}. It can take a minute to arrive.`;
      emailForm.hidden = true; codeForm.hidden = false; codeInput.value = ''; codeInput.focus();
    }, () => say('We could not send a code. Check the address and try again in a minute.')).finally(() => busy(emailForm, false));
  });
  lifetime.listen(codeForm, 'submit', event => {
    event.preventDefault();
    if (codeLoading.active) return;
    const code = codeInput.value.replace(/\D/g, '');
    if (code.length < 6) { say('Enter the code from the email.'); codeInput.focus(); return; }
    say(null); busy(codeForm, true);
    account.verify(email, code, mode).then(verified, () => {
      say('That code did not work. Check it, or ask for a new one.');
      codeInput.select();
    }).finally(() => busy(codeForm, false));
  });
  // The email's link confirmed the address without a code: read the account again and carry on.
  lifetime.listen(section.querySelector('.cr-confirmed')!, 'click', () => {
    say(null); busy(emailForm, true);
    account.refresh().then(verified, () => say('We could not confirm it yet. Open the link in the email, then try again.'))
      .finally(() => busy(emailForm, false));
  });
  lifetime.listen(section.querySelector('.cr-other-email')!, 'click', () => {
    codeForm.hidden = true; emailForm.hidden = false; say(null); emailInput.select();
  });
  lifetime.listen(section.querySelector('.cr-account-back')!, 'click', back);
  return { focus: () => (emailForm.hidden ? codeInput : emailInput).focus() };
}
