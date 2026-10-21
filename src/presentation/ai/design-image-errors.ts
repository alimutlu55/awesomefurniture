const unavailable = 'Image generation is temporarily unavailable. Please try again later.';

/** Customer copy is owned here. API and provider messages must never become UI text. */
function customerMessage(code: unknown): string {
  switch (code) {
    case 'RATE_LIMITED': return 'Please wait a minute before creating another image.';
    case 'TIMEOUT': return 'Creating your image is taking longer than expected. Please try again.';
    case 'TOO_LARGE': return 'This design is too large to create an image. Try a smaller design.';
    case 'EMPTY_DESIGN': return 'Add furniture to your design before creating an image.';
    case 'CAPTURE_FAILED': return 'We couldn’t prepare the design views. Please try again.';
    case 'NO_IMAGE':
    case 'PROVIDER_ERROR':
    case 'GENERATION_FAILED': return 'We couldn’t create your image. Please try again.';
    default: return unavailable;
  }
}

export class DesignImageUserError extends Error {
  constructor(code: unknown) { super(customerMessage(code)); }
}

export function designImageErrorMessage(error: unknown): string {
  if (error instanceof DesignImageUserError) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return customerMessage('TIMEOUT');
  return unavailable;
}
