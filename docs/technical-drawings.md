# Technical drawings

Menu (⋮) → **Technical drawings** opens the complete drawing set as a scrolling document.
The toolbar contains only zoom out, zoom in, **Save as PDF**, and close. Sheets fill the available
width immediately; one finger scrolls/pans, two fingers pinch to zoom, and Ctrl + wheel zooms on desktop.
**Save as PDF** downloads the complete vector A3 landscape set directly (or opens the phone share
sheet). There are no view tabs, inspector panels, navigation sidebars or export configuration dialogs.

The set includes the main plan, a separate labelled upper-furniture plan, a dedicated clearance plan,
elevations, every cabinet detail, construction details and paginated schedules. The main plan shows exact module/position dimensions and keeps
opening envelopes off the room overview; those appear on the clearance sheet. Upper pieces use a
1200 mm lower-edge visibility threshold, an explicit application view policy.

Cabinet marks use the furniture prefix plus its persistent cabinet ID, so moving/deleting another
cabinet never renumbers them. Automatic annotation placement avoids geometry, dimension figures and
other labels; moved labels receive leaders. Unplaceable annotations become drawing warnings.
Schedules wrap at a fixed readable type size and paginate instead of shrinking into the footer.
Screen and PDF share paper marks; viewport zoom/scroll cannot crop the exported file.

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

**Dimensioning on shop sheets (ISO 129-1 practice).** A string measures what the maker sets out, never every board:
*Front* gives each front's size and its distance from the edges, *Inside* the clear width of each section and the clear height
between boards, *Section A–A* the same clear heights (so the two views always agree) and the depth build-up back to front, and
each view an overall size on its outermost string. Board thicknesses and the joints between fronts are not strings of their own:
they are silent segments (`quiet` in `Dimensions`, ticks kept, no figure) and are stated once in the sheet's legend
(`unitDetailLegend`), together with what each string means. A figure too short for its segment at either end of a string stands
outside the extension line, in line with the string, instead of on a tick. Figures are 3.5 mm (cap height at least 2.5 mm, ISO 3098).
`scripts/render-unit-sheet.mjs <out.png> [wardrobe|two-section|kitchen]` renders a shop sheet for review.

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

## Manufacturing check (fail-closed export)

Before the set is shown or saved, `validateForManufacture` (`domain/drawings/manufacturing-validation.ts`) checks the
model independently of the drawing code. Blocking (critical) findings:

- two pieces in the same place (touching is allowed), a piece taller than its room, a size that is not a real length;
- a board with no real cutting size or reaching outside its piece; bays and boards not adding up exactly to the outer
  width; fittings that intersect or reach above their section's top;
- the cutting list disagreeing with the model, part by part, or two pieces sharing a mark;
- annotations the sheet layout could not place clear of the drawing.

A piece running past the end of its wall is a review finding. The set is made against one model revision (a
fingerprint of the model, printed in every title block); saving a set made from an older revision makes it again.
Every set ends with a **Manufacturing check** sheet. With any blocking finding, every sheet and the PDF are stamped
NOT FOR MANUFACTURE, the viewer says why above the sheets and the button reads **Save review PDF**; otherwise each
sheet says "For manufacture · revision …". `scripts/check-drawing-release.cjs` verifies this in the browser.

## Aisles and opening envelopes

The plan measures the minimum clear aisle in front of each floor run to another run or wall. It clips
obstacle footprints across the entire front width, so narrow obstructions and rotated layouts are
included, and retains the narrowest reading between the same two runs. Worktop overhangs and radiator
projections count. Floor-level doors and archways remain passable; open room edges have no invented
opposing wall. A zero clearance is labelled and flagged without a zero-length dimension.

Aisles distinguish opposing kitchen work runs from general walkways. Perpendicular corner returns
and upper cabinets do not become false opposing runs. The viewer uses the NKBA one-cook planning reference (914 mm walkway / 1067 mm work aisle).
The drawing API also supports multiple cooks (914 / 1219 mm) and a 900 mm project reference. These are review recommendations, not code certification. Each
finding includes the measured width, reference width, category and affected cabinet marks.

Dashed envelopes separately show operating space. Static collisions and simultaneous moving-front
overlaps are separate findings. Drawers use the hardware schedule's full-extension runner length;
appliance drop-down reach is its front height. Room doors without confirmed handing produce a review
rather than an invented swing. Set left/right hinge and inward/outward direction in Size, viewed from
inside the room; these values persist with the project. Lift-up fronts remain elevation symbols.

Small real gaps and mounting-height differences are retained exactly and reported for review rather
than rounded away. Elevations name the reference stack and finished-floor datum. The complete findings are included in the Review issues schedule.

## Professional references and verification

The implementation applies drawing hierarchy, explicit visibility and separate-purpose views, informed
by [ISO 7519](https://www.iso.org/obp/ui/#iso:std:iso:7519:ed-2:v1:en) and
[Autodesk's view range guidance](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF.htm).
Clearance profiles cite [NKBA planning guidelines 6–7](https://kb.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf).
This is an application drawing policy, not a claim of full ISO conformity or jurisdictional approval.

`npm run check` covers dense L/U/island/rotated rooms, all purpose/detail annotations, stable IDs,
profile distinctions, exact small gaps, confirmed door serialization, paper-space overrides, and long-table
pagination. Run Vite on port 5177, then `npm run check:drawings` for desktop, 375 px and touch-browser
verification and direct PDF download. Current viewer evidence is in `docs/verification/simple-drawing-viewer/`;
`professional-drawings/` records the earlier viewer before simplification.

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

Corner cabinet installation widths use `domain/kitchen/corner-widths.ts`, shared with the selected
cabinet's editor rulers. The carcass front line is intersected with the actual perpendicular return
footprints at overlapping heights. The resulting chain gives the exposed face width, then the covered
distance from the corner to the cabinet edge (and handles returns at both ends). No nominal depth or
half-door width is substituted. Plans, elevations and the shop sheet's Front view include these stops;
overall carcass widths, front cutting sizes and cutting lists remain separate. Geometry stays in model
centimetres; printed stops are rounded once to millimetres, then differenced so the chain adds to its total.
The Size tool retains the editable overall width; split face rulers are read-only. Neighbour moves,
depth edits and removal invalidate the selected cabinet's ruler cache when the split changes.

Hinged cupboard leaves intersecting a return are presented as fixed corner cover panels. They have no
handle in the scene, hinge triangle or opening envelope in the drawings, or handle/hinge in the hardware
list. Accessible doors keep their normal handles, as does the working door of a dedicated corner pull-out;
its blind panel is always fixed. Front cutting extents are preserved. This placement-dependent presentation
is recalculated for every cabinet when a neighbour moves or is removed, including unselected cabinets.

Regression checks: `tests/architecture/corner-widths.test.ts` and, with Vite on port 5177,
`node scripts/check-corner-dimensions.mjs` (375 px and desktop).

## Not yet

Sloped ceilings on elevations,
worktop joints and cut-out sizes, fillers and scribes, drilling plans (hinge cups, shelf pins on the
32 mm grid), drawer box parts (the runners' maker sizes the box), and material choices beyond the finish
are not drawn. The cutting list gives finished sizes: edge banding is not deducted. A plain kitchen unit
with nothing added has no front, as in the 3D view.


## Shelves and item references

K references identify kitchen items, including shelves, sinks and hobs; they do not classify an item
as a cabinet. The mixed inventory is named **Furniture schedule**, with an **Item** column, and the
upper view is **Upper furniture plan**. Standalone shelves also carry a **Wall shelf** note in plan
and elevation. They retain their original reference and geometry: one shelf board in the cutting
list and shelf brackets in the hardware list, without a cabinet carcass or cabinet shop sheet.


## Appliance dimensions and setting out

The main exported plan uses installation dimensions automatically; the viewer retains its four
controls. Each worktop sink/hob has a callout with its reference, name, overall W × D, and two centre-line
coordinates from the supporting wall's finished left end and face. Wall left follows that wall's
elevation, so rotated walls retain the same datum. An island uses its worktop run's left/back datum;
without a matching wall/worktop, scene coordinates and rotation are labelled explicitly.

Each sink/hob also has a larger setting-out sheet: a dimensioned overall footprint and a worktop view
with centre-line chains, worktop size/thickness, all four overall edge gaps, model height and mounting
FFL datum. Parent worktops are selected by height and footprint containment, including corner/rotated
cases. Missing worktop support and overall footprints crossing its edge become review issues.

Fitted ovens, microwaves, fridges, dishwashers and other registered appliance fittings get housing
callouts and allocation sheets showing the current bay W × H, left position, bottom FFL and clear
carcass depth. These are designer allocations, not manufacturer body/front or approved niche sizes.
The Appliance schedule collects all references, current dimensions, placement and installation status.
It wraps and paginates using the same fixed lettering as the other schedules.

The model currently has no confirmed manufacturer model/template data. Cut-outs, radii, fixings,
niches, ventilation and service requirements therefore remain explicitly UNCONFIRMED on appliance
sheets, the schedule, review issues and worktop cutting-list references. No cut-out is inferred from
an overall sink/hob footprint. Sink `h` describes its modeled selectable height; mounting `y` is the
worktop datum, not a manufactured bowl-bottom level. Export never changes design geometry.
