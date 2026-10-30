# Smart Guides / Alignment Guides coverage audit

Date: 30 October 2026

Implementation update: the gaps below have been addressed by the shared line-only Smart Guides interface. See [implementation and verification](verification/smart-guides.md). The rest of this document is the historical audit of the prior behavior.

Scope: current local editor source, pointer interaction wiring, alignment calculations, guide rendering, and focused automated checks. No browser session was used; this report establishes implementation coverage rather than pixel visibility in a running build. Application behavior was not changed.

## Finding

Support is inconsistent across interactions. Some paths bypass alignment entirely; some show guides only at effectively exact alignment; others snap correctly but omit the visible guide. Whole-cabinet movement and sizing already have a separate, limited alignment overlay, so they should not be described as having no support.

Visual guides and magnetic snapping need separate treatment. Several existing tests deliberately require preserving every requested millimetre, including a 1 mm gap beside another object. Adding nearby visual guidance need not change the stored position.

## Missing or limited coverage

| Interaction | Current coverage | Evidence and consequence |
| --- | --- | --- |
| Drag an interior fitting, such as a drawer or hanging module | No alignment-guide path; snapping explicitly bypassed | `src/presentation/editor/editor-gestures.js:105` calls `planFreeMove(..., { free: true })`. `src/domain/geometry/wardrobe-rules/movement.js:117` turns this into `snap: false`. Movement previews draw outlines, gaps and dimensions, but the snap-line renderer only consumes item-edge and divider gestures (`src/presentation/viewport/movement-overlays.js:236`). Dragging and click-to-place Move share this preview path. |
| Resize a fitting using its top, bottom, left or right handle | Guide infrastructure exists, but only at effectively exact alignment | `src/presentation/editor/item-resize.js:115` sets `tol = 0`. Targets include matching edges, matching sizes, centring and cabinet boundaries, but a nearby pointer position does not catch them. The shared solver permits only its tiny floating-point epsilon at this tolerance. `snapPxPerCm()` exists at line 106 but is not used to set the tolerance. |
| Drag a horizontal shelf board or vertical divider | Guide infrastructure exists, but only at effectively exact alignment | `src/presentation/editor/divider-drag.js:18` calculates a screen-based tolerance; line 42 passes `tolerance: 0` instead. The calculated tolerance is stored but unused by the move. `Shift` bypasses even this exact-alignment feedback. |
| Resize a fitting or change divider gaps using Size sliders | No alignment-guide state is produced | `src/presentation/editor/mount-editor-bindings.js:36` routes fitting width/height sliders through `setManualItemSize()` and divider gaps through `setDividerClearance()`. `src/presentation/editor/item-resize.js:170` applies manual sizes without `snapItemEdge()` or gesture guide state. These paths do not use the whole-cabinet sizing assistant either. |
| Move an entire wall/ceiling profile in the Shape panel | Snapping exists; visual guides are explicitly cleared | `src/presentation/editor/surface-shape-editor.ts:272` calls `snapMove()`, then line 273 assigns `guides = []`. `src/presentation/editor/surface-shape-snap.ts:71` returns only `dx` and `dy`, so it cannot supply the corresponding guide. |
| Move a profile corner or edge onto room boundaries/levels in the Shape panel | Some snaps have no guide | Corner targets include room/bounds levels, but guides are constructed only from adjacent vertices and neighbour points (`src/presentation/editor/surface-shape-snap.ts:44`). Edge level targets have no `src`, and line 67 emits a guide only when `hit.src` exists. Floor, ceiling and boundary snapping can therefore occur silently. Context floor/ceiling lines remain part of the drawing, but there is no active snap-guide indication for these cases. |
| Drag Size sliders for walls, doors, windows, wall utilities, ceilings or room fixtures | No alignment-guide path in the field edits | `src/presentation/editor/studio-fields.ts:139` wires sliders to `apply()`. Lines 163–187 apply sizes, offsets, sill heights, ceiling depths and profile heights directly, without the drag editors' alignment targets, locks or guide arrays. A door/window or fixture can have guided movement in the viewport and unguided adjustment through these fields. |
| Extend a ceiling shape's depth to the opposite wall | A snap branch explicitly suppresses the guide | `src/presentation/editor/studio-editor.ts:236` offers the opposite-wall target with label `Wall`; line 238 only calls `depthGuide()` when the label is not `Wall`. Other depth targets can produce guides. |
| Drag or resize a whole wardrobe/kitchen unit | Partial visual support already exists; no magnetic catch/hold in these gestures | Movement calls `previewTranslation()` and an exact-contact `wallSnap(..., 0, 0)` (`src/presentation/editor/cabinet-drag.js:149`). It does not call the available `alignSnap()` command. However, the measuring assistant draws front/top alignment lines and centring/contact feedback (`src/presentation/viewport/assist-overlay.ts:92`). Its alignment checks use a fixed 0.5 cm threshold (`src/domain/studio/scene-gaps.ts:30,216`), rather than the zoom-aware tolerance and lock used by room dragging. Size sliders use `createTactileEdits()` and the same assistant, retaining requested millimetres without magnetic hold. |
| Rotate a whole wardrobe/kitchen unit | Angle snapping only; no neighbour-relative angle guide | `src/presentation/editor/cabinet-drag.js:44` rounds to 5° and catches nearby 90° positions. It updates the angle readout, without a parallel/perpendicular relationship guide to another unit or wall in this handler. |

## Existing guide support to retain

- **Room wall movement and corner movement/extension:** `src/presentation/editor/studio-editor.ts:203` uses alignment targets, screen-based tolerance, locks and guide arrays. `Shift` disables these snaps and guides.
- **Door/window/opening movement in the viewport:** `src/presentation/editor/studio-editor.ts:222` aligns along the wall and vertically, producing guides for caught targets. The targets reference other openings on the same wall and wall centring.
- **Ceiling lift, tilt and most depth edits in the viewport:** `src/presentation/editor/studio-editor.ts:232` has targets and guides, subject to the opposite-wall exception above.
- **Room fixture movement along a wall:** `src/presentation/editor/fixture-editor.ts:75` uses a screen-based tolerance, a held target and a guide. Its Size fields follow a separate path.
- **Wardrobe outline handles:** `src/presentation/editor/shape-handle-editing.ts:69` produces horizontal/vertical guides. The candidate scope is local: other points in that profile, cabinet centring and partitions. Outer handles do not receive horizontal alignment targets; room walls and neighbouring cabinets are not candidates here.
- **Shape-panel vertex/edge movement against explicit neighbour points:** guide generation exists when the selected snap retains the source point. Whole-shape movement and boundary-level targets are the exceptions above.
- **Whole-cabinet move/size measuring assistant:** green front/top lines and contact/centring feedback already exist. Coverage is narrower than the generic room and shape drag systems.

## Why current tests do not prove full guide coverage

The shared alignment solver supports nonzero tolerance and a hold multiplier of 1.6 (`src/domain/geometry/alignment.ts:45`). Individual callers decide whether to use it and whether to draw its result.

For example, `tests/architecture/board-alignment.test.ts` calls `alignDividerTo()` directly with tolerance 2. Those tests pass even though the actual divider pointer handler supplies zero. Similarly, tests of `alignSnap()` prove that command works, but the current cabinet pointer handler does not invoke it.

The precision tests are also intentional requirements, not failures: `tests/architecture/millimetre-interaction.test.ts`, `tests/architecture/size-alignment.test.ts` and `tests/item-resize.test.cjs` require gap preservation and no magnetic hold in the relevant gestures.

## Verification

52 existing tests passed across these files:

- `tests/architecture/alignment.test.ts`
- `tests/architecture/board-alignment.test.ts`
- `tests/architecture/size-alignment.test.ts`
- `tests/architecture/studio-alignment.test.ts`
- `tests/architecture/millimetre-interaction.test.ts`
- `tests/architecture/measuring-assistant.test.ts`
- `tests/item-resize.test.cjs`

Additional in-memory assertions confirmed:

1. A profile corner requested at height 259.7 cm snaps to a 260 cm ceiling and returns `guides: []`.
2. A profile edge requested 0.3 cm below that ceiling snaps to it and returns `guides: []`.
3. Whole-profile movement snaps a side to a boundary but returns no guide data.
4. With tolerance zero, a target 1 mm away is absent; the exact target is returned.

## Recommended implementation order

1. Add visual alignment candidates and guide output to interior fitting movement, fitting/divider Size sliders, and whole-profile movement.
2. Give boundary-level and opposite-wall snaps explicit guide geometry.
3. Show nearby alignment assistance for item-edge and divider drags while preserving requested millimetres. Keep any magnetic snapping an explicit interaction policy.
4. Reuse room drag targets and guide rendering for the corresponding room Size sliders.
5. Standardize target coverage and screen-distance thresholds across cabinet movement, sizing and outline editing.
6. Verify pointer handlers and rendered guides together on mouse and touch; command-only alignment tests do not establish end-to-end coverage.
