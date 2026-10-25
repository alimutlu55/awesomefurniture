import type { CreditWallet } from '../../application/credits/credit-wallet';
import type { CreditWalletPorts } from './credit-wallet.ports';
import { createCreditsClient } from './credits-client';
import { creditErrorMessage, CreditUserError } from './credit-errors';
import { bindAccountStep } from './account-step';
import { bindCreditGate } from './credit-gate';
import { activityList, coin, featureList, money, packCards, walletShell, worth } from './wallet-markup';
import { createLoadingState, createLoadingPlaceholder } from '../components/loading-state';

type View = 'shop' | 'account' | 'activity' | 'wait' | 'done';
export interface WalletNeed { readonly feature: string; readonly cost: number; readonly balance: number }

const RESUME_KEY = 'wardrobe:credits:resume';
const session = {
  get(): string | null { try { return sessionStorage.getItem(RESUME_KEY); } catch { return null; } },
  set(value: string | null) { try { if (value) sessionStorage.setItem(RESUME_KEY, value); else sessionStorage.removeItem(RESUME_KEY); } catch { /* private mode */ } },
};

/** "Credits" with the balance in the editor menu, and the wallet sheet it opens: packs, the email step, checkout and activity. */
export function bindCreditWallet({ dom, lifetime, platform, toast, closeMenu = () => {} }: CreditWalletPorts) {
  const client = createCreditsClient(platform), page = dom.host.ownerDocument, win = page.defaultView!;
  const still = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const chip = page.createElement('button');
  chip.type = 'button'; chip.className = 'mi cr-chip'; chip.hidden = true; chip.setAttribute('role', 'menuitem');
  chip.innerHTML = coin() + '<span>Credits</span><b class="cr-chip-value">0</b><small class="cr-chip-buy">Get credits</small>'
    + '<i class="cr-chip-gain" aria-hidden="true"></i>';
  // Keep the balance in Account; the group stays hidden until credits are available.
  const menu = dom.$('#menu');
  (menu.querySelector('[data-menu-group="account"]') ?? menu).append(chip);

  const overlay = page.createElement('div');
  overlay.className = 'cr-overlay'; overlay.hidden = true; overlay.innerHTML = walletShell();
  dom.$('#app').append(overlay);
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => overlay.querySelector<T>(selector)!;
  const sheet = $('.cr-sheet'), balanceEl = $('.cr-balance'), need = $('.cr-need'), packs = $('.cr-packs'), buy = $<HTMLButtonElement>('.cr-buy');
  const error = $('.cr-shop .cr-error'), views: Record<View, HTMLElement> = {
    shop: $('.cr-shop'), account: $('.cr-account'), activity: $('.cr-activity'), wait: $('.cr-wait'), done: $('.cr-done'),
  };
  const resumers = new Map<string, { label: string; run: () => void }>();
  const chipLoading = createLoadingState(chip), packsLoading = createLoadingState(packs), checkoutLoading = createLoadingState(buy);
  const waitLoading = createLoadingState(views.wait);
  const initialPacks = createLoadingPlaceholder(page, 'Loading credit packs…', 'cards');
  const payment = createLoadingPlaceholder(page, 'Confirming your payment…');
  views.wait.prepend(payment);
  let selected = '', shown = 0, chipShown = 0, previousFocus: HTMLElement | null = null, overflow = '', disposed = false, buying = false;

  /** Counts a number up or down to its new value, the way coins land. */
  function count(el: HTMLElement, from: number, to: number, done?: () => void) {
    if (still() || from === to) { el.textContent = String(to); done?.(); return; }
    const start = performance.now(), duration = Math.min(1200, 300 + Math.abs(to - from) * 8);
    const step = () => {
      if (disposed) return;
      const t = Math.min(1, (performance.now() - start) / duration), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) lifetime.frame(step); else done?.();
    };
    lifetime.frame(step);
  }

  function render(wallet: CreditWallet | null) {
    chip.hidden = !wallet && !client.loading;
    chip.disabled = !wallet;
    if (client.loading) { chipLoading.start(); packsLoading.start(); } else { chipLoading.stop(); packsLoading.stop(); }
    if (!wallet) {
      chip.setAttribute('aria-label', 'Loading your credits…'); chip.querySelector('.cr-chip-value')!.textContent = '—';
      balanceEl.textContent = '—'; buy.disabled = true;
      packs.replaceChildren(...(client.loading ? [initialPacks] : []));
      return;
    }
    const label = `Credits: ${wallet.balance}. Open your wallet`;
    chip.ariaLabel = label; chip.title = label;
    chip.classList.toggle('cr-chip--empty', wallet.balance <= 0);
    const value = chip.querySelector<HTMLElement>('.cr-chip-value')!;
    if (value.dataset.ready && wallet.balance > chipShown) gain(wallet.balance - chipShown);
    count(value, chipShown, wallet.balance);
    chipShown = wallet.balance; value.dataset.ready = '1';
    count(balanceEl, shown, wallet.balance);
    shown = wallet.balance;
    $('.cr-worth').textContent = wallet.balance > 0 ? '≈ ' + worth(wallet.balance, wallet.features) : 'Buy a pack to create AI images and drawings.';
    if (!selected || !wallet.packs.some(p => p.id === selected)) selected = (wallet.packs.find(p => p.featured) ?? wallet.packs[0])?.id ?? '';
    packs.innerHTML = packCards(wallet.packs, wallet.features, selected);
    $('.cr-uses').innerHTML = featureList(wallet.features);
    views.activity.innerHTML = activityList(wallet);
    syncBuy(wallet);
  }
  function gain(amount: number) {
    if (amount <= 0) return;
    const floater = chip.querySelector<HTMLElement>('.cr-chip-gain')!;
    floater.textContent = '+' + amount;
    chip.classList.remove('cr-chip--gain'); void chip.offsetWidth; chip.classList.add('cr-chip--gain');
  }
  function syncBuy(wallet = client.wallet) {
    if (buying) checkoutLoading.start(); else checkoutLoading.stop();
    const pack = wallet?.packs.find(p => p.id === selected);
    buy.disabled = !pack || buying;
    buy.querySelector('span')!.textContent = buying ? 'Opening secure checkout…' : pack ? `Continue · ${money(pack.price, pack.currency)}` : 'Continue';
  }
  function select(id: string, focus = false) {
    selected = id;
    packs.querySelectorAll<HTMLElement>('.cr-pack').forEach(card => {
      const on = card.dataset.pack === id;
      card.setAttribute('aria-checked', String(on)); card.tabIndex = on ? 0 : -1;
      if (on && focus) card.focus();
    });
    syncBuy();
  }
  function show(view: View) {
    if (view === 'wait') waitLoading.start(); else waitLoading.stop();
    sheet.dataset.view = view;
    (Object.keys(views) as View[]).forEach(key => { views[key].hidden = key !== view; });
    overlay.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.tab === view)));
  }
  /** Shows an error where the person is looking: the sheet scrolls to it, because on a phone it sits above the fold. */
  function say(message: string | null, reason: string | null = null) {
    error.hidden = !message; error.textContent = message ? message + (reason ? ` (Reference: ${reason})` : '') : '';
    if (message) error.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
  }

  function open(options: { need?: WalletNeed; view?: View } = {}) {
    if (overlay.hidden) {
      previousFocus = page.activeElement as HTMLElement | null;
      overflow = page.body.style.overflow; page.body.style.overflow = 'hidden';
    }
    overlay.hidden = false; say(null);
    const wanted = options.need && client.wallet?.features.find(f => f.key === options.need!.feature);
    need.hidden = !wanted;
    if (wanted && options.need) {
      need.innerHTML = `<b>${wanted.label} · ${options.need.cost} credits.</b> You have ${options.need.balance}. Pick a pack and you will be right back.`;
      session.set(wanted.key);
      const enough = client.wallet?.packs.find(p => p.total >= options.need!.cost - options.need!.balance && p.featured) ?? client.wallet?.packs[0];
      if (enough) selected = enough.id;
    } else if (options.view !== 'wait' && options.view !== 'done') session.set(null);
    render(client.wallet);
    show(options.view ?? 'shop');
    sheet.focus();
    if (!options.view || options.view === 'shop') void client.refresh().catch(e => say(creditErrorMessage(e)));
  }
  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    page.body.style.overflow = overflow;
    previousFocus?.focus();
  }

  async function startCheckout() {
    let wallet = client.wallet;
    if (!wallet || !selected || buying) return;
    if (wallet.account.required && wallet.account.anonymous) {
      // The email may have been confirmed from its link since this page loaded: read the account again first.
      buying = true; syncBuy();
      try { await platform.account.refresh(); wallet = await client.refresh() ?? wallet; } catch { /* still a guest */ }
      buying = false; syncBuy();
    }
    if (wallet.account.required && wallet.account.anonymous) {
      show('account');
      bindAccountStep({ section: views.account, account: platform.account, lifetime,
        verified: () => { void client.refresh().then(() => { show('shop'); void startCheckout(); }, e => { show('shop'); say(creditErrorMessage(e)); }); },
        back: () => show('shop') }).focus();
      return;
    }
    buying = true; syncBuy(); say(null);
    try { await client.checkout(selected); }
    catch (e) { buying = false; syncBuy(); say(creditErrorMessage(e), e instanceof CreditUserError ? e.reason : null); }
  }

  /** Back from checkout: wait for the payment to be confirmed (webhook or lookup), then celebrate. */
  async function confirmReturn(orderId: string) {
    open({ view: 'wait' });
    for (let attempt = 0; attempt < 40 && !disposed; attempt++) {
      try {
        const result = await client.confirm(orderId);
        if (result.status === 'paid' || result.status !== 'pending') {
          await client.refresh().catch(() => client.balance(result.balance));
          if (result.status === 'paid') celebrate(result.credits); else { show('shop'); say('This payment could not be completed. You were not charged for credits.'); }
          return;
        }
      } catch (e) { show('shop'); say(creditErrorMessage(e)); return; }
      await new Promise<void>(resolve => lifetime.timeout(() => resolve(), attempt < 10 ? 1500 : 4000));
    }
    show('shop');
    say('Your payment is still being confirmed by the bank. Your credits will appear here as soon as it completes.');
  }
  function celebrate(credits: number) {
    const resume = session.get(), next = resume ? resumers.get(resume) : undefined;
    session.set(null);
    $('.cr-done-title').textContent = `+${credits} credits`;
    $('.cr-done-copy').textContent = `They are in your wallet${client.wallet ? ', ' + client.wallet.balance + ' in total' : ''}. Thank you!`;
    const go = $<HTMLButtonElement>('.cr-done-go');
    go.hidden = !next; go.textContent = next?.label ?? '';
    go.onclick = next ? () => { close(); next.run(); } : null;
    $('.cr-done-close').classList.toggle('cr-primary', !next);
    $('.cr-done-close').classList.toggle('cr-quiet', !!next);
    show('done');
    sheet.classList.remove('cr-celebrate'); void sheet.offsetWidth; sheet.classList.add('cr-celebrate');
    (next ? go : $('.cr-done-close')).focus();
  }

  lifetime.listen(chip, 'click', () => { closeMenu(); open(); });
  lifetime.listen(overlay, 'mousedown', e => { if (e.target === overlay) close(); });
  lifetime.listen($('.cr-close'), 'click', close);
  lifetime.listen($('.cr-done-close'), 'click', close);
  lifetime.listen(buy, 'click', () => { void startCheckout(); });
  lifetime.listen(packs, 'click', e => { const card = (e.target as HTMLElement).closest<HTMLElement>('.cr-pack'); if (card?.dataset.pack) select(card.dataset.pack, true); });
  lifetime.listen(packs, 'keydown', event => {
    const e = event as KeyboardEvent, ids = client.wallet?.packs.map(p => p.id) ?? [];
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta || !ids.length) return;
    e.preventDefault();
    select(ids[(ids.indexOf(selected) + delta + ids.length) % ids.length]!, true);
  });
  lifetime.listen($('.cr-tabs'), 'click', e => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]')?.dataset.tab as View | undefined;
    if (tab) show(tab);
  });
  lifetime.listen(page, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => el.offsetParent !== null);
    const first = focusable[0], last = focusable.at(-1), active = dom.host.shadowRoot?.activeElement ?? page.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first?.focus(); }
  });
  const unsubscribe = client.subscribe(render);
  void client.refresh().catch(() => undefined);
  const back = platform.returned();
  if (back?.outcome === 'success') void confirmReturn(back.orderId);
  else if (back?.outcome === 'cancel') { session.set(null); toast('Checkout cancelled. You were not charged.'); }

  lifetime.cleanup(() => {
    chipLoading.stop(); packsLoading.stop(); checkoutLoading.stop(); waitLoading.stop();
    disposed = true; unsubscribe();
    if (!overlay.hidden) page.body.style.overflow = overflow;
    overlay.remove(); chip.remove();
  });
  const gate = bindCreditGate({ client, page, host: dom.$('#app'), lifetime, toast, openWallet: need => open({ need }) });
  return {
    client, open, close, ...gate,
    /** What to offer after a purchase that started from this feature ("Create your AI image"). */
    resume(feature: string, label: string, run: () => void) { resumers.set(feature, { label, run }); },
  };
}
export type CreditWalletApi = ReturnType<typeof bindCreditWallet>;
