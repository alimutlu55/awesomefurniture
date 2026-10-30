# Smart Guides

The editor now has a shared `GuideLine<P>` / `SmartGuide` interface and an editor-scoped SVG overlay. Guides are green lines only: no alignment captions, messages, badges or tooltips are added. Nearby references use dashed lines; exact alignment uses a different stroke. Guides follow the camera and never intercept input.

Coverage includes:

- Interior fitting movement and all four resize edges, with neighbouring edges, centres, equal sizes, boards and cabinet boundaries.
- Shelf/divider movement and gap controls, including levels in adjacent bays.
- Whole-cabinet movement, width/height/depth and elevation controls, with neighbour alignment, contact and equal spacing.
- Rotation relative to room axes, walls and neighbouring cabinets.
- Room Size fields for walls, doors, windows, utilities, fixtures and ceiling profiles.
- Shape-panel corners, edges, whole-profile movement and numeric adjustments, including room boundaries and ceiling/floor levels.
- Wardrobe outline handles and front/rear numeric point and panel fields, with additional room and neighbouring-cabinet references.

Guide queries read the applied geometry. Edit commands automatically align reachable targets within **1 mm (0.1 cm)**, including submillimetre gaps, independently of zoom. They release outside that physical threshold. Collision checks and one-step undo remain in the edit commands. Visual references may show farther away using screen-space distance, but those lines do not pull geometry from beyond 1 mm. Inactive interactions clear the overlay, and disposal removes it. Room/fixture drags that stop before their snap target clear the obsolete alignment guide.

Verification:

- `tests/architecture/smart-guides.test.ts` covers screen-space tolerance, hysteresis, non-mutation, all producer families, profile boundary output, slider cancellation and numeric focus cleanup.
- `tests/architecture/automatic-alignment.test.ts` covers the inclusive 1 mm threshold, release beyond it, submillimetre targets, fitting movement, divider controls, anchored sizing, profile editing, collision rejection and cancellation.
- `scripts/check-interior-drag.cjs` asserts visible guides during actual fitting drags and cleanup on release.
- `scripts/check-item-edge-resize.cjs` asserts line output without text, non-interference with pointers, release cleanup and Size-field guide lifecycle.
- Mouse and touch browser runs cover 375 px and 1440 px viewports.
- The existing precision, undo and collision checks remain in place.

The audit at `docs/smart-guides-audit-2026-10-30.md` records the behavior before these changes.
