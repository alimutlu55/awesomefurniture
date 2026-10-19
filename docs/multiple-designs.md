# Multiple named designs

The standalone app treats saved designs as documents. **Back** shares the existing
Studio/Furniture surface and opens **Your designs**. It adds no new floating panel
or top row. Embedded editors keep their original controls unless a caller supplies
`onBack` to `mountEditor()`.

The collection shows previews, names, last edit dates and the current design.
**＋** creates a design with a selected default name; **Select** reveals one action
bar for Rename, Duplicate and Delete. Delete requires confirmation naming the
whole design. Names use the existing trimmed 1–120-character rule. Copies get a
new ID, new storage revision sequence and private visibility.

## Navigation and recovery

- Ordinary visits restore the last design. `?view=designs` opens the collection;
  `?session=<id>` continues to open a particular design. Shared links keep their
  existing ownership/fork behavior. Opening the collection does not publish work.
- The application queues navigation and collection operations. Before leaving,
  editor input is frozen, the outgoing scene is written to browser recovery,
  pending cloud saves settle, and the saver stops. A destination gets a fresh
  editor mount and Undo history. No saver can read the next editor's scene.
- Cloud failures retain the browser draft and do not prevent leaving a design
  when local recovery succeeds. A local storage/quota failure leaves the current
  editor available and reports the error. Delete requires a successful cloud
  operation when a cloud repository is active.
- Cloud and local summaries merge by ID. Lists page through cloud records rather
  than dropping everything after the first 100. A larger collection gets search
  on the collection screen.
- Stale local snapshots are preserved as separately named recovered copies rather
  than being resubmitted against another tab's revision. Conflict copies update
  the active route. Background draft writes do not move the last-opened pointer.
- Soft deletion suppresses the local draft with an identity-scoped tombstone.
  Other tabs stop editing a deleted design and return to the collection. Deleting
  the last record leaves an empty collection; reload does not create a replacement.
- Previews are optional, identity-scoped browser caches of the live 3D canvas.
  Before a capture is available, a document-derived drawing shows the furniture's
  dimensions, finishes, sections and contents. Preview failure cannot block saving.

The existing anonymous browser identity remains the ownership model. Cloud saving
does not provide account recovery or cross-device access after browser identity is
lost. This change adds no account-linking flow or database migration.

## Code boundaries

- `src/app/design-workspace.ts`: navigation, editor mounting/disposal and lifecycle.
- `src/application/projects/design-collection.ts`: cloud/local merge and collection operations.
- `src/presentation/designs/`: accessible collection, naming/deletion dialogs and preview fallback.
- `src/infrastructure/persistence/browser-drafts.ts`: scoped recovery, active pointer, preview cache and tombstones.

Native modal dialogs handle focus containment, Escape/cancel and background
inertness. Their position follows the visual viewport while the keyboard is open.
The collection supports the app theme, safe areas and keyboard operation. Narrow
phones retain 44 px touch targets; the Storage label collapses to its existing
icon where needed to avoid overlapping the navigation group.

## Verification

```sh
npm run check
# With Vite running on port 4173:
npm run check:designs
MOBILE_TEST_URL=http://127.0.0.1:4173 npm run check:mobile
```

`check:designs` uses an isolated browser context with cloud calls blocked. It checks
create, rename validation, duplicate, delete/cancel, reload, browser Back, separate
Undo histories, quota failure, deletion across tabs and 320–1440 px layout. It
writes actual application captures under `docs/verification/design-workspace/`.
Architecture tests also exercise real Supabase query construction against a
controlled transport, including more than 100 owner-filtered records; they never
read or mutate a live user's cloud records. See the [verification report](verification/design-workspace/README.md) for screenshots, passed checks and limitations of the broader legacy browser suite. Physical-device keyboard and safe-area behavior still require device verification.
