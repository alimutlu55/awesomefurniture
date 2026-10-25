const fallback = 'Credits are temporarily unavailable. Please try again.';

/** Customer copy for credit errors is owned here; server messages never become UI text. */
function customerMessage(code: unknown): string {
  switch (code) {
    case 'INSUFFICIENT_CREDITS': return 'You need a few more credits for this.';
    case 'ACCOUNT_REQUIRED': return 'Add your email first, so your credits are safe on every device.';
    case 'SIGN_IN_REQUIRED': return 'Your session has ended. Reload the page and try again.';
    case 'RATE_LIMITED': return 'Too many checkouts were started. Please wait a little and try again.';
    case 'ORDER_NOT_FOUND': return 'We could not find this purchase. If you were charged, your credits will arrive shortly.';
    case 'UNKNOWN_PACK':
    case 'UNKNOWN_PROVIDER': return 'This option is no longer available. Reload the page and try again.';
    default: return fallback;
  }
}

export class CreditUserError extends Error {
  readonly cost: number | null;
  readonly balance: number | null;
  constructor(readonly code: string | undefined, detail?: { cost?: number; balance?: number } | null) {
    super(customerMessage(code));
    this.cost = typeof detail?.cost === 'number' ? detail.cost : null;
    this.balance = typeof detail?.balance === 'number' ? detail.balance : null;
  }
}

export const creditErrorMessage = (error: unknown) => error instanceof CreditUserError ? error.message : fallback;
