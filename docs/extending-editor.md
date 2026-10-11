# Extending the editor

Keep new behavior in the existing domain/application/presentation layers. The editor
composition root is `src/presentation/editor/editor-runtime.ts`; persistence and
browser startup are composed in `src/app/editor.ts`.

## Choose the owner

| Change | Owner | Example |
| --- | --- | --- |
| A new kind of fitting (drawer, rail, rack...) | Fittings registry: one entry | `domain/wardrobe/fittings.ts` |
| Something that stands on a shelf (bags, hats...) | Possessions registry: one entry | `domain/wardrobe/possessions.ts` |
| A new general purpose (spare room, linen...) | Purposes registry: one entry | `domain/wardrobe/purposes.ts` |
| A rule that applies to several fitting kinds | A trait in the fittings registry, asked with `hasTrait` | `domain/wardrobe/fittings.ts` |
| Placement, clearance or feasibility rule | The wardrobe rules module that owns the concern | `domain/geometry/wardrobe-rules/*.js`, `cabinet-geometry.js` |
| Design mutation, undo checkpoint or rejection | Application commands | `commands/*-commands.ts`, `scene-commands.ts` |
| Save format or design mapping | Application contracts/mapper; infrastructure serialization | `editor-mapper.ts`, existing project repositories |
| Drag, selection or resize behavior | Focused interaction factory | `divider-drag.js`, `cabinet-drag.js`, `item-resize.js`, `scene-selection.js` |
| Measurement or contextual action | Focused inspector factory | `measurement-inspector.js`, `item-actions.js` |
| Labels, handles or previews | Focused viewport factory | `dimension-renderer.js`, `viewport-handles.js`, `movement-overlays.js` |
| Input listener | The feature's binding module | `presentation/editor/bindings/<feature>.js`, `shell-bindings.js` |
| Add item menu cards or wording | Add menu presenter | `add-menu-presenter.js`, `add-suggestions.js`, `product-art.js` |

Domain/application code must not import DOM, Three.js or presentation modules.
Presenters request mutations through commands. Domain geometry works in centimetres;
mesh construction and screen coordinates belong to presentation.

## Test before changing behavior

1. Add a test importing the production factory or command. Supply only its required
   collaborators, with small fakes for effects, clocks or UI resources.
2. Assert the observable result: accepted/rejected placement, exact undo checkpoint,
   restored dimensions, changed selection, or disposed resources. Include rejection
   and undo cases when adding a mutation.
3. Run the relevant test and observe its failure before implementation.
4. Implement the smallest change in the owner module, then run `npm run check`.
5. Verify changed UI paths in the production preview, including the mobile breakpoint
   when changing inspector or binding behavior.

Do not compile function snippets from source text. `tests/helpers/editor-fixture.cjs`
constructs direct production dependencies for historical scenarios; new tests can
use the same approach or smaller feature-specific fixtures.

## Add a focused presentation module

Use a factory with an explicit parameter object, return a small stable API, and
keep its dependencies beside it in a `.ports.d.ts` contract. Prefer a
`Readonly<Pick<ReturnType<typeof collaboratorFactory>, 'methodNeeded'>>` for service
APIs and a `Pick<State, 'fieldNeeded'>` for shared mutable state. State ownership must
remain clear; add a dedicated state factory when introducing an independent concern.

For example, a new viewport overlay should receive rendering resources, the exact
camera/state fields it reads, and named callbacks for the parent behavior it invokes.
Compose it inside `createCabinetRenderer`; do not add its internal methods to every
controller. A new click action should be bound in the relevant binding module and
call an application command through its narrow contract.

When adding a collaborator, update that module's contract and its construction site.
The JavaScript checker verifies the connection. Never recreate a universal context
object, access another module's internals through the DOM, or replace a controller
method at runtime. The compile-time tests in `editor-contracts.test.ts` illustrate
forbidden dependency access.

## Handle collaboration and cleanup

Prefer direct dependency injection. If controller collaboration is cyclic, create a
typed `ModulePort<T>` in the composition root, pass its API, connect once, and install
event bindings only after all connections exist. Factory construction must not call
an unconnected collaborator. Module APIs are immutable after connection.

Register listeners, timers, observers and animation frames with the editor lifetime.
Register generated geometries, materials and textures with the viewport resource
owner. Keep animation timestamps and drag sessions per editor instance. Renderer
iteration must not retarget the application's active cabinet.

## Preserve saved designs

A new persisted field needs mapping, serialization validation, old-project fallback,
and round-trip tests. Keep transient UI state out of `ProjectDocument`. Preserve the
existing revision checks and explicit-save behavior; command undo history must not
roll back the storage revision.

The original planner algorithm and presentation markup/styles have regression
baselines (`tests/fixtures/editor-baseline.json`). An intentional behavior or UI change
requires an explicit test and a reviewed baseline update whose commit says why.

Golden tests (`tests/architecture/golden.test.ts`) record what Auto design, layout,
cost, stats and Add item produce for six wardrobes. A refactor must leave them
untouched. If behaviour changes on purpose, re-record with `UPDATE_GOLDEN=1 npm test`,
review the fixture diff, and explain the change in the commit.

## Mount one or several editors

```ts
import { mountEditor } from './src/presentation/editor/mount-editor';

const editor = mountEditor({ root: document.querySelector<HTMLElement>('#editor')! });
// The container needs explicit dimensions, for example height: 700px.
const scene = editor.snapshot();
editor.dispose(); // Safe to call again; the same container can be remounted.
```

Supply `initialScene` to open a scene. Supply `projects` and `initialProject` to
connect the existing save service; `onProjectCreated` lets the host respond to the
first save. The standalone app updates its URL through this callback. Embedding
an editor does not change the host URL by itself. Without `projects`, the editor
runs without project persistence.

Run `/examples/multiple-editors.html` for two independently mounted editors and
visible disposal/remount controls. Each mount owns its ShadowRoot and WebGL context.

New modules should use strict TypeScript. Inject `dom` into UI factories; use its
scoped control lookup and listener APIs, never global document IDs or window state.
Required controls use `dom.$`; optional controls use nullable
`dom.document.querySelector`. Use `dom.setId` for dynamic controls and
`dom.selector` for selector-based ancestor checks. Keep accessible label/control
relationships inside the mount. Container dimensions, focus, media queries and
reduced-motion preferences also come from this scope.

New render factories should accept a narrow resource contract and return their
objects to the cabinet coordinator. Register allocated materials on the cabinet's
owned-material list when they may remain unattached. Shared textures/materials
belong to the viewport lifetime, and must survive cabinet rebuilds.
