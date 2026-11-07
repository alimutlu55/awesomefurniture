# Smart Guides

The editor has a shared `GuideLine<P>` / `SmartGuide` interface and an editor-scoped SVG overlay. **A guide is drawn only when the part is lined up**, never for "almost": a solid green line (2 CSS px) over a light halo, with a filled dot at each end, so it reads on wood, walls and the floor. There are no captions, badges or tooltips. The legacy exact-contact layer hides while the shared guides are visible. Guides follow the camera and never intercept input.

Only pairs a person means are offered: an edge with an edge (lined up or butting), a centre with a centre. Wardrobes catch neighbours' sides, fronts in line, tops level (bases only when one is off the floor) and wall contact (snapped to, drawn by the measuring assistant's green bar rather than a line across the floor). A slide across the floor never offers a level. There are no centre-to-centre lines between wardrobes and no "equal spacing between walls".

Coverage includes:

- Interior fitting movement and all four resize edges, with neighbouring edges, centres, equal sizes, boards and cabinet boundaries.
- Shelf/divider movement and gap controls, including levels in adjacent bays.
- Whole-cabinet movement, width/height/depth and elevation controls, with neighbour sides, fronts, tops and wall contact.
- Rotation relative to room axes, walls and neighbouring cabinets.
- Room Size fields for walls, doors, windows, utilities, fixtures and ceiling profiles.
- Shape-panel corners, edges, whole-profile movement and numeric adjustments, including room boundaries and ceiling/floor levels.
- Wardrobe outline handles and front/rear numeric point and panel fields, with additional room and neighbouring-cabinet references.

Guide queries read the applied geometry. **Dragging catches what the guide shows**: a part snaps when it comes within a few screen pixels of a line (8 px with a mouse, 14 px with a finger; `snapToleranceCm` in `domain/geometry/alignment.ts`), at most 5 cm for a wardrobe in a room and 2 cm inside one. A caught line holds out to 1.6 times that distance, so the small drift as a mouse or finger lets go keeps the alignment, and the part lands exactly on it. A drag starts free: nothing catches until the part has once moved farther than its catch distance, so a part that starts on a line can be nudged off it. Shift (and Alt for fittings) moves freely. Typed values still align only within 1 mm (0.1 cm); wardrobe size sliders catch within a few pixels of their track. Collision checks and one-step undo remain in the edit commands. Inactive interactions clear the overlay, and disposal removes it.

Verification:

- `tests/architecture/smart-guides.test.ts` covers screen-space tolerance, hysteresis, non-mutation, all producer families, profile boundary output, slider cancellation and numeric focus cleanup.
- `tests/architecture/automatic-alignment.test.ts` covers the inclusive 1 mm threshold for typed values, release beyond it, submillimetre targets, fitting movement, divider controls, anchored sizing, profile editing, collision rejection and cancellation.
- `scripts/check-interior-drag.cjs` asserts visible guides during actual fitting drags and cleanup on release.
- `scripts/check-wardrobe-move.cjs` drags a wardrobe next to another with a mouse and a finger: it lands touching with fronts in line despite release drift, and only those two guides show.
- `scripts/check-board-alignment.cjs` asserts a shelf and a divider land on the level and middle their guides show.
- `scripts/check-item-edge-resize.cjs` asserts line output without text, non-interference with pointers, release cleanup and Size-field guide lifecycle.
- Mouse and touch browser runs cover 375 px and 1440 px viewports.
- The existing precision, undo and collision checks remain in place.

The audit at `docs/smart-guides-audit-2026-10-30.md` records the behavior before these changes.
