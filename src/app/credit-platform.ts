import type { CreditsPlatform } from '../presentation/credits/credits.ports';
import type { ProjectDocument } from '../domain/project/project';
import { createBrowserDrafts } from '../infrastructure/persistence/browser-drafts';
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
  /** The open design as it stands, to carry into an account the person signs in to. */
  document(): ProjectDocument | null;
}

/**
 * Credits for the editor, from the Supabase session the app already holds: every visitor has an identity (a guest
 * one at first), so the balance works from the first visit. Adding an email keeps the same identity, with its designs
 * and credits; signing in to an existing account switches to it and brings the open design along.
 */
export function createCreditPlatform(platform: SessionPlatform, workspace: Workspace, checkout: CheckoutReturn | null): CreditsPlatform | undefined {
  const { client } = platform;
  if (!client) return undefined;
  let email = platform.user && !platform.user.is_anonymous ? platform.user.email ?? null : null, returned = checkout;
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    email = user && !user.is_anonymous ? user.email ?? null : null;
  });
  return {
    async accessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
    designId: workspace.designId,
    redirect(url) { location.assign(url); },
    returned() { const value = returned; returned = null; return value; },
    account: {
      email: () => email,
      async refresh() {
        const { error } = await client.auth.refreshSession();
        if (error) throw error;
      },
      async sendCode(address) {
        const linked = await client.auth.updateUser({ email: address });
        if (!linked.error) return 'link';
        if (linked.error.code !== 'email_exists') throw linked.error;
        const signIn = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
        if (signIn.error) throw signIn.error;
        return 'sign-in';
      },
      async verify(address, token, mode) {
        if (mode === 'link') {
          const { error } = await client.auth.verifyOtp({ email: address, token, type: 'email_change' });
          if (error) throw error;
          // The new token says the account has an email, which buying needs.
          await client.auth.refreshSession();
          return;
        }
        const document = workspace.document();
        const { data, error } = await client.auth.verifyOtp({ email: address, token, type: 'email' });
        if (error || !data.user) throw error ?? new Error('Sign-in failed.');
        if (document) {
          createBrowserDrafts(localStorage, data.user.id).write({
            document: { ...document, id: crypto.randomUUID(), name: document.name.slice(0, 113) + ' · Copy' }, expectedRevision: null,
          });
        }
        location.reload();
      },
    },
  };
}
