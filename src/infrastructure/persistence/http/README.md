# Backend adapters

Supabase now implements `ProjectRepository` in
`src/infrastructure/supabase/project-repository.ts`. Authentication and connection
wiring live in `src/app/session-bootstrap.ts`, outside application/domain code.
This directory remains available for a future custom HTTP adapter.

- Map API payloads through validated serialization; keep transport details here.
- Use an atomic expected-revision check on the server and map conflicts to
  `ProjectConflictError`. Authentication and ownership must be checked server-side.
- Enforce document size limits and shape validation server-side.
- Introduce a separate application sync coordinator for ordered autosaves,
  retries, local recovery, and explicit multi-device conflict handling.
- Do not send an old snapshot again with a newer revision to bypass a conflict.

IndexedDB remains available for local consumers. The browser app uses Supabase
for automatic anonymous-session persistence and separate identity-scoped browser recovery drafts.
