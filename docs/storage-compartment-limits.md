# Auto design: every compartment has a purpose and limits

Generated recommendations contain no `void` spacer fittings or invented accessory
shelves. Each actual storage fitting has a purpose and physical bounds. Unused cabinet
volume larger than the existing 3 cm technical-sliver threshold is reported and affects
search/ranking; it is not a hard rejection when the requested inventory can be stored.
Manual fittings and the item catalog/inputs remain unchanged.

The finishing step removes alignment spacers, lowers seasonal shelves to their first
clear legal support height, and redistributes short gaps through adjoining fittings
only when catalog, garment clearance and reach rules still pass. Daily gaps must be resolved by storage that serves the listed inventory plus saved
growth. They are never converted to unrequested accessory shelves. Unresolved
rectangles penalize search states; layouts that still need filler are rejected.
Tall upper gaps are subdivided into measured-box shelves; heights, box counts,
packing and saved seasonal allowance are rechecked. Remaining unused volume is reported.

## Height rules (cm)

| Existing storage type | Minimum | Maximum |
| --- | ---: | ---: |
| Drawer | 15 | 30 |
| Small-item drawer | 8 | 18 |
| Accessory shelf | 15 | 65 |
| Folded shelf, including a generic shelf assigned to folded clothes/trousers | 22 | 38 |
| Short hanging | 100 | 120 |
| Long hanging | max(130, saved garment drop + 15) | 195 |
| Trouser pull-out | 65 | 85 |
| Shoe rack | 18 | 35 |
| Seasonal boxes | max(25, rounded-up box height + 3.8) | 65 |
| Pull-out basket | 25 | 45 |
| Pull-down rail | 100 | 120 |

Existing width/depth, shelf support, rail support, reach and pull-down opt-in rules
remain in force. Daily shelf contents must fit below reach; seasonal boxes remain
above it. A tall generic shelf cannot bypass the folded-storage height limit merely
by changing its purpose. The minimum small drawer is now also a search candidate,
so the planner can select a compact valid fitting when the taller bank wastes space.

## Verification — 8 October 2026

`npm run check` passes 168 tests, type checks, architecture boundaries and production
build. The 33-case audit checks 51 proposals, zero hard errors and 56 review findings.
It includes the reported fold-only inventory (12 trousers, 30 folded items, 30 small
items), which now receives complete recommendations without accessory filler.

The previous full-assignment gate caused a regression: it rejected otherwise useful
wardrobes simply because the inventory did not occupy every rectangle. It is replaced
by soft feedback and explicit unused-volume warnings. Real height/reach/capacity and
quality gates remain. Room to Grow spare-space cards remain disabled; growth is part
of the actual category demand. See [demand feedback](planner-demand-feedback.md).

```sh
npm run check
npm run review:planner
node --import tsx scripts/render-planner-thumbnails.mjs docs/verification/planner-review.json
```
