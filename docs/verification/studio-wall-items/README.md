# Wall-item clearances and utility visibility

Selecting an opening, utility, fixture or furniture standing against a wall measures to the nearest
neighbouring item's edge. The shared door/window gap is visible from either selection. Overlapping
projections do not invent a positive gap. Furniture and fixtures also retain the physical floor
clearances calculated by the shared measuring assistant.

Utility markers keep a 20 px screen size outside the wall, with a leader to their true position.
They remain readable and selectable when a cabinet covers that wall position.

Verified in Chromium at 375 px and 1440 px, and WebKit at 375 px. The existing Chromium touch-drag
and WebKit selection/drag checks also pass with the relocated markers. These are browser simulations,
not physical-device checks.

```sh
node scripts/check-studio-opening-clearances.cjs
node --import tsx scripts/check-studio-wall-items.cjs
node --import tsx scripts/check-studio-2d-mobile.cjs
```

The first check selects both openings, verifies the same 460 mm gap, then moves the window by touch,
verifies the gap updates to 260 mm and undoes the move. The second checks the utility/wardrobe gap
(680 mm), utility/fixture gap (700 mm), and a utility whose wall position is covered by the wardrobe.

| Example | Phone | Desktop |
| --- | --- | --- |
| Door/window gap, window selected | [WebKit](../studio-opening-clearances/webkit-375-window.png) | [Chromium](../studio-opening-clearances/chromium-1440-window.png) |
| Door/window gap, door selected | [WebKit](../studio-opening-clearances/webkit-375-door.png) | [Chromium](../studio-opening-clearances/chromium-1440-door.png) |
| Utility behind a wardrobe | [WebKit](webkit-375-utility-behind-wardrobe.png) | [Chromium](chromium-1440-utility-behind-wardrobe.png) |
| Utility's neighbours | [WebKit](webkit-375-utility-neighbours.png) | [Chromium](chromium-1440-utility-neighbours.png) |
| Wardrobe's neighbour | [WebKit](webkit-375-wardrobe-neighbour.png) | [Chromium](chromium-1440-wardrobe-neighbour.png) |
| Fixture's neighbour | [WebKit](webkit-375-fixture-neighbour.png) | [Chromium](chromium-1440-fixture-neighbour.png) |
