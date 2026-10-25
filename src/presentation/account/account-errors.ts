const fallback = 'Something went wrong. Please try again.';

/** Customer copy for sign-in errors is owned here; Supabase's messages never become UI text. */
export function accountErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'invalid_credentials': return 'That email and password do not match. Check them, or reset your password.';
    case 'user_already_exists':
    case 'email_exists': return 'This email already has an account. Sign in instead.';
    case 'weak_password': return 'Choose a stronger password: at least 8 characters, not a common one.';
    case 'same_password': return 'Choose a password you have not used here before.';
    case 'otp_expired': return 'That code is wrong or has expired. Check it, or ask for a new one.';
    case 'email_address_invalid':
    case 'validation_failed': return 'Enter a valid email address.';
    case 'over_email_send_rate_limit': return 'Too many emails were sent just now. Wait a minute and try again.';
    case 'over_request_rate_limit': return 'Too many attempts. Wait a minute and try again.';
    case 'adopt_failed': return 'We could not add your earlier work just now. Nothing was moved. Try again in a moment.';
    case 'unsaved_changes': return 'Your latest changes could not be saved to your account yet, so you were not signed out. Check your connection and try again.';
    case 'provider_disabled': return 'Google sign-in is not available yet. Use your email instead.';
    case 'signup_disabled': return 'New accounts cannot be created right now. Please try again later.';
    default:
      return error instanceof Error && /fetch|network/i.test(error.name + error.message)
        ? 'You seem to be offline. Check your connection and try again.' : fallback;
  }
}

/** Signing in before the email was confirmed: the sheet asks for the code instead of showing an error. */
export const needsConfirmation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'email_not_confirmed';
