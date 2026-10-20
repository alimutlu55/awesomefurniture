# Wardrobe Forge

A browser editor for built-in furniture: wardrobes (shape the cabinet, add fittings, and let Auto
design plan storage for what someone owns) and kitchen cabinets (modular base, wall and tall units
sharing a worktop and plinth). Vite + Three.js r128, one frontend package, Supabase Auth and Postgres
for saved design sessions. See docs/supabase-architecture.md and docs/furniture.md.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Vite, http://localhost:5173/editor.html) |
| `npm run check` | **What CI runs.** Boundaries, architecture rules, typechecks, all tests, build. Must pass before a push. |
| `npm test` | All tests (`tests/*.test.cjs`, `tests/architecture/*.test.ts`) |
| `UPDATE_GOLDEN=1 npm test` | Re-record golden fixtures, only for an intended behaviour change |
| `npm run check:architecture` | File/line size limits, no hand-written kind or possession lists, no HTML in domain |
| `npm run check:mobile` | Phone-layout checks (Playwright) |

## Layers

`src/domain` → `src/application` → `src/presentation`, with `src/infrastructure` (saving) and
`src/app` (startup). `npm run check:boundaries` enforces the import directions: domain and
application import no DOM, Three.js or packages; presentation never imports infrastructure.
Details: [docs/architecture.md](docs/architecture.md).

- **Domain** works in centimetres on plain data (the `selection-*` planner uses millimetres
  internally). It returns data, never markup.
- **Application** commands change the design, take undo checkpoints, and report through effects.
- **Presentation** factories take an explicit parameter object typed by an adjacent
  `.ports.d.ts`. Register every listener, timer and observer with the editor `lifetime`.
  Look up controls with `dom.$('#id')`: ids are scoped per mount (`data-editor-id`).

## Where a change goes

| Change | Place |
|---|---|
| New fitting kind, purpose, or a rule shared by several kinds (trait) | One entry in `src/domain/wardrobe/fittings.ts` / `purposes.ts`. See [docs/adding-a-fitting.md](docs/adding-a-fitting.md) |
| Something that differs between wardrobes and kitchen cabinets (limits, allowed fittings, toolbar, duplicate) | The furniture module: `src/domain/furniture/`, `wardrobe/wardrobe-module.ts`, `kitchen/kitchen-module.ts`. See [docs/furniture.md](docs/furniture.md) |
| Kitchen units, presets, runs (worktop, plinth), pull-to-array | `src/domain/kitchen/`, `application/commands/kitchen-commands.ts`, `presentation/editor/kitchen-*.ts`. See [docs/furniture.md](docs/furniture.md) |
| Something that stands on a shelf (bags, hats...) | One entry in `src/domain/wardrobe/possessions.ts`. See [docs/adding-a-possession.md](docs/adding-a-possession.md) |
| Geometry or feasibility rule | The module that owns the concern in `src/domain/geometry/wardrobe-rules/`. `wardrobe-geometry.js` only composes them. |
| Board thickness, setback, back board, rail drop, interior floor | `src/domain/wardrobe/carcass.ts`. Never write `d - 2` or `± .5` again. See [docs/millwork-precision.md](docs/millwork-precision.md) |
| Sharing a length into parts (bays, boards) | `shareMillimetres` in `src/domain/geometry/millimetres.ts`: whole millimetres that add back up exactly |
| Clearances a fitting shows (gaps, rail drop, drawer stack, clear opening) | `src/domain/geometry/wardrobe-rules/clearances.js`; drawn by `viewport/item-dimensions.js` and `component-dimensions.js` |
| Auto design search and scoring | `src/domain/planner/` (`selection-*`, `layout-score.ts`). The numerical engine is `wardrobe-planner.js`. |
| Event listener | The feature's module in `src/presentation/editor/bindings/` |
| Technical drawings (plan, elevations, shop sheets, cutting and hardware lists, PDF) | `src/domain/drawings/` (data, mm) and `src/presentation/drawings/` (paper marks written as SVG and as the PDF file, viewer). See [docs/technical-drawings.md](docs/technical-drawings.md) |
| Building designs from a description (agents, imports) | `src/application/spec/` and the spec codec. See [docs/design-spec.md](docs/design-spec.md) |
| Anything else | [docs/extending-editor.md](docs/extending-editor.md) |

Never copy registry contents (kind names, possession keys, purpose labels, furniture kinds, kitchen
units) into another file. Ask the registry: `FITTINGS`, `hasTrait(kind, trait)`, `POSSESSIONS`,
`PURPOSES`, `FURNITURE` / `furnitureModule(design)`, `KITCHEN_UNITS`.

## Guards that must stay green

- **Golden tests** (`tests/architecture/golden.test.ts`) lock Auto design proposals, layout,
  cost, stats and Add item output for six wardrobes. A refactor must not change them. For an
  intended change, re-record and explain the change in the commit.
- **Registry tests** (`fittings.test.ts`, `possessions.test.ts`) walk every entry through every
  place that uses it. A new entry that is missing something fails with the step named.
- **Baseline hashes** (`tests/fixtures/editor-baseline.json`) lock `wardrobe-planner.js`,
  `editor.html` and `editor.css`. When you change one of those files on purpose, refresh the hash
  in the same commit and say why.
- **Architecture ratchet** (`scripts/architecture-baseline.json`) lists older code that breaks a
  rule. A listed file may only improve. Never raise a number or add a file: fix the code.

## How we work

- Work on a feature branch. Push to `develop` and `main` only when asked, by fast-forward. Never
  force-push unless explicitly asked.
- Keep refactors behaviour-preserving: a move or rename is its own commit, never mixed with a
  behaviour change.
- Verify before saying something works: run `npm run check`, then use the change in the browser
  on desktop and at phone width (375 px), and share screenshots. Say plainly what was not verified.
- When asked to check the scope of something, report the scope and wait before building.

## Work in progress

- **Studio** (rooms around the wardrobes), branch `feature/studio`: see [docs/studio-handoff.md](docs/studio-handoff.md)
  for decisions, status and what is left.

## Known gaps

- Kitchen cabinets: design specs and the agent API build wardrobes only; runs do not turn corners;
  sinks and hobs sit on the worktop without a cut-out (docs/furniture.md, Known limits).
- Auto design plans each bay of a shaped wardrobe only up to the lowest point of the top above it
  (`planner/bay-ceilings.ts`), so the space above that point under a slope stays empty. On narrow
  fixed bays the planner can give a whole tall bay to long garments and leave shirts out
  (under-stairs default: 0 of 24 shirts).
- Technical drawings: no drilling plans or drawer box parts yet; the cutting list gives finished
  sizes without deducting edge banding (docs/technical-drawings.md).
- `bindDividerHeight` (`bindings/divider.js`) adds listeners directly instead of through the
  lifetime, so they are not removed when an editor is disposed.
- Five presentation factories have no parameter type: `contextual-toolbar.js`,
  `resize-fields.js`, `resize-presenter.js`, `viewport/cabinet-layout-renderer.js`,
  `viewport/editor-lifetime.js`.
