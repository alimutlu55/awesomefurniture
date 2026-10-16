# Canvas Add item

The selected wardrobe offers Add item in its selected section whenever a free
space at least 15 cm high remains. A tapped thin roof gap falls back to usable
space in that same section. Opening the catalogue updates the target to that
space; it never adds into the thin gap or into another wardrobe.

The entire existing button scales with its projected free space, up to its normal
size. This includes padding, border, icon and text. Label collision calculations
use the scaled bounds. Move, shape, item and divider editing still hide the prompt
where those tools own the canvas.

`tests/wardrobe-add-item-visibility.test.cjs` covers selection, thin roof gaps,
rebuilds, undo and genuinely full sections. `tests/architecture/canvas-add-sizing.test.ts`
covers perspective zoom, narrow/low compartments, and angled views.

Run `node --import tsx scripts/check-canvas-add.cjs` against the production preview.
Optional variables: `CHROME_PATH`, `MOBILE_TEST_URL`. The 375 px case uses native
two-finger pinch input, the 1440 px case uses the mouse wheel. Both open and close
the catalogue and resize a low wardrobe with a divider. Screenshots are written
to `/tmp/wardrobe-canvas-add-{width}.png` and `/tmp/wardrobe-canvas-add-zoom-{width}.png`.
Physical iPhone Safari is not verified by this check.
