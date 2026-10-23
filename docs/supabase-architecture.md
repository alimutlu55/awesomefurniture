# Automatic design-session persistence

The editor UI stays unchanged. A visitor lands on the page, an anonymous Supabase
identity is restored or created, and a design session is stored automatically.
Edits autosave. Returning to the same browser restores its active session. The
existing three-dot menu's Share design action saves and copies `?session=<id>`.
There are no login, session-management, publish, or follow controls.

## Data structure

| Entity | Responsibility |
| --- | --- |
| `auth.users` | Persistent anonymous ownership, without email or password |
| `design_sessions` | Stable session ID, owner, visibility, revision, complete design |
| `session_revisions` | Immutable snapshots, readable only by the owner |
| `session_follows`, `creator_follows` | Reserved relationships for future features; no current UI |

A single owner can own multiple sessions already. The current UI automatically
resumes one active session per browser. Future multiple-session navigation can use
the existing repository contract without restructuring stored designs.

The document is versioned JSONB. It preserves stable fitting IDs, rooms, cabinets,
finishes, geometry, layout intent and planner preferences. New fitting types come
from the existing domain registries and need no new SQL table or column. A change
to the document format requires an explicit codec migration and schemaVersion
increase; unsupported clients reject the document instead of overwriting fields.
The database validates its envelope and enforces a 2 MiB limit. Application codecs
validate the detailed design before loading and saving. Render resources, camera,
selection and other transient editor state are not stored.

Version 1 documents continue to load unchanged. Boundary divisions are stored as version 2:
walls and ceilings may have an optional `shape` containing matching contours along the solid
and explicit editing controls. The scene mapper promotes a design to version 2 when such a
division is added, and uses version 1 again when none remain. The codec validates both versions;
version 1 rejects version 2 geometry rather than silently discarding it. Original ceiling profiles
remain present for existing height fields. The retired `outline`/`sections` format is not restored.

## Ownership and sharing

New sessions are private. RLS authorizes writes using `auth.uid() = owner_id` for
anonymous identities just as for future permanent accounts. No service-role key
is sent to the browser. Column grants prevent direct ownership/revision changes.
History is private and appended by an internal, owner-checking trigger.

Only clicking the existing Share action marks a session readable to recipients;
opening the menu alone does not publish it. The link contains the design-session
ID and no write credential. The owner reopens the same session. Another visitor
sees the saved design and receives an independently owned session for editing.
Reopening the shared link reads its latest saved version. Future revocation can
use the existing visibility field. Current shared records are public reads, not
secret capability links; expiring/unlisted links would need hashed tokens and a
narrow RPC rather than weaker ownership rules.

## Recovery and concurrency

The Supabase client persists and refreshes the anonymous identity. Browser drafts
are scoped by identity and design-session ID. Initial landing immediately saves
the complete editor scene; subsequent saves are ordered and use atomic expected-
revision predicates. A request cannot silently overwrite a newer revision.
Concurrent edits keep the remote design and automatically persist the local
version in a new session. Network failures preserve the recovery draft and retry.
No new UI is needed for these background operations.

Anonymous ownership survives normal reloads. Clearing browser storage loses its
private write identity; a shared link still grants read access, never ownership.
Future accounts can link to that same anonymous identity when the product calls
for cross-device ownership. Email/SMTP is not needed for the current flow.

## Future extensions

Add memberships for collaborative editing, private Storage assets for photos,
an activity/outbox for notifications, and explicit document migrations as those
features arrive. Keep relational metadata for authorization and filtered queries;
do not normalize every fitting type into a separate table. Simultaneous editing
can later use patch operations or CRDTs; current optimistic snapshots protect
multiple independent sessions without that complexity.

Define history retention, quotas, anonymous-user retention, and backup/export
policy before growing usage. Full snapshots currently retain every successful
revision. Keep development and production projects separate before real usage.
