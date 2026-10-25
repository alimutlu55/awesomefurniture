# Supabase setup

Project: [wardrobe-app](https://supabase.com/dashboard/project/bcsdsuznpgnfyxzsaqzb),
organization `alimutlu55`, Free plan, Frankfurt (`eu-central-1`).
API URL: `https://bcsdsuznpgnfyxzsaqzb.supabase.co`.

Anonymous sign-ins are enabled on the hosted project and in `supabase/config.toml`.
The app restores or creates this identity automatically on landing, stores a design
session immediately, and autosaves edits. Signing in is optional (the ⋮ menu) and
needs SMTP and the Auth settings in [accounts.md](accounts.md#setting-it-up). All four application tables have RLS and explicit grants;
both checked-in migrations are applied.

`src/infrastructure/supabase/project-config.ts` contains the public browser URL
and publishable key, so builds need no Cloudflare variables. Optional environment
overrides must supply both values together. `.env.local` is ignored by Git.
The CLI is linked. The database password exists only in ignored
`.env.supabase-admin` (mode 0600), never in frontend environment variables.

```sh
npm ci
npm run dev
npm run check
npx supabase db query --linked --file supabase/tests/session_access.sql
npx tsx scripts/verify-supabase.mts bcsdsuznpgnfyxzsaqzb
npx supabase db advisors --linked --type all
```

The hosted integration script creates disposable anonymous identities, verifies
restoring their sessions, complete design round-trips, ownership isolation,
sharing, multiple sessions, revisions and stale writes, then deletes the fixtures.
Use a development project, not production customer data.

The existing three-dot menu's Share design button copies a link containing
`?session=<id>`. Opening it restores the owner's session for the owner or creates
an independent editable session from the saved design for another visitor.
No extra controls or screens are introduced.

For Cloudflare rollout, push the reviewed changes to `develop`; Workers Builds
selects `awesomefurniture-dev`. The public connection defaults are bundled in the
app, so no manual Cloudflare setup is required. Optional `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` build overrides can select a different project.
Private keys and database passwords must never enter frontend builds.

Types are generated from the live public schema:

```sh
npx supabase gen types typescript --linked --schema public > src/infrastructure/supabase/database.types.ts
```

The Supabase SDK and CLI are pinned in the lockfile. `skipLibCheck` avoids the
current SDK WebAuthn declaration conflict with TypeScript 6 DOM declarations;
strict source checks and architecture checks remain enabled.

With anonymous sign-ins enabled, the advisor flags anonymous access policies.
This is intentional for design persistence: every write still checks ownership,
and history is visible only to its owner. See the
[anonymous-policy advisory](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
The advisor also flags
[leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
off for now. Accounts now have passwords: turn it on where the plan allows it.

Set retention and quotas for anonymous identities and full revision snapshots
before growing usage. Clearing browser storage loses a private anonymous owner's
write identity. Future accounts can link to this identity without changing the
design-session model.
