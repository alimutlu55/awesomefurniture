# Accounts

Nobody needs an account to design. Every visitor starts as a guest (an anonymous Supabase identity) whose designs
are saved automatically. An account is needed for credits, and to see the same designs on another device or after
clearing the browser. The ⋮ menu always offers it: **Sign in / Sign up**, in the Account group at the end of the menu;
signed in, the same item is just **Sign out** (no account page in between).

## What a person sees

- **Sign up**: Google, or an email and a password (8 characters at least) → a code by email → signed in.
- **Sign in**: Google, or email and password. Signing in before confirming the email sends a new code instead of
  failing. **Forgot your password?** emails a code; the code and a new password sign the person in.
- **Credits**: buying, an AI image or technical drawings as a guest opens the sheet with why ("Credits belong to
  your account…"). After signing in, the wallet reopens on the pack that was chosen.
- **Earlier work**: signing in never moves anything by itself. If this browser's guest session has real work in it (a
  wardrobe, a room or walls added or changed, a reach, or credits), a sheet asks "Add your earlier work?", naming the
  designs, with **Add to my account** and **Do not add**. A guest that only opened the editor (the starting wall, nothing
  else) is not asked about and is forgotten. Closing the sheet with ✕ asks again next time. Either answer is quiet: the page
  simply shows the result (the added designs in the library; nothing if declined). Nothing else about signing in is announced:
  no "signed in" message and no welcome card; only problems (a failed move, a refused sign-out) are said.
- **Sign out** (the menu item when signed in, which signs out directly): designs belong to the account, so nothing of them stays in this browser. The open design is saved to
  the account first; if that fails (offline) the person stays signed in and is told why. Then the account's drafts,
  previews and recovery copies are erased from the browser and the page starts again as a new guest.

We store only the email (and Supabase's password hash). Google sign-in adds what Google sends to Supabase Auth
(name and picture in `auth.users`); the app reads only the email.

## How signing in keeps the guest's work

1. Right before any sign-in, the browser remembers the guest's session (`wardrobe:account:guest`,
   `src/infrastructure/account/guest-handover.ts`).
2. Signing in replaces the session and the page reloads (Google comes back through a redirect).
3. On start, `handOver` only looks: it reads what the guest owns, as the guest, and keeps the designs that have work
   (`hasDesignWork`, `src/application/account/guest-work.ts`: the editor's own rule for a fresh design, no wardrobe and
   the single starting wall) plus any credits. Nothing has moved. The editor opens the account's own designs meanwhile.
4. If something is worth asking about, the sheet asks. **Add**: `adoptGuest` sends both tokens to
   `POST /api/account/merge`; the server checks both (the guest must be a guest, the account a permanent account) and calls
   `account_merge` (`supabase/migrations/20261025200000_account_merge.sql`): designs, credit balance (two `transfer`
   ledger rows), passes and free uses, open orders and follows move in one transaction, and the browser drafts move
   too. The page reloads and the design that was open opens, without a message. **Do not add**:
   `declineGuest` forgets the guest and the designs this browser kept for it.
5. Merging is idempotent: a second tab or a retry moves nothing more. If the guest cannot be checked (offline), it stays
   remembered and the person is asked next time, without a message. If the server cannot move it, nothing changes
   and the question stays (that failure is said). If the guest's session was revoked meanwhile, its designs stay with it.

A design's owner still never changes from a browser: the ownership trigger allows it only under a flag set inside
`account_merge`, never as `anon` or `authenticated`. A transfer keeps the design's revision and dates, so an editor
that is open keeps saving.

Another tab signing in or out reloads every other tab (Supabase broadcasts the change), and background saving stops
the moment the identity changes, so no tab keeps saving as someone it no longer is (nor writes its draft back after a
sign-out erased it).

## Code

| Concern | Place |
| --- | --- |
| Sheet, menu item; customer copy | `src/presentation/account/` (`account-sheet.ts`, `account-markup.ts`, `account-errors.ts`, `account.css`) |
| Supabase Auth calls, other-tab reloads | `src/app/account-platform.ts` (port: `account.ports.d.ts`) |
| Remember the guest, look at it, move or drop it | `src/infrastructure/account/guest-handover.ts`, called by `src/app/session-bootstrap.ts` |
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
   matches, for example `https://furnidraw.com/**`, `https://www.furnidraw.com/**`,
   `https://awesomefurniture.alimutlu535529.workers.dev/**`,
   `https://awesomefurniture-dev.alimutlu535529.workers.dev/**` and `http://localhost:5173/**`. A missing one
   sends people back to the Site URL (set it to `https://furnidraw.com`) after Google or an email link.
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
- Closing the browser without signing out leaves the account's designs in it, as before: they are erased only by signing out.
