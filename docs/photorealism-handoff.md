# Wardrobe photorealism handoff

Date: 2026-10-12. Audience: the engineer or agent implementing photographic rendering for the wardrobe editor.

## Objective and user intent

Make the generated wardrobe look like a photographed physical cabinet, following [the target image](realism-reference/target.jpg). Compare against [the current screenshot](realism-reference/current.jpg).

The user explicitly distinguished a game-like 3D appearance from realism. The priority is believable light transport, wood surfaces, edges, and construction. Camera framing and UI changes alone do not satisfy this request. The target's production method is unknown; do not assume it was path traced or promise an exact pixel match.

This handoff is planning work. No renderer changes, texture downloads, Blender prototype, compatibility tests, or device benchmarks have been completed. Reference images are preserved alongside this document.

## Recommended approach

1. Establish a photographic benchmark in Blender Cycles using our cabinet dimensions.
2. Improve the generated geometry and material mapping in the current app.
3. Prototype progressive browser path tracing with the same scene.
4. Select the production rendering route from measured iPhone results.

Intended product behaviour: the fast renderer responds during interaction; a photographic preview refines when the scene is stationary. A server-rendered preview is the fallback if browser rendering fails the device or visual criteria. Treat server rendering as a separate implementation decision with infrastructure costs, not an already available capability.

## Tools and assets

| Tool or asset | Use |
| --- | --- |
| Blender + Cycles | Reference rendering, accurate indirect light, material and lighting tuning |
| Blender Python API | Reproducible scene generation and later export/render automation |
| Existing Three.js renderer | Responsive editing and shared generated scene |
| `three-gpu-pathtracer` | Experimental progressive photographic preview in the browser |
| Poly Haven Oak Veneer 02 | Cabinet surface colour, roughness, and normal maps |
| Poly Haven Oak Wood Planks | Floor material |
| Playwright | Repeatable desktop/mobile viewport screenshots and interaction checks |
| Physical iPhone + Safari | Actual rendering compatibility, latency, responsiveness, and sustained-use testing |

Verified asset pages:

- Cabinet: https://polyhaven.com/a/oak_veneer_02 — light oak veneer, available colour, roughness, OpenGL normal, displacement, and AO maps; published physical width is 1 metre.
- Floor: https://polyhaven.com/a/oak_wood_planks — varnished oak planks; published physical width is 1.2 metres.
- License: https://polyhaven.com/license — CC0 assets permit commercial use and redistribution.
- Browser tracer: https://github.com/gkjohnson/three-gpu-pathtracer — verify the selected release's renderer requirements and device support before integration.
- Cycles: https://docs.blender.org/manual/en/4.4/render/cycles/introduction.html

Start with 2K colour, roughness, and OpenGL normal maps for the browser. Keep a higher-resolution source for the Blender benchmark if needed. The veneer is a starting material, not proof of a final match. Tune colour and coating to the reference; avoid excessive relief on smooth cabinet veneer. Use plank textures for the floor, where their seams belong.

Download assets into a dedicated local asset directory using the existing build's asset convention. Record source URL, license, resolution, map convention, physical tile size, and any transformations in an asset manifest. Serve runtime assets from the application rather than relying on third-party hotlinks. Respect the material's physical dimensions and verify both texture axes.

## Current implementation and limitations

All paths below are relative to the repository root.

| File | Relevant behaviour |
| --- | --- |
| `package.json` | Three.js and its types are pinned to `0.128.0` |
| `src/presentation/viewport/viewport-resources.js` | Standard materials, ACES tone mapping, shared procedural grain, reused colour texture for bump, gradient contact/AO textures |
| `src/presentation/viewport/scene-lighting.ts` | RoomEnvironment, hemisphere fill, shadow-casting directional light; overrides shadow type to PCF and uses radius 7 |
| `src/presentation/viewport/wood-grain.ts` | Generated canvas grain rather than a coordinated wood material set |
| `src/presentation/viewport/cabinet-materials.ts` | Panel, darker back, and plinth materials |
| `src/presentation/viewport/cabinet-renderer.js` | Sharp boxes and unbevelled extrusions; normalized planar UVs for shaped panels |
| `src/presentation/viewport/frame-geometry.ts` | Generated panel geometry, including shaped wardrobes |
| `src/presentation/viewport/cabinet-layout-renderer.js` | Back-panel AO gradient overlays and interaction highlights |
| `src/presentation/viewport/stage-floor.ts` | Transparent floor that fades away outside a room |
| `src/presentation/viewport/studio-renderer.ts` | Existing room walls, floor, openings, and camera-dependent wall lowering |
| `src/presentation/viewport/frame-renderer.js` | Render loop, animations, and shadow invalidation |
| `src/presentation/viewport/render-disposal.ts` | Scene asset disposal |

The default pipeline does not calculate multi-bounce light transport through the actual cabinet. Its environment and hemisphere illumination are not locally shadowed like the sun, and the current gradients only approximate occlusion. Standard PBR materials do not supply missing global illumination. Path tracing can improve this, but cannot repair inaccurate geometry or material inputs.

## Phase 1 — photographic benchmark

Owner: rendering engineer, with Orchestrator tracking the visual objective.

1. Check Blender availability. Install or document the required runtime if absent; do not claim a render exists until produced.
2. Generate the same empty 200 cm wide × 230 cm high × 60 cm deep cabinet. Use existing panel/plinth dimensions from the domain catalog; convert centimetres to metres once at the Blender boundary.
3. Model subtle edge bevels, the recessed back, and existing panel joints without changing product dimensions.
4. Apply the chosen veneer maps at physical scale. Orient grain per board and give boards stable texture offsets.
5. Create a plaster wall, skirting, solid oak floor, and coherent window daylight. Balance direct light and indirect bounce to retain interior depth and wood colour.
6. Match the reference's near-front camera for visual comparison. Also save an identical camera for raster/path-tracing comparisons; composition must not hide rendering differences.
7. Render with Cycles. Tune light, finish, and colour management; preserve the scene script, texture manifest, render settings, and output image.

Deliverable: reproducible Blender scene/script and a comparison image. Gate: photographic depth and material response are visible at phone size, especially under the top panel, at back corners, on side panels, and at the floor contact. Record remaining differences from the reference before proceeding.

### Phase 1 results (2026-10-12)

Done. [Benchmark render](realism-reference/benchmark-cycles.jpg), produced by
`blender -b --factory-startup -P scripts/realism/benchmark_scene.py` (Blender 5.2.2 LTS, Homebrew cask,
Cycles on the Apple M4 GPU through Metal, 256 samples with denoising, 1290 × 2796, about 2 minutes). The
camera, in app coordinates, is saved beside it in `benchmark-cycles.jpg.camera.json`. Textures and their
licences are in `public/textures/MANIFEST.md`.

- **Scene**: the empty default wardrobe built as `frame-geometry.ts` builds it: 1.8 cm sides under a full-width
  top, the bottom board on an 8 cm plinth recessed 4 cm, and a 6 mm back. Edges are bevelled 1.5 mm. UVs are in
  metres with the grain along each board (up the sides and back, across the top, bottom and plinth), and each
  board has its own offset. The room is 4 × 4.8 m, tall enough that no ceiling shows, as in the target. It has
  plaster walls, skirting, an oak floor and a window on the left.
- **Light**: a large soft area light high behind the camera (key), a weaker window light from the left, a
  low sun and a dim world. Light from above and in front is what puts the underside of the top in shade
  while the back stays evenly lit.
- **Colour management**: Khronos PBR Neutral at exposure −2. AgX bleached the bright oak towards pink. Three.js
  has the same curve (`NeutralToneMapping`, r162 and later), which matters for phase 3.
- **Material grading**: Oak Veneer 02 desaturated (0.4) and graded with grain contrast 1.1. As shipped it is
  peach and its grain too faint for the target. The plank floor is lightened (×1.7) and desaturated (0.4).
- **Measured against the target** (mean sRGB of matching regions): back panel 199/160/119 vs 192/162/130,
  wall 201/184/163 vs 194/180/164, floor 172/142/112 vs 193/166/139, under the top 165/117/67 vs 141/105/70.

Gate: met at phone size. The underside of the top is in shade, the back corners and sides fall off softly,
the plinth shadow and bevel highlights read at the floor contact, and the grain runs the length of every board.

Remaining differences from the target:

- The target draws the wardrobe taller than 230 × 200 cm allows (about 1.28 : 1 on screen, against 1.15 : 1 at its
  true proportions). It was probably generated, not photographed. The benchmark keeps the product's real
  proportions.
- The target has sun streaks across the left wall and floor. The benchmark has the window, but no blind or
  mullion pattern to cast them.
- Under the top, the benchmark is lighter than the target (165 against 141), and the floor is a little darker
  (172 against 193).
- The target's grain is a little more pronounced at phone size.

## Phase 2 — shared app geometry and materials

Owner: frontend/rendering engineer. Mobile Engineer verifies mobile interaction.

1. Replace procedural oak for the prototype finish with colour, normal, and roughness maps. Colour maps use sRGB; normal and roughness maps are linear data. Use APIs appropriate to the pinned Three.js version or the chosen upgraded version.
2. Generate UVs from physical panel dimensions instead of stretching one texture over every face. Rotate grain appropriately for horizontal and vertical boards; use deterministic per-board offsets across rebuilds.
3. Add restrained bevels to visible panel edges. Keep nominal dimensions, joins, hit regions, shaped panels, and fitting calculations consistent.
4. Share assets and material parameters between the interactive and photographic renderers. Cache textures and dispose them according to ownership; avoid reloading them on every cabinet rebuild.
5. Build a presentation room/backdrop that follows cabinet bounds. Define how it behaves when a user-created studio is present; avoid duplicate floors and keep real studio openings meaningful.
6. Retain editing overlays for interactive use. Exclude ruler lines, hit meshes, gradient AO planes, fake contact shadows, and highlight overlays from the physically rendered scene to avoid baked-looking artefacts or double shading. Composite required UI separately.

Deliverable: app screenshots of the benchmark scene with improved materials and edges; editing remains functional. Gate: no stretched grain, unwanted floor seams on panels, dimension drift, or new interaction failures.

### Phase 2 results (2026-10-12)

[Comparison](realism-reference/phase2-compare.jpg): target, the app before, the app now, and the Cycles
benchmark; [furnished wardrobe](realism-reference/phase2-furnished.jpg). Default phone view, 393 × 852 at 3×.

Done:

- **Photographed materials** (`wood-textures.ts`). The veneer's colour, roughness and OpenGL normal maps load once
  per page and are graded on a canvas. The colour becomes warm grain near white with 2.2 times the contrast, so
  each finish colour tints it. One shared set per editor (`viewport-resources.js`) serves every board, so the
  GPU holds one copy. Each texture starts as one neutral pixel; an empty texture would sample black. Where
  images cannot load, boards show their plain finish colour.
- **True-scale, per-board UVs** (`board-geometry.ts`). One UV unit is the 1 m veneer tile. The grain runs along
  the board's longer front-view edge: up sides and backs, across tops, shelves, drawer fronts and plinths. Each
  board's offset comes from where it stands, so it keeps its figure across rebuilds. Shaped boards (extrusions)
  get the same mapping.
- **Eased edges**: wood boards are 1.5 mm rounded boxes of the same nominal size. Joins, hit meshes,
  measurements and fitting calculations are unchanged. Shaped (extruded) boards are not bevelled yet.
- **Floors**: the room floor and the showroom floor use the Oak Wood Planks maps at 1.2 m, graded to 72 % of
  their colour.
- **Light**, following the benchmark: the key now comes mostly from the front and a little above. The back is
  evenly lit with a soft shade under the top, instead of a hard patch of sun cut by a side panel. Hemisphere
  fill is 0.42, tone-mapping exposure 0.76.

Measured in the default phone view against the target: back panel 207/172/131 vs 192/162/130; under the top
158/125/87 vs 141/105/70; room floor 205/173/143 vs 193/166/139.

Checks: `npm run check` (354 tests), check-studio, check-mobile and check-desktop-regression pass. Software-GL
frame rate (Playwright, SwiftShader) is 24 / 23 fps at 768 × 1024 / 1440 × 900, against 26.5 / 25.5 before.
That is about 9 % slower. Not measured on a real phone.

Not done, or different from the plan:

- **No presentation backdrop.** Without a room, the app still shows a CSS background and a showroom floor
  fading into it, where the target shows a lit wall. This is the largest remaining gap in the default view.
  It needs a decision on how a backdrop behaves with several wardrobes at different angles and when orbiting
  behind them.
- **Framing**: the app's default view leaves the wardrobe smaller and seen slightly from one side and above, so
  level lines read as slanted. Composition was left alone, as the handoff asks.
- **The phase 3 exclusions** (rulers, hit meshes, gradient AO planes, contact shadows, highlights) still belong
  to the raster renderer; they matter once a path tracer is added.
- **Tone mapping** is still ACES: Three.js r128 has no neutral curve. Matching the benchmark's Khronos PBR
  Neutral needs r162 or later. That is part of phase 3's upgrade decision.

## Phase 3 — browser path-tracing spike

Owner: frontend/rendering engineer; Test Engineer collects measurements.

1. Choose and pin a tracer release after reviewing its current documentation, dependencies, supported renderer/backend, and Safari requirements. Do not assume compatibility with Three.js r128 or universal WebGPU availability.
2. If an upgrade is required, isolate it first. Update Three.js and types together, audit colour management, lighting, shadow APIs, custom shaders, examples imports, and geometry behaviour. Record the compatibility decision.
3. Feed generated geometry and materials into the tracer. Use the same camera and scene as the benchmark. Preserve a fast raster preview.
4. Reset accumulated samples when geometry, material, light, camera, doors, or visibility change. Refine only after motion settles; wall-lowering and cabinet-occlusion animations must also finish or be given a fixed preview policy.
5. Cancel or pause photographic work immediately when interaction resumes. Prototype reduced render resolution/sample budgets, then measure quality rather than guessing sample counts.
6. Provide fallback on unsupported devices or render failures. Keep the editor usable and release GPU resources when previews close or the editor unmounts.

Deliverable: same-scene raster-versus-path-traced images, selected versions, limitations, and actual phone measurements. Gate: a visible realism gain and acceptable device performance.

Proposed acceptance budgets, to validate during the spike: at least 30 FPS during editing on the test iPhone; useful settled preview within 3 seconds; a cleaner preview within 10 seconds; no crashes, accumulating resource growth, or severe sustained-use slowdown during a 10-minute session. These are targets, not measured results or promises. Report resolution, phone model, iOS/Safari version, scene complexity, and sampling settings with every timing.

## Phase 4 — production decision

Owner: Orchestrator with rendering and mobile engineers.

Choose browser refinement if it passes both visual and device gates. If it fails, design a server-rendered preview using Blender Cycles on a supported rendering host. Evaluate cost and turnaround before deployment.

For the server route, Backend Engineer and API Designer define a versioned render request from the project snapshot and camera. Security Reviewer validates request limits and asset access. SRE defines job status, failure handling, cache lifetime, and monitoring. Reuse jobs for identical snapshots, discard stale results after edits, and preserve responsive editing while a render runs. Existing web hosting must not be assumed to support Blender or GPU workloads.

Deliverable: documented route decision, measured evidence, implementation scope, and remaining costs/constraints. Final production integration is contingent on that decision.

## Verification and completion

Test scenes: empty benchmark; shelves/dividers; open and closed doors; shaped top; multiple cabinets; a user-created room. Check front and oblique cameras and ensure measurements, dragging, selection, undo/redo, and room visibility still work.

Use existing checks appropriate to changed code: `npm run typecheck`, `npm run typecheck:editor`, `npm test`, `npm run build`, and architecture/boundary checks for new modules. Add targeted tests for shared scene extraction, accumulation invalidation, and lifecycle handling where needed. Playwright screenshots support comparison but do not replace a physical iPhone GPU test.

Completion requires a reproducible photographic benchmark, an app preview that visibly improves the intended material/light cues, preserved editor behaviour, a verified device/fallback strategy, and documented assets and rendering settings. Passing code tests or changing UI spacing alone is insufficient.

## Start here

The next implementer should first inspect the current working tree and repository instructions, then execute Phase 1. Existing unrelated edits were present during investigation; preserve them. Do not start a broad Three.js upgrade or server build before the benchmark and compatibility spike establish why they are needed.
