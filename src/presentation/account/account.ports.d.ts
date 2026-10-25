/**
 * What the app gives the editor so a guest can create an account or sign in (src/app/account-platform.ts). Every call
 * that changes who is signed in reloads the page when it succeeds; the guest's designs and credits come along.
 */
export interface AccountPlatform {
  /** The signed-in account's email; null for a guest. */
  email(): string | null;
  signIn(email: string, password: string): Promise<void>;
  /** `confirm`: a code was emailed to finish creating the account. */
  signUp(email: string, password: string): Promise<'confirm'>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendSignUp(email: string): Promise<void>;
  /** The social sign-ins turned on for this project ('google'); the sheet offers only these. */
  providers(): Promise<readonly string[]>;
  /** Leaves for Google's sign-in page and comes back signed in. */
  google(): Promise<void>;
  /** Emails a code for choosing a new password. */
  sendReset(email: string): Promise<void>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Read once at start: who just signed in and what came along from this browser. */
  welcome(): AccountWelcome | null;
}

export interface AccountWelcome {
  readonly email: string;
  /** Designs and credits moved from this browser's guest session. */
  readonly designs: number;
  readonly credits: number;
}
