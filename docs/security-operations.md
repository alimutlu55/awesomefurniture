# Production security

## Request and deployment controls

- Cloudflare blocks sensitive-file discovery on `furnidraw.com`. The custom rule is
  `Block sensitive-file discovery` (`f3465611b3ed4cb1903ee92c58cd7de5`).
- The Cloudflare API rule blocks traffic above 30 requests per IP in 10 seconds for
  10 seconds. It excludes `/api/payments/stripe/webhook`.
- The Worker additionally limits non-webhook API requests to 60 per IP per minute.
  AI calls have independent 3/minute IP and verified-account quotas. Worker rate
  limits are edge-local, best-effort abuse controls; the credit ledger remains the
  authority for spending and payment idempotency.
- AI authentication and quotas run before reading reference images. Credit and
  account bodies have streaming byte limits; webhook signatures use the original text.
- Production ignores all caller-selected mock controls. Local Vite handlers explicitly
  enable mocks. Debug logs retain counts and sizes, never prompts or image payloads.
- `npm run build` rejects sensitive public filenames, source maps, private keys,
  common provider secrets, and privileged Supabase JWTs in the emitted assets.
  This is a deployment guard, not a complete secret scanner for repository history.
- Security headers cover both static assets (`public/_headers`) and Worker responses.
  A minimal CSP is enforced. Script/style/connect restrictions are initially
  report-only; review `security_csp_violation` events before enforcing them.

## Authentication

Production Supabase requires email confirmation, a 12-character minimum for new or
changed passwords, and recent authentication for password changes. Existing shorter
passwords can still sign in. Anonymous identities continue to own their own designs;
their RLS warnings must not be removed by granting wider access or disabling guests.
The production tables have RLS, and privileged credit/account RPCs deny browser roles.

Turnstile rollout must happen in this order:

1. Create a Managed widget restricted to `furnidraw.com`; keep localhost off the
   production widget. Use the official dummy key for local automated verification.
2. Configure `VITE_TURNSTILE_SITE_KEY` in the production Worker's **build variables**.
   It is public. The secret belongs only in Supabase Auth CAPTCHA settings.
3. Deploy and verify the client integration, including guest startup, password
   sign-in, sign-up, resend and recovery. Each protected operation gets a fresh token.
4. Enable Cloudflare Turnstile in Supabase Auth > Attack Protection with the matching
   secret. Do not enable it before step 3, or fresh guest/sign-in requests will fail.
5. Verify that tokenless Auth requests are refused and a human can still sign in.

Leaked-password protection currently requires Supabase Pro or higher. It remains
an explicit plan-dependent item; stronger length requirements do not replace it.
Do not purchase an upgrade without the owner's approval.

## Monitoring and response

The `Security` GitHub workflow audits production dependencies on changes and checks
the public site twice an hour. It verifies sensitive-path denial, security headers,
unauthenticated API rejection and forged Stripe webhook rejection. Workflow failure
notifications follow GitHub account settings; an exact email destination is not
guaranteed by this workflow. Configure the owner's requested security-alert recipient
in the provider's notification settings rather than keeping contact details here.

Cloudflare query-monitor setup was attempted, but its SQL preview returned
`Connection blocked`; no unverified query monitor was enabled. Native email alert
delivery, payment reconciliation alerts and AI usage/budget alerts still need a
verified destination and provider configuration. No mail credentials are stored here.

Useful structured log events:

| Event | Response |
| --- | --- |
| `credits_paid_not_credited` | Investigate immediately; compare signed payment with order amount and currency. |
| `credit_capture_failed`, `credit_release_failed`, `credits_reconciled_failed` | Inspect the ledger and reconciliation before modifying balances. |
| `worker_request_failed`, `design_image_failed`, `account_merge_failed` | Correlate using request ID and investigate repeated failures. |
| `security_csp_violation` | Review the directive; reports are untrusted and omit URLs and tokens. |

Alert on repeated 5xx responses (initial threshold: 3 in a minute), any payment/ledger
integrity failure, abnormal AI spend, and 2xx responses serving sensitive files.
Ordinary rejected scans do not each need an email. Review free-plan sampling when
interpreting absence of events. Verify backups and restore procedures separately.

## Release verification

Run `npm run check`, `npm audit --omit=dev --audit-level=high`, and then
`node scripts/security-smoke.mjs` after deployment. Desktop and 375px sign-up forms
and guest startup were checked with Cloudflare's official dummy CAPTCHA key; this
does not prove production CAPTCHA enforcement is enabled.

Workers Builds deploys `main` to `furnidraw-prod`. Runtime secrets remain in
Cloudflare (`keep_vars`); production builds select the production Supabase project.
Never copy a local `.env` into the release artifact. After deploying, verify the
actual public headers and denied API/probe behavior before declaring the rollout complete.
