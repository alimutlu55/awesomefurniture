# Wardrobe

The Wardrobe Forge editor migrated from `Wardrobe_Forge-4-16-12.html` into the
existing domain/application/infrastructure/presentation structure.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. A design session is created and stored automatically
when the page opens, and edits autosave in the background. Returning to the same
browser restores the last design without requiring sign-in. Use **Back** beside
Studio/Furniture to open **Your designs**. Create and name a design with **＋**;
use **Select** for Rename, Duplicate and Delete. Each opened design has independent
Undo history. Browser drafts preserve work when cloud saving is unavailable.
The existing three-dot menu's **Share design** action copies a link containing
`?session=<id>`. Recipients open the saved design and edit their own session.
See [multiple named designs](docs/multiple-designs.md) for navigation, recovery and verification.

The app includes its public Supabase connection settings, so local and Cloudflare
builds work without environment configuration. To use another Supabase project,
override both values from `.env.example` together. See [Supabase setup](docs/supabase-setup.md) and
[the persistence architecture](docs/supabase-architecture.md).

## AI design images

Use the sparkle **AI image** button beside Storage to generate a professional photograph
with Gemini Nano Banana 2.1 from three captured perspectives and a summary of selected finishes and modules.
Set the server-only `GEMINI_API_KEY` environment variable to enable generation.
See [AI image setup and API](docs/ai-design-images.md) for local and Cloudflare secrets,
downloadable references, limits and verification.

## Verify and build

```sh
npm run check
npm run preview
```

`check` enforces layer imports, type-checks migrated JavaScript and strict TypeScript,
runs the editor regression and architecture suites, and builds the workspace and
`editor.html` and the multiple-editor example. The build bundles the same Three.js r128 used by the supplied HTML,
so the migrated renderer does not require a CDN connection.

## Shared mobile and desktop editor

Both layouts use the same contextual toolbar, category catalogue, bottom sheets,
and selection and camera behavior. Select a wardrobe, fitting, or room surface to
see its actions. Resize, Shape, Sections, materials, and doors open the same
editing surface at every width. Panels replace one another and release their
space when closed. Drag a sheet's handle down to close it, or up to expand it;
tapping the handle changes its height. Mouse, keyboard, and touch remain supported.

With the development server running, `npm run check:mobile` verifies the shared
workflows on phone, tablet, and desktop screens, mouse and touch sheet gestures,
and resizing an open panel across the former desktop breakpoint.

## Structure

| Directory | Responsibility |
| --- | --- |
| `src/domain` | Serializable designs, planner, fitting and cabinet geometry rules |
| `src/application` | Design/cabinet commands, scene model/history, planner cache, project saving |
| `src/infrastructure` | IndexedDB/memory adapters and validated serialization |
| `src/presentation` | Workspace, inspectors, wizard, gestures, camera and managed Three.js viewport |
| `src/app` | Browser startup and dependency wiring |
| `tests/architecture` | Persistence, scene round-trips, concurrency, serialization, history |
| `tests/*.test.cjs` | Editor regression, planner/command behavior, immutable UI baseline |

The original standalone HTML has been removed. All behavior runs from the layered
modules; tests require no copy of that file. `editor.html` remains the small Vite
entry point, and the presentation fragment contains the preserved UI markup.
See [architecture](docs/architecture.md), [extending the editor](docs/extending-editor.md),
and [migration verification](docs/migration-verification.md).

## Embed editors

`mountEditor({ root, initialScene?, projects? })` in
`src/presentation/editor/mount-editor.ts` mounts an isolated editor and returns
`snapshot`, `viewport` and `dispose`. Give each container an explicit height.
Multiple editors can share a document, with independent controls, shortcuts, state
and rendering resources.

Open `/examples/multiple-editors.html` on the Vite dev or preview server to try
independent editors and disposal/remounting. See the mounting example in
[extending the editor](docs/extending-editor.md).

Application workflows, mounting and extracted rendering modules use strict
TypeScript. Remaining presenter and geometry JavaScript uses the existing
non-strict checker; the original numerical planner stays behind its typed interface.

## Wardrobe shapes

Wardrobes can be regular, sloped, stepped, under-stairs, recessed or custom. Choose a
shape by selecting the wardrobe and choosing **Shape** in its toolbar, then
drag the break-point handles on the model or enter exact heights, positions and
angles under **Adjust panels**. Fittings under a slope are cut to its angle
automatically. All shapes share one top-profile model; fittings,
doors, measurements, Undo and saved projects follow it. See
[wardrobe shapes](docs/wardrobe-shapes.md).

## Smarter Auto design

Auto design shows clothing quantities, followed by storage ideas; **Max reach** is a project setting in the three-dot menu (off by default, one height for every wardrobe and cabinet).
Independent archetype searches use existing fittings and divider cuts, recover usable
gaps and show Best Overall plus up to three specialists. Specialists must improve
their hero metric by at least 15% and pass structural diversity and quality floors.
Complete plans rank ahead of partial plans; missing storage is explicitly reported.
Existing saved planning preferences are retained when clothing quantities change.
See [Smart Auto design](docs/smart-auto-design.md) for implementation and limits.

Run `npm run review:planner` for the repeatable 32-case planner audit. See
[test and design review](docs/planner-design-review.md) and the
[visual comparison](docs/verification/planner-review.html) for findings and layout thumbnails.

## Cloudflare deployment

Cloudflare Workers Builds should use `npm run build` as the build command and
`npx wrangler deploy` as the deploy command. The checked-in `wrangler.jsonc`
uploads `dist` as static assets; it avoids automatic Vite plugin installation
and a second build during deployment. HTML paths such as `/editor.html` remain
available, and unknown paths return 404.

Validate deployment locally after building with
`npx wrangler deploy --dry-run`. A dry run does not publish the site.

Both Workers use `npm run build` and `npx wrangler deploy`. Connect the
`awesomefurniture` Worker to `main` and `awesomefurniture-dev` to `develop`
as each Worker's production branch. The build reads Cloudflare's
`WORKERS_CI_BRANCH` and sets the matching Worker name in the temporary build
checkout. Keep automatic builds enabled for each Worker.

Local builds retain the `awesomefurniture` default. To deploy development
locally, use `npx wrangler deploy --env dev` (add `--dry-run` to validate).

# awesomefurniture
