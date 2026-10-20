# Technical drawings

Menu (⋮) → **Technical drawings** opens one sheet at a time. Choose a purpose:

- **Layout**: visible furniture and main sizes, with light overhead outlines.
- **Installation**: exact module positions, services and mounting levels.
- **Clearances**: walkway/work-aisle dimensions, moving fronts and review findings.
- **Cabinet details**: individual shop views, construction details and schedules.

Upper cabinets have a separate labelled plan. The floor plan uses a 1200 mm lower-edge visibility
threshold; this is an explicit application view policy, not a general building cut-plane engine.
**Sheets** opens searchable thumbnails; **Cabinets** opens a readable inventory. Tap a cabinet mark
for its size/location and individual drawing. **Fit drawing** fills the viewer with the drawing;
**Fit page** shows the complete A3 page. Zoom buttons, two-finger pinch and Ctrl + wheel zoom;
one-finger scrolling pans the page.

**Save as PDF** opens a preview with the selected purpose, profile and page count. Export the current
set or current sheet. Every page is vector A3 landscape, made from shared paper marks rather than
screen capture, so viewport cropping and zoom do not affect the output. Schedules wrap at a fixed
readable type size and paginate instead of shrinking into the footer. Every dimension is in whole mm.

Cabinet marks use the furniture prefix plus its persistent cabinet ID. Moving/deleting another
cabinet never renumbers them. Labels and notes avoid geometry, dimension figures and each other;
external labels receive leaders. If an annotation cannot be placed it becomes an explicit drawing
warning. Select a mark to nudge or drag its position, or reset it. Overrides are stored in this
browser for the current geometry snapshot and applied to both screen and PDF. Geometry changes get
a fresh snapshot; overrides are not synced with the project. Private storage failures retain them
for the current session.

## The set

1. **Plan.** Walls cut and hatched at their real thickness, mitred where they meet; windows as three
   thin lines in their opening, doors and archways as gaps, each with its size, window sill (`Hp`) and lintel height,
   written along its wall. Floor-level footprints have stable marks (K1, W9…); upper pieces use light dashed outlines
   and their marks appear on the separate upper plan; worktops; sink and hob centre lines. Symbols: a cross over a tall unit, a dashed
   cross over a base unit housing an appliance, in Clearances, an arrow out of a unit with drawers or pull-outs, and the
   90° arcs and open leaves for hinged cabinet and wardrobe doors (long dashes), full-extension drawer
   envelopes, and drop-down appliance door envelopes. Room doors show a 90° swing only after hinge side and opening direction are confirmed in the door Size panel. Per wall,
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
   the wall. Above: wall units, then openings. Left, three tiers from inside out: one reference cabinet
   stack (preferring a worktop with upper units); key installation levels (plinth, worktop and upper
   underside); one uninterrupted floor-to-ceiling total. Internal board faces, drawer subdivisions and
   unrelated cabinet tops stay on the individual shop sheets rather than crowding the room overview. Right: each opening's sill and lintel.
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

Separate cabinet and review schedules list sizes, mounting heights and findings. The title strip
summarizes the marks and directs readers to those schedules. Review findings cover: pieces that overlap, a piece in front of a window or door at its height, a
piece running past the end of its wall or taller than it, narrow aisles, and opening envelopes meeting
furniture, walls or radiators. Title block: project, drawing, sheet n of N,
scale, units, date. Scales are the standard ones that fit (1:10, 1:20, 1:25, 1:50…). Line weights use
ISO 128 style conventions (cut 0.5, outlines 0.35, thin 0.18, hidden dashed, centre lines chain, swings long dashes);
dimension figures sit above their line, read from the bottom or the right (ISO 129 style). Notes move clear of
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

Aisles distinguish opposing kitchen work runs from general walkways. Perpendicular corner returns
and upper cabinets do not become false opposing runs. Select a named planning profile in Clearances:
NKBA one cook (914 mm walkway / 1067 mm work aisle), NKBA multiple cooks (914 / 1219 mm), or the
project's 900 mm review reference. These are review recommendations, not code certification. Each
finding includes the measured width, reference width, category and affected cabinet marks.

Dashed envelopes separately show operating space. Static collisions and simultaneous moving-front
overlaps are separate findings. Drawers use the hardware schedule's full-extension runner length;
appliance drop-down reach is its front height. Room doors without confirmed handing produce a review
rather than an invented swing. Set left/right hinge and inward/outward direction in Size, viewed from
inside the room; these values persist with the project. Lift-up fronts remain elevation symbols.

Small real gaps and mounting-height differences are retained exactly and reported for review rather
than rounded away. Elevations name the reference stack and finished-floor datum. The review panel
highlights the finding's plan location; the complete list is included in the Review issues schedule.

## Professional references and verification

The implementation applies drawing hierarchy, explicit visibility and separate-purpose views, informed
by [ISO 7519](https://www.iso.org/obp/ui/#iso:std:iso:7519:ed-2:v1:en) and
[Autodesk's view range guidance](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF.htm).
Clearance profiles cite [NKBA planning guidelines 6–7](https://kb.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf).
This is an application drawing policy, not a claim of full ISO conformity or jurisdictional approval.

`npm run check` covers dense L/U/island/rotated rooms, all purpose/detail annotations, stable IDs,
profile distinctions, exact small gaps, confirmed door serialization, local overrides, and long-table
pagination. Run Vite on port 5177, then `npm run check:drawings` for desktop, 375 px and touch-browser
verification and actual PDF download. Evidence is in `docs/verification/professional-drawings/`.

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

Sloped ceilings on elevations,
worktop joints and cut-out sizes, fillers and scribes, drilling plans (hinge cups, shelf pins on the
32 mm grid), drawer box parts (the runners' maker sizes the box), and material choices beyond the finish
are not drawn. The cutting list gives finished sizes: edge banding is not deducted. A plain kitchen unit
with nothing added has no front, as in the 3D view.
