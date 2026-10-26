# Furnidraw production setup

## Database prepared on 2026-10-26

- Supabase project: `furnidraw-prod` (`yqeimymddjhqeghgpjcl`).
- Region: Ireland (`eu-west-1`), PostgreSQL 17.
- API URL: `https://yqeimymddjhqeghgpjcl.supabase.co`.
- The owner chose a fresh production database; development data is not being copied.
- All five repository migrations were applied. The migration history versions match the checked-in filenames, so future CLI deployments can compare their histories correctly.
- All nine application tables have RLS enabled.
- `session_access.sql`, `credits_ledger.sql`, and `account_merge.sql` passed against the empty project with all fixtures rolled back. Verified zero users, designs, credit accounts, ledger entries, and payment orders afterward. Do not rerun fixture suites against production after customer traffic begins; use development/staging.
- Security Advisor reported only the informational `payment_events` table with RLS and no policies. This is intentional: payment events are server-only, and no browser policies should be added just to silence it.

The local CLI remains linked to development (`bcsdsuznpgnfyxzsaqzb`). No frontend defaults, Cloudflare variables, or live deployments were changed during database preparation.

## Remaining setup before switching the live app

### Supabase Auth

At inspection, anonymous sign-ins and Google were disabled; email signup and email confirmation were enabled.

1. In [Sign In / Providers](https://supabase.com/dashboard/project/yqeimymddjhqeghgpjcl/auth/providers), enable anonymous sign-ins. The editor uses guest identities for autosaving before account signup. Keep the ownership policies in place.
2. In [URL Configuration](https://supabase.com/dashboard/project/yqeimymddjhqeghgpjcl/auth/url-configuration), set Site URL to `https://furnidraw.com` and configure the production redirect URLs used by the app. Keep localhost and development URLs on the development project.
3. Configure production SMTP and code-based email templates containing `{{ .Token }}`; see [accounts.md](accounts.md#setting-it-up).
4. If Google sign-in is required, configure the provider with callback `https://yqeimymddjhqeghgpjcl.supabase.co/auth/v1/callback`.

### Cloudflare connection

Builds of `main` select the production public URL and publishable key automatically.
The server URL is managed in `wrangler.jsonc`; the build preparation script selects
the development URL for `develop`. Only `SUPABASE_SECRET_KEY` must be supplied in
the dashboard. To override the frontend connection, set both build variables below.

| Scope | Name | Value |
| --- | --- | --- |
| Build variable | `VITE_SUPABASE_URL` | `https://yqeimymddjhqeghgpjcl.supabase.co` |
| Build variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_vQkpubCtc0yFdSQ6qJ6uYQ_FbaaBdBU` |
| Runtime variable | `SUPABASE_URL` | `https://yqeimymddjhqeghgpjcl.supabase.co` |
| Runtime secret | `SUPABASE_SECRET_KEY` | The production project's secret key, entered directly into Cloudflare; never commit it or prefix it with `VITE_`. |

Build overrides require a new frontend build. Runtime variables alone do not change the browser's bundled project. Both frontend and backend must use the same project. `keep_vars` preserves other runtime variables configured in the dashboard.

The repository targets `furnidraw-prod` for `main` and local production deployments in both `wrangler.jsonc` and `scripts/prepare-cloudflare-build.mjs`. Development builds continue to target `awesomefurniture-dev`.

At dashboard inspection on 2026-10-26, the new `furnidraw-prod` Worker used the `main` branch, had no runtime or build variables configured, and showed an unavailable deployment token. Configure the variables above and verify a valid deployment token before triggering a production build. Confirm the target Worker owns the intended domain before switching traffic.

For paid features, configure the production payment and image-provider secrets described in [credits.md](credits.md#going-live). Keep development Stripe credentials separate.

### Launch checks

- Verify guest autosave/reload, signup and email codes, account merge, sharing, and server credit endpoints against the production deployment.
- Verify payment webhook delivery and that credits are credited only once when payments are enabled.
- Confirm the scheduled credit recovery job is deployed.
- The organization showed the Free plan at inspection. Select an appropriate production plan, backup retention, and recovery procedure before accepting customer work or payments; no plan or billing changes were made.
- Add protected migration deployment for future releases; apply compatible database changes before the frontend that requires them.
