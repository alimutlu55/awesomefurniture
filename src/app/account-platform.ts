import type { AccountPlatform, AccountWelcome } from '../presentation/account/account.ports';
import { rememberGuest } from '../infrastructure/account/guest-handover';
import { forgetDrafts } from '../infrastructure/persistence/browser-drafts';
import { resolveSupabaseProject } from '../infrastructure/supabase/project-config';
import type { SessionPlatform } from './session-bootstrap';

const SIGNED_IN = 'wardrobe:account:signed-in';
const marker = {
  set() { try { sessionStorage.setItem(SIGNED_IN, '1'); } catch { /* private mode: no welcome, nothing else lost */ } },
  take() { try { const value = sessionStorage.getItem(SIGNED_IN); sessionStorage.removeItem(SIGNED_IN); return value === '1'; } catch { return false; } },
};

/**
 * Accounts for the editor, on the Supabase session the app already holds. Designing needs none: every visitor starts
 * as a guest. Signing in or creating an account remembers the guest first, and the next start moves the guest's
 * designs and credits into the account (src/infrastructure/account/guest-handover.ts) before any design opens.
 */
export function createAccountPlatform(platform: SessionPlatform, workspace: { save(): Promise<boolean> }): AccountPlatform | undefined {
  const { client, user } = platform;
  if (!client) return undefined;
  const auth = client.auth;
  const email = user && !user.is_anonymous ? user.email ?? null : null;
  const merged = platform.handover.status === 'merged' ? platform.handover : null;
  let welcome: AccountWelcome | null = email && (marker.take() || merged)
    ? { email, designs: merged?.designs ?? 0, credits: merged?.credits ?? 0 } : null;
  // Set while this tab changes who is signed in: it reloads itself once done. Any other change (another tab signed
  // in or out) reloads this one, so it never keeps saving as someone it no longer is.
  let changing = false;
  auth.onAuthStateChange((_event, session) => {
    if (!changing && user && (session?.user.id ?? null) !== user.id) setTimeout(() => location.reload(), 0);
  });

  const fail = (error: unknown): never => { changing = false; throw error; };
  /** A reset code is used once: after it was accepted, a retry only sets the password (the person is signed in by then). */
  let resetVerified: string | null = null;
  /** Signs in (the work), then reloads: the next start moves the guest into the account. */
  async function signInWith(work: () => Promise<{ error: unknown }>) {
    changing = true;
    await rememberGuest(client!, localStorage).catch(() => undefined);
    const { error } = await work().catch((e: unknown) => ({ error: e }));
    if (error) fail(error);
    marker.set();
    location.reload();
    return new Promise<never>(() => { /* the page is reloading */ });
  }

  let providers: Promise<readonly string[]> | null = null;
  return {
    email: () => email,
    // A provider that is not turned on in Supabase would end on its error page: ask Auth's public settings first.
    providers() {
      const project = resolveSupabaseProject(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      providers ??= fetch(`${project.url}/auth/v1/settings`, { headers: { apikey: project.publishableKey } })
        .then(response => response.ok ? response.json() as Promise<{ external?: Record<string, unknown> }> : null)
        .then(settings => settings?.external?.google === true ? ['google'] : [], () => []);
      return providers;
    },
    welcome() { const value = welcome; welcome = null; return value; },
    signIn: (address, password) => signInWith(() => auth.signInWithPassword({ email: address, password })),
    async signUp(address, password) {
      // Remembered first: a project that confirms new accounts at once signs in within signUp itself.
      changing = true;
      await rememberGuest(client, localStorage).catch(() => undefined);
      const { data, error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: location.href } })
        .catch((e: unknown) => ({ data: null, error: e }));
      if (error) fail(error);
      // An email that already has an account gets no new one (and no email): Supabase answers without identities.
      if (data?.user && data.user.identities?.length === 0) fail(Object.assign(new Error('Email exists.'), { code: 'user_already_exists' }));
      if (data?.session) await signInWith(async () => ({ error: null }));
      changing = false;
      return 'confirm';
    },
    confirmSignUp: (address, code) => signInWith(() => auth.verifyOtp({ email: address, token: code, type: 'email' })),
    async resendSignUp(address) {
      const { error } = await auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: location.href } });
      if (error) throw error;
    },
    async google() {
      changing = true;
      await rememberGuest(client, localStorage).catch(() => undefined);
      marker.set();
      // Supabase leaves for Google at once; the person comes back to this page, signed in.
      const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
      if (error) fail(error);
    },
    async sendReset(address) {
      const { error } = await auth.resetPasswordForEmail(address, { redirectTo: location.href });
      if (error) throw error;
    },
    resetPassword: (address, code, password) => signInWith(async () => {
      if (resetVerified !== address) {
        const verified = await auth.verifyOtp({ email: address, token: code, type: 'recovery' });
        if (verified.error) return verified;
        resetVerified = address;
      }
      return auth.updateUser({ password });
    }),
    async signOut() {
      changing = true;
      // Designs belong to their owner: nothing stays in this browser. So the open design is saved to the account first,
      // and a design that could not be saved stops the sign-out instead of being lost.
      if (!await workspace.save().catch(() => false)) fail(Object.assign(new Error('Unsaved changes.'), { code: 'unsaved_changes' }));
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) fail(error);
      if (user) forgetDrafts(localStorage, user.id);
      try { ['wardrobe:credits:resume', 'wardrobe:credits:after-sign-in', 'wardrobe:credits:confirming', SIGNED_IN].forEach(key => sessionStorage.removeItem(key)); }
      catch { /* private mode: nothing was kept */ }
      location.reload();
      return new Promise<never>(() => { /* the page is reloading */ });
    },
  };
}
