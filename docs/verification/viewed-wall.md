# Adding wardrobes where the camera faces

The wardrobe picker preserves the current camera view. New wardrobes target
the wall intersected by the camera direction projected onto the floor. Only
room-facing surfaces count, so orbiting outside a room sees through the near
cutaway wall to the intended far wall. If the view is panned beyond the room,
the most directly faced wall is used.

Placement searches only that wall. Default dimensions stay unchanged where
possible, and adapt to smaller spaces through the existing collision, doorway
and ceiling constraints. Failure keeps the picker open without adding a
wardrobe or undo entry. An explicitly selected wall takes precedence; duplicate
and imported-design placement retain their existing behavior.

Validation: `npm run check` passes 711 tests. Domain tests cover all four walls,
outside and inside views, oblique views, panning, narrow walls, an impossible
target with available side walls, and explicit-wall priority.
`scripts/check-viewed-wall-placement.cjs` uses real pointer drags at 375 and
1440 px to face each wall, waits for the picker to settle, adds a wardrobe and
checks its reported wall, size, undo and redo. It runs with `check:mobile`.

Screenshots: [phone](viewed-wall/mobile.png), [desktop](viewed-wall/desktop.png).
Physical iPhone Safari was not tested; browser verification uses Chromium.
