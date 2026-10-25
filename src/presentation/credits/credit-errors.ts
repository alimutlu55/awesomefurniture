const fallback = 'Credits are temporarily unavailable. Please try again.';

/** Customer copy for credit errors is owned here; server messages never become UI text. */
function customerMessage(code: unknown): string {
  switch (code) {
    case 'INSUFFICIENT_CREDITS': return 'You need a few more credits for this.';
    case 'ACCOUNT_REQUIRED': return 'Create a free account or sign in first: credits belong to your account.';
    case 'SIGN_IN_REQUIRED': return 'Your session has ended. Reload the page and try again.';
    case 'RATE_LIMITED': return 'You started many checkouts in the last hour. Please wait a little and try again.';
    case 'ORDER_NOT_FOUND': return 'We could not find this purchase. If you were charged, your credits will arrive shortly.';
    case 'CHECKOUT_FAILED': return 'We could not open the payment page. Please try again in a moment.';
    case 'UNKNOWN_PACK':
    case 'UNKNOWN_PROVIDER': return 'This option is no longer available. Reload the page and try again.';
    default: return fallback;
  }
}

export class CreditUserError extends Error {
  readonly cost: number | null;
  readonly balance: number | null;
  /** A short code for support, such as the payment provider's error code. */
  readonly reason: string | null;
  constructor(readonly code: string | undefined, detail?: { cost?: number; balance?: number; reason?: string } | null) {
    super(customerMessage(code));
    this.cost = typeof detail?.cost === 'number' ? detail.cost : null;
    this.balance = typeof detail?.balance === 'number' ? detail.balance : null;
    this.reason = typeof detail?.reason === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(detail.reason) ? detail.reason : null;
  }
}

export const creditErrorMessage = (error: unknown) => error instanceof CreditUserError ? error.message : fallback;
