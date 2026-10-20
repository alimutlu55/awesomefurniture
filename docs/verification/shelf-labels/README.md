# Shelf identification in drawings

The supplied PDF identifies K32 as a wall shelf in the schedule, a 2930 × 300 × 30 mm board in
the cutting list, and five shelf brackets in the hardware list. Its shelf geometry was correct;
the mixed inventory and upper view used cabinet-specific headings, and the drawing had no shelf note.

The export now uses Furniture schedule / Item and Upper furniture plan. Shelves carry a Wall shelf
note in plan and elevation. K32 remains its kitchen-item reference, not a cabinet classification.
No model dimensions, mounting positions or hardware were changed.

Verification:

- `npm run check`: 888 tests, boundaries, architecture limits, typechecks and production build.
- Exact K32 regression: one 2930 × 300 × 30 mm board, five brackets, no cabinet shop sheet, shelf
  notes on both views, item classification in the furniture schedule, stable reference.
- Dense shelf/cabinet fixture: all three purposes and all detail annotations placed without overlap.
- `DRAWING_FIXTURE=shelf DRAWING_OUTPUT=docs/verification/shelf-labels npm run check:drawings`
  with Vite on port 5177 verifies the unchanged simple viewer on desktop, 375 px and touch, checks
  the actual schedule/shelf SVG text and downloads the complete PDF.

The PDF and screenshots here use a representative local fixture, not the user's saved project.
