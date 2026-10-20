# Appliance dimensioning verification

The simple viewer still has four controls. The main export now uses exact installation dimensions,
fixture W × D / centre-line callouts, dedicated sink/hob setting-out sheets, fitted-appliance allocation
sheets, and an Appliance schedule. Missing manufacturer templates/niche data remain explicit.

Local fixture: 720 × 500 mm sink, 800 × 520 mm hob over an 800 mm base, oven/microwave tower and
other cabinets in an L-shaped room. These are representative fixtures, not the user's saved project.

Verification:

- `npm run check`: domain/presentation boundaries, architecture limits, typechecks, 897 tests and build.
- Exact wall-face/left datums; all four edge gaps; whole-room rotation; island references; unsupported
  and overhanging fixtures; ambiguous corner host selection; 564 × 600 mm oven bay allocation and
  98 mm bottom FFL; no invented manufacturer sizes; table pagination without lost rows or clipping.
- Dense L/U/island/rotated/shelf/appliance rooms, three purposes and every detail: annotations remain
  placed, inside the paper area, mutually clear and clear of dimension figures.
- Vite port 5177, then `DRAWING_FIXTURE=appliances DRAWING_OUTPUT=docs/verification/appliance-dimensioning npm run check:drawings`:
  desktop, 375 px, touch pinch, all sheets, exact fixture callout text, new sheets and direct PDF export. Centre-line extensions stop before dimension figures.
- `drawings.pdf` is the actual downloaded vector A3 set; `print-*.png` are Poppler renders inspected
  for plan/detail/schedule legibility. Browser screenshots include desktop, mobile and appliance detail.

Manufacturer-dependent dimensions are pending because the project contains no confirmed device
models/templates. The export labels that limitation instead of supplying fabricated precision.
