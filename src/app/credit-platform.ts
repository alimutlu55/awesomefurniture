import type { CreditsPlatform } from '../presentation/credits/credits.ports';
import type { SessionPlatform } from './session-bootstrap';

export interface CheckoutReturn { orderId: string; outcome: 'success' | 'cancel' }

/** Reads `?checkout=success&order=…` once and takes it out of the address, so a reload never confirms twice. */
export function takeCheckoutReturn(url: URL, history: Pick<History, 'replaceState'>): CheckoutReturn | null {
  const outcome = url.searchParams.get('checkout'), orderId = url.searchParams.get('order');
  if (!outcome && !orderId) return null;
  const clean = new URL(url); clean.searchParams.delete('checkout'); clean.searchParams.delete('order');
  history.replaceState(null, '', clean);
  return (outcome === 'success' || outcome === 'cancel') && orderId && /^[0-9a-f-]{36}$/.test(orderId) ? { orderId, outcome } : null;
}

interface Workspace {
  /** The open design's id, for passes. */
  designId(): string | null;
}

/**
 * Credits for the editor, from the Supabase session the app already holds. Buying and using credits needs an account
 * (src/app/account-platform.ts); a guest sees the balance and the packs.
 */
export function createCreditPlatform(platform: SessionPlatform, workspace: Workspace, checkout: CheckoutReturn | null): CreditsPlatform | undefined {
  const { client } = platform;
  if (!client) return undefined;
  let returned = checkout;
  return {
    async accessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
    designId: workspace.designId,
    redirect(url) { location.assign(url); },
    returned() { const value = returned; returned = null; return value; },
  };
}
