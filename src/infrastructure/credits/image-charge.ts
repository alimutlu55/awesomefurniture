import { CreditError } from '../../application/credits/credit-service';
import type { CreditRuntime } from './credit-environment';
import { safeError } from '../http/safe-error';

export interface ChargeHold {
  /** `test`: the in-memory ledger of local development (credit-environment.ts). */
  readonly mode: 'live' | 'test';
  readonly balance: number;
  readonly cost: number;
  /** The result was delivered: keep the credits, with the provider's usage for the margin report. */
  commit(usage?: Readonly<Record<string, number>>): Promise<void>;
  /** The result failed or was cancelled: give the credits back. */
  refund(reason: string): Promise<void>;
}
/** Charges one use of a feature whose result can fail. `begin` throws CreditError when it cannot be paid for. */
export interface FeatureCharge {
  authorize(request: Request): Promise<string>;
  begin(request: Request): Promise<ChargeHold>;
}

const KEY = /^[A-Za-z0-9:_-]{8,200}$/;

/** Settling never fails the response the person is waiting for: a reservation left open is released by the schedule. */
async function settle(work: () => Promise<void>, event: string, spendId: string) {
  try { await work(); } catch (error) {
    console.error(JSON.stringify({ event, spendId, error: safeError(error) }));
  }
}

/** Reserves the AI image price before the provider is called. Without a credit runtime nothing is generated. */
export function featureCharge(runtime: CreditRuntime | null, feature: string): FeatureCharge {
  const users = new WeakMap<Request, NonNullable<Awaited<ReturnType<CreditRuntime['authenticate']>>>>();
  const authorize = async (request: Request) => {
    if (!runtime) throw new CreditError('CREDITS_UNAVAILABLE', 'Credits are temporarily unavailable. Please try again later.');
    const user = users.get(request) ?? await runtime.authenticate(request);
    if (!user) throw new CreditError('SIGN_IN_REQUIRED', 'Your session has ended. Reload the page and try again.');
    if (user.anonymous) throw new CreditError('ACCOUNT_REQUIRED', 'Sign in to generate an image.');
    users.set(request, user);
    return user.id;
  };
  return {
    authorize,
    async begin(request) {
      await authorize(request);
      const user = users.get(request)!;
      const header = request.headers.get('idempotency-key');
      const key = header && KEY.test(header) ? header : crypto.randomUUID();
      const held = await runtime!.service.reserve(user, feature, key);
      // The same attempt arriving twice (a retried request) must not run the provider twice.
      if (held.replay) throw new CreditError('INVALID_REQUEST', 'This request was already received.');
      const spendId = held.spendId!;
      return {
        mode: runtime!.mode, balance: held.balance, cost: held.cost,
        commit: usage => settle(() => runtime!.service.settle(spendId, 'captured', usage), 'credit_capture_failed', spendId),
        refund: reason => settle(() => runtime!.service.settle(spendId, 'released', { reason }), 'credit_release_failed', spendId),
      };
    },
  };
}
