# Direct canvas dimension and shelf gestures

Cabinet dimension pills now act as scrubbers. Drag Width/Depth left or right,
and Height up or down. On stepped/sloped wardrobes each height pill changes its
own front edge while preserving the opposite edge. Upward edits raise the matching rear edge where ceiling clearance allows; direct rear edits remain independent.
Keyboard arrows change a centimetre (Shift: five); Home/End request the range
limits. Physics can stop a request earlier. Interactive pills stay above the
toolbar after camera zoom.

Two touch contacts starting together in the same visible bay select its shelf
gesture. Spread adds independent shelf boards in available space; pinch removes
nearby shelf boards. Each 36 pixels of separation adds/removes one board, up to
eight per gesture. Fitted storage modules and their positions stay unchanged.
The operation can target another visible wardrobe without first selecting it.
Closed doors, different bays, room editing and touches outside bays keep the
existing camera interactions. A third contact cancels the shelf preview.

Previews start from the original design and respect existing wall, neighbour,
ceiling, module-width and board-clearance checks. Returning to the origin restores
the original design. Pointer cancellation, lost capture, Escape or window blur
cancel a preview. A completed gesture takes one undo checkpoint; undo/redo
restore the complete edit. Remaining fingers are drained after release, preventing
an accidental tap or camera move. Shelf boards use the existing document schema
and autosave path.

Chrome steps aside while scrubbing or editing shelves. Supported vibration APIs
provide rate-limited ticks on actual value changes. A committed dimension pill
settles with a 2% bounce; cabinet geometry never scales beyond its physical fit.
Reduced motion disables both vibration and the animation. Unsupported feedback
capabilities do not affect editing.

Validation: `npm run check` passes 724 tests. Command tests cover reversible
previews, one-step history, walls, independent edge heights, contents, sloped
ceilings, other wardrobes and cancellation. Feedback tests cover reduced motion
and unsupported APIs. `scripts/check-tactile-canvas.cjs` runs with `check:mobile`:
portrait/landscape touch, desktop mouse, keyboard, cancellation, shelf spread and
pinch, a third contact, staggered release, persisted local drafts, undo/redo,
outside-bay camera zoom, reachable pills after zoom, and a stepped prepared studio.
The complete existing mobile/desktop regression also passes.

[Phone](tactile-canvas/mobile.png) · [Desktop](tactile-canvas/desktop.png) ·
[Stepped studio](tactile-canvas/studio.png).

Physical iPhone Safari and hardware haptics were not tested. Browser checks use
Chromium with real pointer and touch events.
