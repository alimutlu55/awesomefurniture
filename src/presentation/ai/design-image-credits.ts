import type { DesignImageResponse } from '../../application/projects/design-image';
import type { CreditFeatureKey } from '../../domain/credits/credit-catalog';
import type { CreditWalletApi } from '../credits/credit-wallet';
import { coin } from '../credits/wallet-markup';
import { DesignImageUserError } from './design-image-errors';

const FEATURE: CreditFeatureKey = 'ai-image';

interface Ports {
  credits: CreditWalletApi | null;
  /** The dialog whose `.ai-cost` tags show the price. */
  dialog: HTMLElement;
  lifetime: { cleanup(callback: () => void): void };
  /** Opens the image dialog again after a purchase that started from it. */
  reopen(): void;
}

/** How the AI image dialog pays: its price on the buttons, the wallet when short, and the balance after each image. */
export function bindImageCredits({ credits, dialog, lifetime, reopen }: Ports) {
  const sync = () => {
    const feature = credits?.client.feature(FEATURE);
    dialog.querySelectorAll<HTMLElement>('.ai-cost').forEach(tag => {
      tag.hidden = !feature;
      if (feature) tag.innerHTML = feature.cost + coin();
    });
  };
  if (credits) {
    lifetime.cleanup(credits.client.subscribe(sync));
    credits.resume(FEATURE, 'Create your AI image', reopen);
  }
  const need = (cost: number, balance: number) => credits?.open({ need: { feature: FEATURE, cost, balance } });
  return {
    /** True when it cannot run now: a guest is asked to sign in, and a short wallet opens on the packs. */
    short() {
      if (credits?.needsAccount()) return true;
      const feature = credits?.client.feature(FEATURE), wallet = credits?.client.wallet;
      if (!feature || !wallet || wallet.balance >= feature.cost) return false;
      need(feature.cost, wallet.balance);
      return true;
    },
    /** One idempotency key per attempt: a retried request is never charged twice. */
    headers: async () => credits ? credits.client.headers({ 'Idempotency-Key': crypto.randomUUID() }) : {},
    paid(output: DesignImageResponse) { if (output.credits) credits?.client.balance(output.credits.balance); },
    /** True when the server refused for lack of credits or of an account: the wallet or sign-in opens, no error shows. */
    refused(error: unknown) {
      if (credits && error instanceof DesignImageUserError && error.code === 'ACCOUNT_REQUIRED') return credits.needsAccount();
      if (!credits || !(error instanceof DesignImageUserError) || error.code !== 'INSUFFICIENT_CREDITS') return false;
      const fallback = { cost: credits.client.feature(FEATURE)?.cost ?? 0, balance: 0 };
      const { cost, balance } = error.credits ?? fallback;
      need(cost, balance);
      void credits.client.refresh().catch(() => undefined);
      return true;
    },
  };
}
