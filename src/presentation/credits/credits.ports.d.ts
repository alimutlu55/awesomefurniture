/** What the app gives the editor so it can show and use credits (src/app/credit-platform.ts). */
export interface CreditsPlatform {
  /** The signed-in person's access token (a guest identity has one too), or null when there is no session. */
  accessToken(): Promise<string | null>;
  /** The design that open passes belong to (technical drawings stay free for it for 24 hours). */
  designId(): string | null;
  /** Leaves for a hosted checkout. The design is saved as a browser draft on the way out. */
  redirect(url: string): void;
  /** A checkout that just sent the person back to the editor, read once at start. */
  returned(): { orderId: string; outcome: 'success' | 'cancel' } | null;
  account: CreditAccount;
}

export interface CreditAccount {
  /** The email of a verified account, or null for a guest. */
  email(): string | null;
  /** Emails a code. `link` keeps this guest's designs and credits under the email; `sign-in` opens an existing account. */
  sendCode(email: string): Promise<'link' | 'sign-in'>;
  /** Checks the code. After `sign-in` the page reloads into that account, with this design copied into it. */
  verify(email: string, code: string, mode: 'link' | 'sign-in'): Promise<void>;
}
