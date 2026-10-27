interface Turnstile {
  render(container: HTMLElement, options: {
    sitekey: string; appearance: 'interaction-only'; theme: 'auto'; size: 'flexible';
    callback(token: string): void; 'error-callback'(): void; 'expired-callback'(): void; 'timeout-callback'(): void;
  }): string;
  remove(id: string): void;
}
type CaptchaWindow = Window & { turnstile?: Turnstile };
let loading: Promise<Turnstile> | undefined;
const unavailable = () => Object.assign(new Error('Verification unavailable.'), { code: 'captcha_failed' });

function loadTurnstile(): Promise<Turnstile> {
  const existing = (window as CaptchaWindow).turnstile;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); loading = undefined; reject(unavailable()); }, 15_000);
    script.onload = () => {
      clearTimeout(timer);
      const api = (window as CaptchaWindow).turnstile;
      if (api) resolve(api); else { loading = undefined; reject(unavailable()); }
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(unavailable()); };
    document.head.append(script);
  });
  return loading;
}

/** Tokens are single-use: every protected Auth operation gets a fresh verification. No token enters logs or storage. */
export async function authCaptchaOptions(): Promise<{ captchaToken?: string }> {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (!sitekey) return {};
  const api = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog'), title = document.createElement('h2');
    title.textContent = 'Quick security check';
    const hint = document.createElement('p'); hint.textContent = 'Please complete the check to continue.';
    const container = document.createElement('div'), cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Cancel';
    dialog.setAttribute('aria-label', 'Security verification');
    dialog.style.cssText = 'max-width:360px;width:calc(100% - 48px);border:1px solid #ddd;border-radius:16px;padding:24px;font:16px system-ui';
    dialog.append(title, hint, container, cancel); document.body.append(dialog);
    dialog.showModal();
    let widget: string | undefined, settled = false;
    const finish = (token?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (widget) api.remove(widget);
      dialog.close(); dialog.remove();
      if (token) resolve({ captchaToken: token }); else reject(unavailable());
    };
    const timer = setTimeout(() => finish(), 120_000);
    cancel.onclick = () => finish();
    dialog.oncancel = event => { event.preventDefault(); finish(); };
    try {
      widget = api.render(container, { sitekey, appearance: 'interaction-only', theme: 'auto', size: 'flexible',
        callback: token => finish(token), 'error-callback': () => finish(),
        'expired-callback': () => finish(), 'timeout-callback': () => finish() });
    } catch { finish(); }
  });
}
