# Dividers beneath shaped roofs

New vertical dividers fill the open space up to the wardrobe roof. Their top is cut
to the actual underside across both width and depth, including independent front
and rear slopes and the underside of step risers. The picking surface uses the same
cut. Rectangular clearances for fittings remain conservative across the full depth.

The optional saved `editorDivider.roofFit` flag distinguishes this automatic cut
from a flat, explicitly shortened divider. Dividers below shelves stop at the shelf.
Moving an automatic divider into open space restores roof fitting; a shortened
divider keeps its requested height. Older full-height dividers without the flag
are recognised from their existing wanted height and roof contact.

`tests/architecture/roof-divider.test.ts` covers physical roof contact, step risers,
saved sessions, shortened heights, and shelves above dividers. Existing divider
tests cover movement, attachments and collision limits.

Run `node scripts/check-roof-divider.cjs` against a production preview, optionally
with `CHROME_PATH` and `MOBILE_TEST_URL`. It adds a divider beneath different front
and rear heights, changes its height through the shared badge, and undoes the edit
at 375 px and 1440 px. Screenshots go to `/tmp/wardrobe-roof-divider-{width}.png`.
Physical iPhone Safari is not covered by this browser check.
