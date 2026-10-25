const unavailable = 'Image generation is temporarily unavailable. Please try again later.';

/** Customer copy is owned here. API and provider messages must never become UI text. */
function customerMessage(code: unknown): string {
  switch (code) {
    case 'RATE_LIMITED': return 'Please wait a minute before creating another image.';
    case 'TIMEOUT': return 'Creating your image is taking longer than expected. Please try again.';
    case 'TOO_LARGE': return 'This design is too large to create an image. Try a smaller design.';
    case 'EMPTY_DESIGN': return 'Add furniture to your design before creating an image.';
    case 'INSUFFICIENT_CREDITS': return 'You need a few more credits to create this image.';
    case 'SIGN_IN_REQUIRED': return 'Your session has ended. Reload the page and try again.';
    case 'ACCOUNT_REQUIRED': return 'Sign up or sign in to create AI images.';
    case 'CAPTURE_FAILED': return 'We couldn’t prepare the design views. Please try again.';
    case 'NO_IMAGE':
    case 'PROVIDER_ERROR':
    case 'GENERATION_FAILED': return 'We couldn’t create your image. Please try again.';
    default: return unavailable;
  }
}

export class DesignImageUserError extends Error {
  readonly code: string | null;
  /** When short of credits: what the image costs and what the wallet holds. */
  readonly credits: { cost: number; balance: number } | null;
  constructor(code: unknown, detail?: { cost?: unknown; balance?: unknown } | null) {
    super(customerMessage(code));
    this.code = typeof code === 'string' ? code : null;
    this.credits = typeof detail?.cost === 'number' && typeof detail.balance === 'number' ? { cost: detail.cost, balance: detail.balance } : null;
  }
}

export function designImageErrorMessage(error: unknown): string {
  if (error instanceof DesignImageUserError) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return customerMessage('TIMEOUT');
  return unavailable;
}
