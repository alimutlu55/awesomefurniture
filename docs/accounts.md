# Accounts

Nobody needs an account to design. Every visitor starts as a guest (an anonymous Supabase identity) whose designs
are saved automatically. An account is needed for credits, and to see the same designs on another device or after
clearing the browser. The ⋮ menu always offers it: **Sign in / Sign up**, in the Account group at the end of the menu;
signed in, the same item shows the email and opens the account (sign out).

## What a person sees

- **Sign up**: Google, or an email and a password (8 characters at least) → a code by email → signed in.
- **Sign in**: Google, or email and password. Signing in before confirming the email sends a new code instead of
  failing. **Forgot your password?** emails a code; the code and a new password sign the person in.
- **Credits**: buying, an AI image or technical drawings as a guest opens the sheet with why ("Credits belong to
  your account…"). After signing in, the wallet reopens on the pack that was chosen.
- **Welcome**: after signing in, if the guest had designs or credits, a card says how many came along ("3 designs
  from this browser are now in your account, with 12 credits"). Otherwise a short notice says who is signed in.
- **Sign out on this device**: the page starts again as a new guest. The account's unsaved changes stay in this
  browser as its draft and are saved when it signs in again.

We store only the email (and Supabase's password hash). Google sign-in adds what Google sends to Supabase Auth
(name and picture in `auth.users`); the app reads only the email.

## How signing in keeps the guest's work

1. Right before any sign-in, the browser remembers the guest's session (`wardrobe:account:guest`,
   `src/infrastructure/account/guest-handover.ts`).
2. Signing in replaces the session and the page reloads (Google comes back through a redirect).
3. On start, before any design opens, `handOver` sends both tokens to `POST /api/account/merge`. The server checks
   both (the guest must be a guest, the account a permanent account) and calls `account_merge`
   (`supabase/migrations/20261025200000_account_merge.sql`): designs, credit balance (two `transfer` ledger
   rows), passes and free uses, open orders and follows move in one transaction. The browser drafts move too, so the
   design that was open opens again with its unsaved changes.
4. Merging is idempotent: a second tab, a retry or a replay moves nothing more. If the server cannot be reached the
   guest stays remembered and the next start tries again (the person sees "still being moved"). If the guest's
   session was revoked meanwhile, its designs stay with it and the person is told.

A design's owner still never changes from a browser: the ownership trigger allows it only under a flag set inside
`account_merge`, never as `anon` or `authenticated`. A transfer keeps the design's revision and dates, so an editor
that is open keeps saving.

Another tab signing in or out reloads every other tab (Supabase broadcasts the change), and background saving stops
the moment the identity changes, so no tab keeps saving as someone it no longer is.

## Code

| Concern | Place |
| --- | --- |
| Sheet, menu item, welcome; customer copy | `src/presentation/account/` (`account-sheet.ts`, `account-markup.ts`, `account-errors.ts`, `account.css`) |
| Supabase Auth calls, other-tab reloads | `src/app/account-platform.ts` (port: `account.ports.d.ts`) |
| Remember the guest, hand it over at start | `src/infrastructure/account/guest-handover.ts`, called by `src/app/session-bootstrap.ts` |
| Merge rules and endpoint | `src/application/account/account-merge.ts`, `src/infrastructure/account/account-http.ts` |
| Database | `account_merge` in the migration above; `supabase/tests/account_merge.sql` |
| Checks | `tests/architecture/accounts.test.ts`; `npm run check:accounts` (the sheet's flows in a browser) |

## Setting it up

The migration is applied to the project. Supabase Auth settings are in the dashboard
(https://supabase.com/dashboard/project/bcsdsuznpgnfyxzsaqzb/auth):

1. **SMTP** (Authentication → Emails → SMTP settings): a real sender such as Resend, Postmark or SES. The built-in
   sender allows only a few emails an hour, which is not enough for sign-ups.
2. **Email templates**: the sheet asks for the code, so each template must contain `{{ .Token }}`:
   *Confirm signup* and *Reset password* (and keep it in *Magic link* and *Change email address*).
3. **URL configuration**: add every address the editor runs on to *Redirect URLs*, with a wildcard so any page
   matches, for example `https://awesomefurniture.alimutlu535529.workers.dev/**`,
   `https://awesomefurniture-dev.alimutlu535529.workers.dev/**` and `http://localhost:5173/**`. A missing one
   sends people back to the Site URL (production) after Google or an email link.
4. **Google** (Authentication → Sign In / Providers → Google): create an OAuth client in Google Cloud Console
   (type *Web application*, authorised redirect URI `https://bcsdsuznpgnfyxzsaqzb.supabase.co/auth/v1/callback`),
   paste its client ID and secret, and turn it on. Until then the sheet hides the Google button.
5. **Passwords**: turn on leaked-password protection (Authentication → Policies) where the plan allows it.

Local development uses the same Supabase project. Without `SUPABASE_SECRET_KEY` in `.env.local` the merge
endpoint answers 503, so a sign-in there keeps the guest remembered and reports "still being moved".

## Known limits

- The sign-in flows were checked with a pretend platform (`npm run check:accounts`) and the merge against the
  database (`supabase/tests/account_merge.sql`); no real sign-up, email code or Google sign-in was made during
  development.
- An account cannot change its email or delete itself in the app yet.
- Guests whose designs were merged stay as empty anonymous users in `auth.users`; define a retention for
  anonymous identities before growing usage.
- Signing out keeps the account's browser drafts in this browser (readable only by that account in the app).
