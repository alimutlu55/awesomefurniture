import type { CreditWallet } from '../../application/credits/credit-wallet';

type Pack = CreditWallet['packs'][number];
type Feature = CreditWallet['features'][number];

const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const coin = (size = '') => `<i class="cr-coin${size ? ' cr-coin--' + size : ''}" aria-hidden="true"></i>`;
export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"/></svg>';
const ICONS: Record<string, string> = {
  sparkle: '<path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2Z"/>',
  sheet: '<path d="M4 4h16v16H4zM4 15h5v5M9 4v6h6M15 10v10"/>',
  purchase: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
};
export const icon = (key: string) => `<svg class="cr-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] ?? ICONS.purchase}</svg>`;

/** "30 AI images" */
const uses = (credits: number, f: Feature) => plural(Math.floor(credits / f.cost), f.unit.one, f.unit.many);
/** "30 AI images or 12 drawing sets": what a number of credits buys, for the hero. */
export const worth = (credits: number, features: readonly Feature[]) => features.map(f => uses(credits, f)).join(' or ');

/** The sheet: hero balance, the shop, the email step, activity, and the confirming and celebration states. */
export function walletShell() {
  return '<div class="cr-sheet" role="dialog" aria-modal="true" aria-labelledby="cr-title" tabindex="-1" data-view="shop">'
    + `<button type="button" class="cr-close" aria-label="Close credits">${CLOSE}</button>`
    + '<header class="cr-hero"><div class="cr-hero-coin">' + coin('xl') + '<span class="cr-hero-glow"></span></div>'
    + '<div class="cr-hero-copy"><p class="cr-eyebrow">Your credits</p>'
    + '<h2 id="cr-title"><span class="cr-balance">0</span><small> credits</small></h2><p class="cr-worth"></p></div></header>'
    + '<p class="cr-need" role="status" hidden></p>'
    + '<div class="cr-tabs" role="tablist" aria-label="Credits"><button type="button" role="tab" data-tab="shop" aria-selected="true">Buy credits</button>'
    + '<button type="button" role="tab" data-tab="activity" aria-selected="false">Activity</button></div>'
    + '<section class="cr-shop" role="tabpanel"><div class="cr-packs" role="radiogroup" aria-label="Credit packs"></div>'
    + '<div class="cr-uses"></div><p class="cr-error" role="alert" hidden></p>'
    + '<button type="button" class="cr-primary cr-buy"><span>Continue</span></button>'
    + `<p class="cr-secure">${LOCK}<span>Secure checkout · Cards, Apple Pay and Google Pay. Credits never expire.</span></p></section>`
    + '<section class="cr-account" hidden></section>'
    + '<section class="cr-activity" role="tabpanel" hidden></section>'
    + '<section class="cr-wait" hidden><h3>Confirming your payment</h3>'
    + '<p>This takes a few seconds. You can keep this open.</p></section>'
    + '<section class="cr-done" hidden><div class="cr-burst" aria-hidden="true">'
    + Array.from({ length: 14 }, (_, i) => `<i class="cr-coin cr-spark" style="--a:${i * (360 / 14)}deg;--d:${70 + (i % 3) * 26}px;--t:${i % 4 * 40}ms"></i>`).join('')
    + coin('hero') + '</div><h3 class="cr-done-title"></h3><p class="cr-done-copy"></p>'
    + '<button type="button" class="cr-primary cr-done-go"></button><button type="button" class="cr-quiet cr-done-close">Continue designing</button></section>'
    + '</div>';
}

export function packCards(packs: readonly Pack[], features: readonly Feature[], selected: string) {
  // A pack card counts its credits in the first feature of the catalog, the one most people buy for.
  const headline = features[0];
  return packs.map((p, i) => {
    const on = p.id === selected;
    return `<button type="button" role="radio" class="cr-pack${p.featured ? ' cr-pack--featured' : ''}" data-pack="${escape(p.id)}" aria-checked="${on}" tabindex="${on ? 0 : -1}">`
      + (p.featured ? '<span class="cr-ribbon">Most popular</span>' : '')
      + `<span class="cr-stack" style="--n:${i + 1}">${Array.from({ length: i + 1 }, () => coin()).join('')}</span>`
      + `<span class="cr-pack-name">${escape(p.label)}</span>`
      + `<span class="cr-pack-credits"><b>${p.total}</b> credits</span>`
      + (p.bonus ? `<span class="cr-bonus">+${p.bonus} bonus</span>` : '<span class="cr-bonus cr-bonus--none"></span>')
      + (headline ? `<span class="cr-pack-uses">${uses(p.total, headline)}</span>` : '')
      + `<span class="cr-pack-foot"><span class="cr-pack-price">${money(p.price, p.currency)}</span>`
      + (p.saving ? `<span class="cr-save">Save ${p.saving}%</span>` : '') + '</span></button>';
  }).join('');
}

/** What each paid feature costs, with its free uses and passes. */
export function featureList(features: readonly Feature[]) {
  return '<h3 class="cr-subtitle">What credits buy</h3><ul>' + features.map(f => `<li>${icon(f.icon)}<span><b>${escape(f.label)}</b>`
    + `<small>${escape(f.freeLeft ? `Your first ${f.freeLeft === 1 ? 'one is' : f.freeLeft + ' are'} free. ` : '')}${escape(f.description)}</small></span>`
    + `<span class="cr-price">${f.cost}${coin()}</span></li>`).join('') + '</ul>';
}

const day = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function activityList(wallet: CreditWallet) {
  if (!wallet.history.length) {
    return `<div class="cr-empty">${coin('lg')}<p>No activity yet.</p><small>Purchases, images and drawings you use credits for appear here.</small></div>`;
  }
  const feature = (key: string | null) => wallet.features.find(f => f.key === key);
  const label = (key: string | null) => feature(key)?.label ?? 'Credits';
  return '<ol class="cr-ledger">' + wallet.history.map(e => {
    const title = e.kind === 'spend' ? label(e.feature) : e.kind === 'refund' ? `Refunded · ${label(e.feature)}` : e.description;
    const kind = e.kind === 'spend' ? feature(e.feature)?.icon ?? 'purchase' : e.kind === 'refund' || e.kind === 'reversal' ? 'back' : 'purchase';
    return `<li class="cr-entry cr-entry--${e.delta > 0 ? 'in' : 'out'}">${icon(kind)}<span><b>${escape(title)}</b><small>${day(e.createdAt)}</small></span>`
      + `<span class="cr-delta">${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)}</span></li>`;
  }).join('') + '</ol>';
}

export function accountStep(email: string | null) {
  return `<div class="cr-account-head">${coin('lg')}<div><h3>Keep your credits safe</h3>`
    + '<p>Credits belong to your account. Add your email once: they stay yours if this browser is cleared, and you can use them on your phone and computer.</p></div></div>'
    + '<form class="cr-email-form" novalidate><label class="cr-field"><span>Email</span>'
    + `<input type="email" name="email" autocomplete="email" inputmode="email" required value="${escape(email ?? '')}" placeholder="you@example.com"></label>`
    + '<button type="submit" class="cr-primary">Email me a code</button>'
    + '<button type="button" class="cr-quiet cr-confirmed">I already confirmed my email</button></form>'
    + '<form class="cr-code-form" novalidate hidden><p class="cr-code-note"></p><label class="cr-field"><span>Code</span>'
    + '<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required placeholder="12345678"></label>'
    + '<button type="submit" class="cr-primary">Verify and continue</button><button type="button" class="cr-quiet cr-other-email">Use another email</button></form>'
    + '<p class="cr-error" role="alert" hidden></p><button type="button" class="cr-quiet cr-account-back">Back to packs</button>';
}
