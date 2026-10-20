# Technical drawings

Menu (⋮) → **Technical drawings** turns the design into a carpenter's drawing set on A3 landscape
sheets: read on screen (zoom with the buttons, two fingers or Ctrl + wheel) and **Save as PDF**: the app
writes the PDF itself, one vector A3 landscape page per sheet, and hands it over (the share sheet on a
phone, a download elsewhere). The file is made from the sheets, never from the screen, so the viewer's
zoom or scroll cannot cut or move it (printing a frame was blank or cropped in iPhone Safari). Every figure is a whole millimetre.

## The set

1. **Plan.** Walls cut and hatched at their real thickness, mitred where they meet; windows as three
   thin lines in their opening, doors and archways as gaps, each with its size, window sill (`Hp`) and lintel height,
   written along its wall. Every piece's footprint with its mark (K1, W1…); wall-hung pieces dashed
   (above the cut); worktops; sink and hob centre lines. Symbols: a cross over a tall unit, a dashed
   cross over a base unit housing an appliance, an arrow out of a unit with drawers or pull-outs, and the
   90° arcs and open leaves for hinged cabinet and wardrobe doors (long dashes), full-extension drawer
   envelopes, and drop-down appliance door envelopes. Room doors show a left-hinged inward 90° swing;
   handing is not stored in the room model. Per wall,
   outside it, dimension strings nearest first: floor-standing pieces with the gaps beside them, wall
   units and shelves, openings and sink/hob centre lines, the wall's whole room-face length. The depth of
   each run from its wall. A piece standing free is set out from what is behind it and the nearer thing
   beside it. Elevation pointers (A, B…) show where each wall elevation is seen from.
2. **One elevation per room wall, including walls without furniture.** The wall face end to end and floor to its height, its
   openings, every piece's front, worktop and plinth, and the end of a run on the next wall that comes into
   the corner (a return, seen from its side). Fronts show how they open: a long-dashed triangle points at
   the hinges (a door at its side, a lift-up flap at its top, an oven or dishwasher door at its bottom);
   drawers and fixed fronts have none; appliances are named. What is behind the fronts is dashed: a
   cupboard's shelves, a wardrobe's fittings, shelves, partitions and rails. Below: pieces and gaps, then
   the wall. Above: wall units, then openings. Left, three tiers from inside out: individual unit and
   zone heights; installation datums (plinth, carcass, worktop, upper unit underside/top, including the
   backsplash gap); one uninterrupted floor-to-ceiling total. Right: each opening's sill and lintel.
   Adjoining walls appear as hatched sections at their actual thickness; exposed room ends carry break
   marks in plan and elevation.
3. **A front elevation of each piece that stands free** (or of every piece when there is no room). These
   use the same three height tiers; without a room, the outer total is the piece height, since no ceiling
   height is known.
4. **A shop sheet for each cabinet and wardrobe** (not sinks, hobs or wall shelves), its views at one scale:
   *Front* with each front's cut size written on it and strings of where the fronts start and end;
   *Inside* with the fronts taken off: every board's front edge, rails, where the fronts go, the clear
   width of each section, the clear heights up each section, the carcass heights, and the line of the
   section; *Section A–A* cut upright through the first section: boards cut through hatched, the side
   beyond, the worktop and the run's plinth for a kitchen unit, the depth build-up (back board, shelf
   setback, carcass front, front) and the shelf heights.
5. **Construction details at 1:2**, at most three to a sheet, only those that apply: fronts at a joint
   between units, plinth and base, worktop edge (kitchens); shelf and door (wardrobes); back panel. They
   are drawn from the same constants the model is built with, to the half millimetre.
6. **Cutting list**: every board of every piece, identical boards counted together, length with the
   grain, width, thickness, material and finish, edge banding (L1 = one long edge, L2 W2 = all four);
   each kitchen run's worktop (with its sink and hob cut-outs named) and plinth; the area of each
   material. Runs on over as many sheets as it needs.
7. **Hardware list**: added up across the job with the marks it goes to: hinges by door height, drawer
   runners at the longest standard length that fits, rails cut to width, the fittings' own hardware,
   shelf supports, handles, legs under kitchen floor units, hangers for wall units, anti-tip brackets for
   tall pieces.

Each sheet lists its pieces (mark, name, width × height × depth, wall, height above the floor) and, in red,
what to check before making: pieces that overlap, a piece in front of a window or door at its height, a
piece running past the end of its wall or taller than it, narrow aisles, and opening envelopes meeting
furniture, walls or radiators. Title block: project, drawing, sheet n of N,
scale, units, date. Scales are the standard ones that fit (1:10, 1:20, 1:25, 1:50…). Line weights follow
ISO 128 (cut 0.5, outlines 0.35, thin 0.18, hidden dashed, centre lines chain, swings long dashes);
dimension figures sit above their line, read from the bottom or the right (ISO 129). Notes move clear of
marks and figures they would sit on.

The boards come from `cabinetBoards` (`cabinet-boards.ts`), which follows the 3D build: the top boards
over the sides (`shapeBoards` under a shaped top), the sides under them, the base board between the sides
from the back board's face to the partition setback, the back between the sides, a wardrobe's plinth as a
frame of rails and bearers, the partitions, the fitting boards (`fittingPanels`), shelves and dividers,
the fronts 3 mm smaller than their openings (`kitchenFrontRect`, `FRONT_GAP`) and wardrobe doors
(`DOOR`). A fitting's hardware, whether its front is the appliance's own (`ownFront`) and whether a
wardrobe drawer has a front cut from board (`innerFront`) are in `fittings.ts`; the registry tests check
them.

How a kitchen front opens is the fitting's `opens` in `src/domain/wardrobe/fittings.ts` (every kind with
the `front` trait has one; the registry test checks it). Door leaves, the fridge/freezer split and shelf
spacing are `hingedLeaves`, `fridgeSplit` and `shelfHeights` in `domain/kitchen/kitchen-fronts.ts`, shared
with the 3D view.

## Aisles and opening envelopes

The plan measures the minimum clear aisle in front of each floor run to another run or wall. It clips
obstacle footprints across the entire front width, so narrow obstructions and rotated layouts are
included, and retains the narrowest reading between the same two runs. Worktop overhangs and radiator
projections count. Floor-level doors and archways remain passable; open room edges have no invented
opposing wall. A zero clearance is labelled and flagged without a zero-length dimension.

`Aisle min` is the closed-furniture walkway width in millimetres. Clearances below 900 mm are flagged
as a project review reference, not a building-code certification. Dashed opening envelopes separately
show required operating space; intersections with static obstacles are flagged. Drawers use the same
full-extension runner length as the hardware schedule. Appliance drop-down reach is its front height.
Room door handing defaults to left-hinged/inward and must be checked on site. Simultaneous operation
of multiple moving fronts is not simulated. Lift-up fronts remain elevation symbols.

## Code

| Concern | Place |
|---|---|
| The drawing model (lines, notes, marks, dimension strings), millimetres | `src/domain/drawings/drawing.ts` |
| Which wall a piece stands against, marks | `src/domain/drawings/room-pieces.ts` (uses `wallAgainst` in `studio/scene-gaps.ts`) |
| Plan, plan symbols, wall elevation | `plan-view.ts`, `plan-symbols.ts`, `wall-elevation.ts` |
| Height tiers and shell end/return sections | `elevation-dimensions.ts`, `shell-boundaries.ts` |
| Opening envelopes, aisle dimensions and operational checks | `plan-operations.ts`, `plan-clearances.ts` |
| A piece's front, its fronts and what is behind them | `piece-front.ts`, `fronts.ts` |
| What to check before making | `checks.ts` |
| Every board of a piece; a piece's shop views | `cabinet-boards.ts`; `unit-detail.ts` |
| Construction details | `construction-details.ts` |
| Cutting list, hardware list | `cutting-list.ts`, `hardware-list.ts` |
| The set of sheets | `technical-drawings.ts` |
| Sheet layout (views side by side at one scale), dimension strings, tables | `src/presentation/drawings/sheet-layout.ts`, `dimension-marks.ts`, `table-marks.ts` |
| Paper marks (shapes, circles, words with ISO pens and fonts) and their SVG | `src/presentation/drawings/paper-marks.ts`, `sheet-marks.ts` |
| The PDF file (vector, Helvetica with its metrics, no library) | `pdf-writer.ts`, `helvetica-metrics.ts` |
| Menu item, viewer, saving the PDF | `src/presentation/drawings/drawings-viewer.ts`, `drawings.css` |

A dimension string is a list of stops along a line, so its figures always add up to its total. The
domain says which side a string stands on and how far it must clear (a wall's thickness); the
presentation sets the paper spacing. Kitchen fronts come from `kitchenFrontRect`
(`domain/kitchen/kitchen-fronts.ts`), the same rule the 3D view uses. A furniture module's `mark`
gives the letter of its pieces' marks.

## Not yet

Configurable room door handing, sloped ceilings on elevations,
worktop joints and cut-out sizes, fillers and scribes, drilling plans (hinge cups, shelf pins on the
32 mm grid), drawer box parts (the runners' maker sizes the box), and material choices beyond the finish
are not drawn. The cutting list gives finished sizes: edge banding is not deducted. A plain kitchen unit
with nothing added has no front, as in the 3D view.
