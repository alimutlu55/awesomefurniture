/** A person proven by an access token (src/infrastructure/supabase/server-identity.ts). A guest has no email. */
export interface Identity {
  readonly id: string;
  readonly anonymous: boolean;
  readonly email: string | null;
}

/** What moved from the guest to the account: designs (not deleted) and the credit balance. */
export interface MergeResult {
  readonly designs: number;
  readonly credits: number;
}

/** Moves everything a guest owns to an account, once (supabase/migrations/*_account_merge.sql). */
export interface AccountStore {
  merge(guestId: string, accountId: string): Promise<MergeResult>;
}

export type AccountErrorCode = 'SIGN_IN_REQUIRED' | 'GUEST_REQUIRED' | 'INVALID_REQUEST' | 'ACCOUNTS_UNAVAILABLE';

/** A merge the server refuses; the code is what the browser acts on. */
export class AccountError extends Error {
  constructor(readonly code: AccountErrorCode, message: string) { super(message); }
}

/**
 * Signing in keeps what the person made as a guest in this browser. Both identities must be proven: the account by
 * the request's own token, the guest by the token the browser held before signing in.
 */
export async function mergeGuest(store: AccountStore, account: Identity | null, guest: Identity | null): Promise<MergeResult> {
  if (!account || account.anonymous) throw new AccountError('SIGN_IN_REQUIRED', 'Sign in to your account first.');
  if (!guest || !guest.anonymous) throw new AccountError('GUEST_REQUIRED', 'The guest session could not be verified.');
  if (guest.id === account.id) return { designs: 0, credits: 0 };
  return store.merge(guest.id, account.id);
}
