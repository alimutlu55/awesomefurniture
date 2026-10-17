# Millwork precision and contextual dimensions

Audit of dimensional accuracy (bays, board deductions, slopes, clearances) and of the dimension
overlay, with what was fixed and what is left. Branch `feature/millwork-precision`, October 2026.

## Rules now in force

| Rule | Where |
|---|---|
| Bays are whole millimetres; `Σ bays + (n + 1) × 1.8 = W` exactly, for any width, bay count and weighting | `sectionWidths` (`shape/wardrobe-shape.ts`) via `shareMillimetres` (`geometry/millimetres.ts`) |
| Auto design, section split/merge and the kitchen renderer use the same bay widths | `selection-spaces.ts` `partitionOptions`, `section-change-plan.ts`, `kitchen-run-renderer.ts` |
| Every board deduction comes from one module: back board 0.6, partition setback 0.5, fitting setback 1.4 (usable depth `d − 2`), rail 6 cm under the clear top | `src/domain/wardrobe/carcass.ts` |
| No board runs into another (shelves, partitions and base board start on the back board's face) | `carcass.ts`, `frame-geometry.ts`, `fitting-renderer.ts`, `roof-divider.ts` |
| Clearances run to the face of what is really there (fitting, shelf board, top, base), never through it | `wardrobe-rules/clearances.js` |

## Findings

### Precision

1. **Sub-millimetre bays (fixed).** Bays were float weight shares (`200 cm, 3 bays → 64.2666… cm`):
   71% of width/bay combinations gave sub-mm bays, and in 45% the bay widths shown at 0.1 cm did not
   add up to W. Auto design planned on 0.01 mm widths (`64.267`) and placed shelf boards that wide.
2. **Duplicated width formula (fixed).** `layout.js`, `wardrobe-shape.ts`, the kitchen renderer and the
   section-change planner each computed bay widths separately.
3. **Outer W/D labels (fixed)** printed the raw number instead of the shared formatter; the bay hover
   label used `toFixed(1)` ("64.0" vs "64").

### Carcass deductions

4. **Boards inside the back board (fixed).** Shelves, fitting boards, partitions and the base board started
   at z = 0.5 cm while the back board occupies z = 0–0.6: a 1 mm interference along every board.
5. **Scattered literals (fixed).** `d − 2`, `d − 1`, `±0.5`, `−1.5`, `value + 2`, rail `− 6` and radius
   `1.2` were repeated across renderers, measurements, the roof divider and the depth badge.
6. **Preview board schedule (fixed).** Side panels were full height under a top that lies on them (one
   board of overlap at each corner).
7. **Slopes (verified, unchanged).** A sloped top's vertical thickness is `t·√(1 + m²)` (`shapeBoards`),
   clear heights are floored to 0.01 cm, a sloped panel's length is the true hypotenuse with vertical end
   cuts. The planner plans each bay up to the lowest point of the top above it (known gap, CLAUDE.md).

### Clearances

8. **Gaps measured through neighbours (fixed).** A selected fitting's "distance above/below" ran to the
   carcass top and base board through whatever was between (a shelf on a rail fitting showed "102.4 cm"
   below while standing on it). Now `gapAbove`/`gapBelow` are net; the editable badge converts back.
9. **Move preview (fixed)** measured up to `h − 1.8` (the flat outer height, wrong under any shaped top)
   and through neighbours.
10. **Pitch vs clear opening (added).** An open shelf's `H` is its pitch; its clear opening between its own
    boards is now shown beside it ("26 cm clear").
11. **Rail (added).** Rail height against Reach and the drop below it to what is there.
12. **Drawer stack (added).** Whole stack height and the clear height above the stack.
13. **Kitchen elevations (verified).** Plinth 8 + carcass 78 = 86, worktop 4 → work surface 90 cm; wall
    units at 142 cm → 52 cm splashback; wall units are recessed (35 vs 58 cm). Tested.

### Dimension overlay

14. **Unlabelled free-space rulers (fixed):** now W, H, D. Under a slope H reads lowest–tallest and its ruler
    stands where the space is tallest; before, it stood 4 cm from the right edge and could cross the top.
15. **Labels on handles (fixed).** Measurements could sit on item handles, + Add item or each other; a pass
    after placement (`label-deconflict.ts`) moves them beside their line.
16. **Reduced motion (fixed).** Measurement labels inherited `transition-duration: .01ms` on `transform`, so
    each frame's placement became a transition and layout lagged a frame behind.
17. **Outer vs net (added).** Net figures carry a dashed rule; outer sizes keep solid pills on extension lines.

## Focus tiers (as built)

| Focus | Shown |
|---|---|
| Wardrobe (Furniture root) | Outer W, H (left and right on a shaped top), D, Reach line |
| Size / Shape sheet | Outer measurements become controls; Shape adds panel length, angle and step rise per panel |
| Section | Net W, H (lowest–tallest under a slope), D of the selected free space; bay width on hover |
| Fitting | W, H (pitch), D; net gaps above/below; open shelf clear opening, rail height vs Reach and drop, drawer stack |
| Dragging an edge or moving | Only the size being set and the gaps it closes (unchanged behaviour, now net) |

## Behaviour changes to review

- **Golden fixtures re-recorded.** Equal-bay proposals moved by ≤ 0.7 mm; coverage unchanged everywhere.
  The 90 cm wardrobe's best match now has a 31.0 cm bay that takes drawers (cost 915 → 974).
- **Under-stairs default Auto design** now returns one idea (4 bays, every category served, 60% coverage)
  instead of three (best 79%). At 47.8 cm the 4-bay option fits folded stacks it could not at 47.75 cm,
  so it is the only plan serving every requested category, and the planner's existing rule ("never erase
  a feasible category", `inclusivePool` in `selection-planner.ts`) keeps only that one. The rounding is
  right; whether that rule should outweigh 19 points of coverage is a planner decision.

## Left as is

- Wall-unit tops (142 + 70 = 212 cm) sit 3 cm under tall-unit tops (215 cm). Aligning them is a default
  change (elevation 145 → 55 cm splashback); tested as current.
- `cost()` prices side panels at outer height (an estimate, golden-locked).
- Older saves with a pinned fitting width a fraction of a millimetre wider than its now whole-mm bay are
  clamped by the planner (`itemWidth`); not otherwise migrated.
- Shape editing and Size show slope break positions through the existing Shape sheet rulers only; the
  wardrobe root does not show the horizontal slope run.
- Browser checks: `check-contextual-toolbar`, `check-mobile-sheets`, `check-tactile-canvas`,
  `check-first-wall`, `check-front-growth`, `check-roof-divider`, `check-desktop-regression` and
  `check-shape-editing` fail identically on `develop` before these changes.
