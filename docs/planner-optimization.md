# Auto-design optimization diagnosis

Follow-up: [purposeful cabinet completion](purposeful-wardrobe-layouts.md) corrects
the remaining empty-space policy, adds compartment rearrangement and separates
actual possession capacity from explicit adjustable storage.

The planner was solving conflicting objectives at different stages. A safe layout,
a comfortable layout, an inventory-complete layout, and a visually full cabinet
were being treated as if they were the same thing.

## Reproduced defects and implemented corrections

1. **Best Overall could store fewer possessions than an existing alternative.**
   `rankStoragePlans` prioritized coverage for partial layouts, but
   `selectSpecialists` reordered the pool by comfort/design score first. The same
   inventory-first ranking now selects the reference. Complete layouts still rank
   first; among partial layouts, coverage precedes score and part count.
2. **High counts could erase every recommendation.** Accessibility is divided by
   total requested inventory, so an overfull cabinet inevitably scores poorly even
   if the stored items are reachable. A hard 0.45 floor then removed useful plans.
   If the normal pool is empty, a balanced fallback relaxes quality floors only.
   Geometry, fitting limits, overlap, reach and lift opt-in remain enforced. The
   fallback must serve at least one requested category and explains missed quality
   targets and inventory shortfalls. Empty and wholly unsupported inventories still
   produce no layout.
3. **Preference was mistaken for feasibility.** `modulesFor` rejected a fitting
   when its comfort-weighted benefit was zero. For example, reachable upper shoe
   storage disappeared merely because shoes prefer low shelves. Candidate admission
   now depends on useful capacity; comfort still affects its score.
4. **Coarse heights wasted space and sometimes lost capacity.** The 224 mm shelf
   candidate holds five comfort layers, whereas 228 mm holds six. The next preset
   was 288 mm. Candidates now include density-aware full-stack heights for shelves
   and drawers, and the actual 180 mm minimum shoe fitting, alongside presets.
   Every candidate is checked by the existing physical capacity oracle.
5. **Adding choices could make the answer worse.** The bounded beam can prune an
   older useful path when extra candidates compete for its 32 slots. An initial
   combined search regressed seated lift coverage. Preset and tight-height beams
   now run independently, with separate cache keys, and merge before selection.
   A regression test protects the known seated lift solution.
6. **No-result wording asserted an obsolete requirement.** The explanation for
   an undersized upper box space claimed every compartment must be assigned, even
   though unused space is allowed. That misleading explanation was removed.

## Measured outcomes

These are coverage values from the existing fixtures, including their saved growth
allowances. Coverage combines category proportions and total item counts; it is not
simply the percentage of cabinet volume used.

| Fixture | Previous Best Overall | Updated Best Overall |
| --- | ---: | ---: |
| Mixed default | 83.5% | 90.4% |
| Reported no-shoes inventory | 93.1% | 98.4% |
| Shoe-heavy | 99.1% | 100% |
| Seated with lift | 87.6% | 87.6% |
| 1,000 folded items in 80 cm wardrobe | No recommendation | Valid partial with shortfalls and quality warning |

`npm run check`: 175 tests, architecture boundaries, editor and strict TypeScript
checks, and production build pass. The build retains its bundle-size advisory.
`npm run review:planner`: 33 configurations, 52 proposals, zero hard geometry errors,
59 review findings about unused space, surplus capacity or unserved categories.
The audit applies proposals through real editor commands and checks their geometry.
No new browser interaction was performed for this change.

## What a solid next version should optimize

Use a staged objective: physical validity first; inventory coverage second; then
access, excess capacity, usable leftover geometry, cost and construction simplicity.
Keep alternative trade-offs for specialist cards, with the loss of coverage explicit.
Never improve an occupancy number by inventing possessions or adding filler shelves.

The current changes repair specific failures; the search still cannot prove a
solution is globally optimal. The main remaining search limitations are the small
set of width concepts, early commitment to fitting order, and additive recovery:
recovery can fill gaps but cannot remove a poor earlier choice and repack its bay.
Two beams preserve the previous search policy, not every possible arrangement.
They also increase computation; large cases took about 2.5 seconds in this run.

A next implementation should:

- Generate bay widths from actual capacity transitions and remaining garment demand,
  alongside standard manufacturing widths. Evaluate demand before discarding width
  concepts; the current concept score mostly prefers generic widths.
- Keep candidates that trade coverage, access and contiguous free space without
  being worse on every measure. Preserve a best-known solution while exploring.
- Run bounded remove-and-repack moves over one or two bays when inventory is still
  missing. Accept an edit only after physical validation and comparison with the
  staged objective. Preserve manual fittings and dividers exactly.
- Classify gaps: unreachable clearance, too narrow/short for any fitting, reusable
  space while inventory remains unmet, or reserve after the inventory is served.
  Raw empty volume cannot distinguish these situations.
- Separate “physically impossible” from “no complete solution found within this
  search budget.” Only claim impossibility when the geometry/capacity evidence
  proves it; otherwise show the best partial solution and measured deficits.
- Optionally solve the inverse problem: after satisfying inventory, find a smaller
  cabinet envelope that still fits it. Present this as a separate suggestion;
  never silently change the user's cabinet dimensions.

The useful product question is not “How do we fill every rectangle?” It is
“Which requested possessions remain unstored, and which changes would store them?”
