# Make: one piece, every part, every measurement

Select a wardrobe or cabinet in Furniture and press **Make** in its toolbar (between Fronts and More). Make shows that
piece taken down to the boards it is cut from. It reads the design and never changes it; **Change in Furniture** and
the back button return to the editor with the same piece selected. The design review with the reasoning behind every
screen is the artifact "FurniDraw Make" (October 2026).

## What a person sees

- **Model.** The piece in drawing lines with every measurement on show. Drag to turn it, scroll or pinch to zoom
  (double-click fits it again), and use the 3D, Front, Side and Top buttons to square it. Doors and fronts are dashed
  phantom outlines so the inside and its measurements stay visible; the Doors button makes them solid.
- **Measurements in ranks.** Rank 1 is the piece (width, height, depth, plinth). Rank 2 is its openings: the clear
  width of each bay, the clear heights between boards up each bay, the depth of a shelf, and every front's size.
  Rank 3 is the part picked: its length, width and thickness, and where each of its boards sits. Labels are placed
  in rank order, and one that would sit on another waits until the model is turned and there is room. Labels are
  13 px on screen at any zoom. Every number follows the editor's units setting (the unit button cycles it).
- **Picking a part.** Tap a board, or its tile in the parts strip. The rest fades, the measurements switch to that
  part, and its flat drawing docks beside the model (under it on a phone) with its finished size, its cut size after
  edge banding (0, 0.4, 1 or 2 mm, remembered in the browser) and its decor. Previous and next step through parts;
  the arrow keys do too; Esc or tapping empty space goes back to every measurement.
- **Take apart.** The slider moves each board away from what it touches (sides out, top up, back behind, shelves and
  fronts forward, plinth down) and writes its size on it.
- **Looks.** Lines, Material (each part in its decor's colour) and X-ray.
- **Drawings.** Every part lying flat, picked from a rail: its face with banded edges and grain, both edges seen end
  on with the thickness, the overall sizes, and a title strip (number, name, quantity, size, decor, edge code, cut
  size). **Full drawing set** opens the existing technical drawings, a paid feature, over Make.

## Where the code is

| Layer | File | What it owns |
|---|---|---|
| Domain | `make/make-parts.ts` | `makePiece`: the piece's boards (`pieceBoards`, the cutting list's own) as numbered parts; identical boards counted together; `decorOf`; `cutWithBand` |
| Domain | `make/make-measures.ts` | `pieceMeasures` (ranks 1 and 2), `partMeasures` (rank 3), `apartOffset`, `heightsAt` for sloped boards |
| Presentation | `make/make-projection.ts` | Views, projection, board faces (sloped outlines as prisms), `paintOrder` (far to near by the axis that separates two boards) |
| Presentation | `make/make-scene.ts` | The model as SVG: boards, ranked measurement labels, size labels when apart, part numbers |
| Presentation | `make/make-sheet.ts` | A part lying flat, and its small tile |
| Presentation | `make/make-model-pane.ts` | Turning, zooming, picking, the dock and the parts strip |
| Presentation | `make/make-view.ts`, `make-view.ports.d.ts`, `make.css`, `make-icons.ts` | The panel, tabs, looks, units, keys |
| Wiring | `domain/wardrobe/contextual-actions.js`, `editor/mount-editor-bindings.js`, `editor/editor-runtime.ts` | The Make tool on every piece of furniture and what it opens |

## Decisions (keep them)

- **What you see is the cutting list.** Make draws from `pieceBoards`, never from the 3D renderer, so every board on
  screen is a line of the cutting list and a part number means the same thing everywhere.
- **Make is a Furniture tool, not a mode.** Studio and Furniture stay the editor's two levels.
- **Drawings and numbers, few words.** New labels go into every locale (`docs/languages.md`).
- **Keys stay inside Make**, so the editor's shortcuts never act on the design behind it.
- **The full drawing set stays paid.** Make's own part sheets are free; the A3 set and its PDF go through the credits gate.

## Known limits

- No drilling, joints, fasteners, hardware list, cut layout on stock boards or assembly steps yet (the next phases in
  the design review).
- Doors are drawn closed, as phantom outlines; they do not swing open.
- The Material look uses each decor's colour, not its texture.
- The edge banding deduction is a viewing choice; the cutting list in the drawing set still gives finished sizes.
- Hanging rails and other bought fittings are not drawn (they are not boards).
- Checked in the browser on desktop and at 375 px; `npm run check:mobile` has no Make scenario yet.

Tests: `tests/architecture/make.test.ts`.
