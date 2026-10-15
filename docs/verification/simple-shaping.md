# Wardrobe shaping follows the ceiling interaction

The model shows one row of profile points and one movable insertion cursor.
Front controls show from the front; orbiting behind reveals the rear controls.
While a point moves, only its captured handle and relevant measurements remain.
Both profiles, horizontal movement and corner width edits remain supported.
Shape retains the 75% model / 25% drawer split; Resize remains 50/50.

Drag the single `+` along the top to choose an insertion position. Releasing it
after movement only places the cursor. Tap it to insert a point. Cancelling
restores the previous cursor position. Left/right arrows move the cursor;
Enter/Space insert. Cursor movement changes neither the design nor history.

`splitPanel` accepts an optional position while preserving the existing midpoint
default, minimum panel spans, front slope and independent rear slope.

Validation: `npm run check` passes 715 tests. The shape browser regression covers
mouse and touch input, portrait and landscape, cursor movement/cancellation,
insertion, repeated edits, undo/redo, orbit to the rear, independent rear heights,
width changes, interior joins, numeric edits, templates and explicit close.
The stepped ceiling scenario was also checked at 375 and 1440 px: four visible
profile points, one `+`, only one handle during a point drag, restored on cancel.

[Phone](simple-shaping/mobile.png) · [Desktop](simple-shaping/desktop.png).
Physical iPhone Safari was not tested; browser verification uses Chromium.
