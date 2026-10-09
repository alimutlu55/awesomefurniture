# Planner

The original capacity and reach engine remains in `wardrobe-planner.js`, behind
`wardrobe-planner.d.ts`. It operates on centimetres and plain data without DOM,
storage or rendering dependencies. Measured box dimensions now feed its minimum
compartment heights and packing capacity through `storage-boxes.ts`.

`wardrobe-composer.ts` adds strict TypeScript whole-cabinet candidate generation,
upper-shelf coordination, bay arrangement, visual ranking and explanations. The
application planner service invokes this composition pass and caches results per
editor. Explicit configurations include measured boxes and design priority.

See [Smart Auto design](../../../docs/smart-auto-design.md) for the pipeline,
validation, scoring trade-offs, verification and limits. Historical original hashes
remain in the baseline fixture; current planner/markup baselines were deliberately
updated for the authorized feature. Edit these modules rather than archived HTML.
