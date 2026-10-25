import type { CreditsClient } from './credits-client';
import { creditErrorMessage, CreditUserError } from './credit-errors';
import { coin } from './wallet-markup';
import type { WalletNeed } from './credit-wallet';

interface Ports {
  client: CreditsClient;
  page: Document;
  /** Where the confirmation card is shown. */
  host: HTMLElement;
  lifetime: { listen(target: EventTarget, event: string, handler: (e: Event) => void): void; cleanup(callback: () => void): void };
  toast(message: string): void;
  openWallet(need: WalletNeed): void;
}

/**
 * Paying for a feature that is final when used (technical drawings): free uses and open passes go straight through
 * with a short notice; a paid use asks first, on a small card with the price and the balance; too few credits open
 * the wallet on the packs.
 */
export function bindCreditGate({ client, page, host, lifetime, toast, openWallet }: Ports) {
  const card = page.createElement('div');
  card.className = 'cr-overlay cr-confirm'; card.hidden = true;
  card.innerHTML = '<div class="cr-sheet cr-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="cr-confirm-title" tabindex="-1">'
    + '<div class="cr-confirm-head"><span class="cr-confirm-icon">' + coin('lg') + '</span><div><h3 id="cr-confirm-title"></h3><p class="cr-confirm-copy"></p></div></div>'
    + '<button type="button" class="cr-primary cr-confirm-go"></button><button type="button" class="cr-quiet cr-confirm-cancel">Not now</button></div>';
  host.append(card);
  const title = card.querySelector<HTMLElement>('h3')!, copy = card.querySelector<HTMLElement>('.cr-confirm-copy')!;
  const go = card.querySelector<HTMLButtonElement>('.cr-confirm-go')!, cancel = card.querySelector<HTMLButtonElement>('.cr-confirm-cancel')!;
  let answer: ((yes: boolean) => void) | null = null;
  const finish = (yes: boolean) => { card.hidden = true; answer?.(yes); answer = null; };
  lifetime.listen(go, 'click', () => finish(true));
  lifetime.listen(cancel, 'click', () => finish(false));
  lifetime.listen(card, 'mousedown', e => { if (e.target === card) finish(false); });
  lifetime.listen(card, 'keydown', e => { if ((e as KeyboardEvent).key === 'Escape') { e.stopPropagation(); finish(false); } });
  lifetime.cleanup(() => { finish(false); card.remove(); });

  function ask(label: string, cost: number, balance: number, passHours: number): Promise<boolean> {
    title.textContent = `${label} · ${cost} credits`;
    copy.textContent = (passHours ? `Includes every change to this design for ${passHours} hours. ` : '') + `You have ${balance} credits; ${balance - cost} remain after.`;
    go.innerHTML = `<span>Use ${cost}</span>${coin()}<span>and open</span>`;
    card.hidden = false; go.focus();
    return new Promise(resolve => { answer = resolve; });
  }

  /** True when the person may use the feature now: it was free, covered by a pass, or paid for. */
  async function charge(key: string): Promise<boolean> {
    if (!client.wallet) await client.refresh().catch(() => null);
    const feature = client.feature(key), wallet = client.wallet;
    // Credits are not set up on this server: these features run in the browser, so they stay open.
    if (!client.available) return true;
    if (!feature || !wallet) { toast(creditErrorMessage(null)); return false; }
    const covered = client.pass(key) || feature.freeLeft > 0;
    if (!covered) {
      if (wallet.balance < feature.cost) { openWallet({ feature: key, cost: feature.cost, balance: wallet.balance }); return false; }
      if (!await ask(feature.label, feature.cost, wallet.balance, feature.passHours)) return false;
    }
    try {
      const receipt = await client.spend(key, crypto.randomUUID());
      if (receipt.charge === 'free') toast(`Your first ${feature.unit.one} is free.${feature.passHours ? ` Changes to this design stay free for ${feature.passHours} hours.` : ''}`);
      if (receipt.charge === 'paid') toast(`${receipt.cost} credits used. ${receipt.balance} left.`);
      return true;
    } catch (error) {
      if (error instanceof CreditUserError && error.code === 'INSUFFICIENT_CREDITS') {
        openWallet({ feature: key, cost: error.cost ?? feature.cost, balance: error.balance ?? wallet.balance });
      } else toast(creditErrorMessage(error));
      return false;
    }
  }

  /** Keeps a small price tag next to a menu item: "Free", "10 ◉" or "Open" while a pass lasts. */
  function badge(target: HTMLElement, key: string) {
    const tag = page.createElement('small');
    tag.className = 'cr-badge'; tag.hidden = true;
    target.append(tag);
    const sync = () => {
      const feature = client.feature(key);
      tag.hidden = !feature;
      if (!feature) return;
      const pass = client.pass(key);
      tag.dataset.kind = pass ? 'pass' : feature.freeLeft ? 'free' : 'paid';
      tag.innerHTML = pass ? 'Open' : feature.freeLeft ? 'Free' : `${feature.cost}${coin()}`;
    };
    const stop = client.subscribe(sync);
    lifetime.cleanup(stop);
    sync();
  }

  return { charge, badge };
}
