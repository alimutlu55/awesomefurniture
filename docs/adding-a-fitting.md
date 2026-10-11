# Adding a fitting kind, a purpose or a trait

Three registries in `src/domain/wardrobe/` define what the app knows about. Everything
else is derived from them. Never copy their contents into another file: the
architecture check (`npm run check:architecture`) fails on hand-written lists of kinds
or possessions.

| You want to add | Registry | Recipe |
|---|---|---|
| A fitting kind (drawer, rail, rack, hook...) | `fittings.ts` | below |
| Something that stands on a shelf (bags, hats...) | `possessions.ts` | [adding a possession](adding-a-possession.md) |
| A general purpose (spare room, linen...) | `purposes.ts` | below |
| A rule shared by several fitting kinds | `fittings.ts`, `FITTING_TRAITS` | below |

## A fitting kind

1. Append one entry to `FITTINGS` in `fittings.ts`. Copy the closest existing kind:
   - **Sizes**: `height`, `min`, `max`, `minWidth`, `minDepth` in centimetres.
   - **`purpose`** it starts with, and **`purposes`** the inspector offers.
   - **`traits`**: which shared rules apply (pulls out, hangs, open shelf...). See `FITTING_TRAITS`.
   - **`planner`**: only where the planner's limits differ from the editor's.
   - **`menu`**: Add item order, group and label; leave it out if users never add it directly.
   - **`zone`**: colour and label in layout diagrams, with a `ZONE_PRIORITY` level.
   - **`icon`**: a 24 px line icon path.
2. Run `npm test`. `tests/architecture/fittings.test.ts` checks the new entry everywhere it is
   used: catalogue, planner limits, saved projects, Add item, zone style, icon.
   The golden Add item snapshots also change, because the menu has a new card. Re-record them
   with `UPDATE_GOLDEN=1 npm test`, check the fixture diff, and say why in the commit.
3. Two things need code, because they are behaviour rather than data:
   - **Capacity**: if it holds possessions, count them in `capacitiesOf` in
     `src/domain/planner/wardrobe-planner.js`. That file is hash-locked: refresh
     `tests/fixtures/editor-baseline.json` and say why in the commit.
   - **3D drawing**: draw it in `src/presentation/viewport/fitting-renderer.ts`.
   - Optional: a card illustration in `src/presentation/editor/product-art.js`; without one
     the card shows a shelf.
4. Check it in the browser on desktop and at phone width.

## A general purpose

1. Append one entry to `GENERAL_PURPOSES` in `purposes.ts`: `key`, `label`, and a `zone`
   style if it should change how the zone looks.
2. Add its key to the `purposes` of every fitting kind that offers it, in `fittings.ts`.
3. Run `npm test`. A purpose that no fitting offers fails the test, because nobody could
   choose it.

## A trait

A trait names something several fitting kinds have in common, so that rules ask
`hasTrait(kind, 'pullout')` instead of listing kinds.

1. Add it to `FITTING_TRAITS` in `fittings.ts` with a one-line description.
2. Add it to the `traits` of each kind that has it.
3. Use `hasTrait(kind, trait)` where the rule needs it.

Add a trait only when more than one place needs it. A list used once, for a local
reason, can stay local; the architecture baseline already lists the older ones.
