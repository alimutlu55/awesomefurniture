# Professional drawing UX verification

Local fixtures only; saved projects are not loaded or changed. Run Vite on port 5177, then
`npm run check:drawings`. The legacy envelope verification command invokes the same suite.

- Desktop: Layout, Installation, Clearances, checks with location highlight, profiles, cabinet tap,
  label adjustment storage, cabinet detail navigation, upper-plan search, export preview and download.
- 375 px: upper/floor plans, readable cabinet inventory, fit/zoom and closing, no document overflow.
- Touch context: native browser touch input verifies two-finger pinch and cabinet tap.
- `layout.pdf`: actual vector PDF downloaded from the viewer, including separate upper plan,
  elevations and paginated schedules. `details.pdf`: construction/detail and schedule export.
- `print-plan.png`, `print-schedule.png`: PDF pages rendered with Poppler for visual inspection.

The domain suite covers dense L-shaped, U-shaped, island and rotated rooms across three room purposes
and every cabinet/construction detail sheet. It checks all annotations are placed, remain inside the
paper area, avoid one another and avoid dimension figures. Long schedule tests retain all rows at
fixed lettering size. Real gaps/mounting differences remain exact. Rule profiles and door handing
survive project serialization. Label overrides remain local to the browser/geometry snapshot.

References and limitations: [technical drawing policy](../../technical-drawings.md).
