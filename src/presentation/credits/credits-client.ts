import type { CreditWallet, OrderConfirmation, SpendReceipt } from '../../application/credits/credit-wallet';
import type { CreditsPlatform } from './credits.ports';
import { CreditUserError } from './credit-errors';

type Listener = (wallet: CreditWallet | null) => void;

/** The editor's view of the wallet: one copy of the balance that the chip, the wallet sheet and the paid actions share. */
export function createCreditsClient(platform: CreditsPlatform) {
  let wallet: CreditWallet | null = null, loading: Promise<CreditWallet | null> | null = null, available = true;
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach(listener => listener(wallet));

  async function headers(extra: Record<string, string> = {}) {
    const token = await platform.accessToken();
    return { ...extra, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  }
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, { ...init, headers: await headers(init.body ? { 'Content-Type': 'application/json' } : {}) });
    const body = await response.json().catch(() => null) as { error?: { code?: string; cost?: number; balance?: number } } | null;
    if (!response.ok) throw new CreditUserError(body?.error?.code, body?.error);
    return body as T;
  }

  function refresh(): Promise<CreditWallet | null> {
    loading ??= call<CreditWallet>('/api/credits').then(next => { wallet = next; available = true; return next; }, error => {
      // Credits not set up on this server: the editor shows no wallet rather than a broken one.
      if (error instanceof CreditUserError && error.code === 'CREDITS_UNAVAILABLE') { available = false; wallet = null; return null; }
      throw error;
    }).finally(() => { loading = null; notify(); });
    return loading;
  }
  /** A paid response reported the new balance: show it without another request. */
  function balance(next: number) {
    if (!wallet || wallet.balance === next) return;
    wallet = { ...wallet, balance: next };
    notify();
  }

  return {
    get wallet() { return wallet; },
    get available() { return available; },
    platform,
    refresh, balance, headers,
    subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    feature: (key: string) => wallet?.features.find(f => f.key === key) ?? null,
    /** An open pass for this feature on the current design. */
    pass(key: string) {
      const scope = platform.designId();
      return wallet?.passes.find(p => p.feature === key && p.scope === scope && Date.parse(p.expiresAt) > Date.now()) ?? null;
    },
    async checkout(pack: string) {
      const started = await call<{ orderId: string; url: string }>('/api/credits/checkout', {
        method: 'POST', body: JSON.stringify({ pack, returnTo: location.pathname }),
      });
      platform.redirect(started.url);
    },
    confirm: (orderId: string) => call<OrderConfirmation>('/api/credits/orders/' + encodeURIComponent(orderId)),
    async spend(feature: string, key: string) {
      const receipt = await call<SpendReceipt>('/api/credits/spend', { method: 'POST', body: JSON.stringify({ feature, key, scope: platform.designId() }) });
      await refresh().catch(() => balance(receipt.balance));
      return receipt;
    },
  };
}
export type CreditsClient = ReturnType<typeof createCreditsClient>;
