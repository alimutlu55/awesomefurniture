# Canvas selection and pointer ownership

The intermittent deselection failures came from three paths:

- A frame hit on the active wardrobe returned without changing the selection scope. A previously selected item or divider and its editing panel remained active. Frame hits now use the same whole-wardrobe selection transition as selecting another wardrobe.
- Room and divider presses returned before registering their pointers. Divider release returned before removing a pointer registered by another path. Adding a second finger could leave a released pointer in `interactionState.ptrs`, causing later clicks to enter the multi-touch branch and skip selection.
- A cancelled click finishing rotation left `rotationClick` set, consuming the next independent click.

## Ownership rules

The canvas registers every primary press before handing it to a tool. It removes that pointer before handling release, even when the tool returns early. Unregistered releases cannot select or commit anything.

A second finger cancels the current tool preview and transfers both live pointers to the camera. The canvas reacquires capture released by the tool during this transfer. Both release orders must leave the pointer set empty.

Cancellation, unexpected capture loss, window blur and Escape use the shared cancellation lifecycle. It rolls back previews, clears pointer ownership and click suppression, and releases capture. Later releases from that cancelled session are ignored. Normal completion removes ownership before releasing capture, so its `lostpointercapture` event cannot roll back a committed edit.

Divider movement, release and cancellation are dispatched by the canvas. The previous duplicate window handlers were removed. Room and other controls with their own handles retain their own handle bindings.

## Verification

`tests/canvas-selection-lifecycle.test.cjs` exercises production selection and drag implementations with deterministic picking. It covers scope changes, both finger-release orders, rollback after movement, successful single-history commits, unrelated releases and cancelled rotation clicks. `tests/ceiling-selection-camera.test.cjs` checks the transfer from an actual room surface drag to two-finger camera interaction.

Run `npm run check` for tests, type checks, dependency boundaries, architecture rules and the production build.

With Vite running at `http://127.0.0.1:4173`, run `node scripts/check-canvas-selection.cjs`. Set `MOBILE_TEST_URL` for a different Vite origin. The browser check mounts the production editor and uses native mouse/touch input and pointer capture at 375, 844 and 1440 pixels. It is also included in `npm run check:mobile`.

The broader `check-tactile-canvas.cjs` script currently times out at its initial `.scrub-w:visible` wait: it assumes the initial wardrobe is already selected. The same startup condition was verified against the unchanged `2c7e9c5` commit and the fixed code (toolbar context `none`, zero visible width labels). It does not exercise an interaction before failing.

## Two selection layers and interior dragging

The first click selects the furniture without selecting its interior. A second click selects an item, divider, shelf board or section. The furniture can move, rotate or expose array grips only at the furniture layer. Interior selection locks those transforms at both the pointer-routing and gesture boundaries; dragging another part or the frame cannot fall back to moving the furniture.

Thin divider pointer targets overlap adjacent fitting volumes. At the same ray depth the divider wins that overlap, independent of mesh build order; a genuinely closer object still wins. Both selection and drag-start picking use this rule.

Fitting grab offsets and bounds come from `itemGeom`, not mesh positions or `BoxGeometry` parameters. Roof-cut fittings have extruded meshes at the origin and use the same model-based dragging as rectangular fittings. Shelves move vertically and vertical dividers move horizontally, within existing collision, attachment and ceiling constraints.

`node scripts/check-interior-drag.cjs` checks the two layers, movement at the furniture layer, direct divider/shelf/fitting dragging, and furniture locking while an item or section is selected, using touch and mouse in wardrobes and kitchen cabinets. It uses the same Vite origin setting as the selection check and is included in `check:mobile`. Unit regressions cover all catalog fitting kinds, rectangular and roof-cut grabs, gesture-boundary locks and divider picking order.

## Horizontal divider distances

An upright divider's left/right measurements describe its openings to fixed neighbours. Shelves and fittings attached to its faces follow or resize with it, so their touching faces do not reduce these measurements to zero. Measurement and movement share the same contact rule. Fixed upright boards and unattached fittings still bound the distances. The current geometry supplies the bounds, since a saved divider area can terminate on an attached shelf after fitting the divider into place.

Live redraws update both visible distance text and measurement-control values. `tests/dividers.test.cjs` covers two-sided shelf attachments, attached fittings, contact tolerance, stale saved areas, fixed neighbours, and positioning by either distance. Run `INTERIOR_ATTACHED=1 node scripts/check-interior-drag.cjs` against Vite for the attached-shelf layout at 375 and 1440 pixels in wardrobes and kitchen cabinets, including live labels, control values, keyboard positioning and undo. The default check also verifies control values during divider movement without attached parts, exercising the lightweight visual refresh.
