# Technical drawings

Menu (⋮) → **Technical drawings** turns the design into a carpenter's drawing set on A3 landscape
sheets: read on screen (zoom with the buttons, two fingers or Ctrl + wheel) and **Save as PDF**
through the browser's print, one A3 page per sheet. Every figure is a whole millimetre.

## The set

1. **Plan.** Walls cut and hatched at their real thickness, mitred where they meet; windows as three
   thin lines in their opening, doors and archways as gaps, each with its size (and a window's sill),
   written along its wall. Every piece's footprint with its mark (K1, W1…); wall-hung pieces dashed
   (above the cut); worktops; sink and hob centre lines. Symbols: a cross over a tall unit, a dashed
   cross over a base unit housing an appliance, an arrow out of a unit with drawers or pull-outs, and the
   doors of tall units and wardrobes drawn open (long dashes) to show the room they need. Per wall,
   outside it, dimension strings nearest first: floor-standing pieces with the gaps beside them, wall
   units and shelves, openings and sink/hob centre lines, the wall's whole room-face length. The depth of
   each run from its wall. A piece standing free is set out from what is behind it and the nearer thing
   beside it. Elevation pointers (A, B…) show where each wall elevation is seen from.
2. **One elevation per wall with furniture.** The wall face end to end and floor to its height, its
   openings, every piece's front, worktop and plinth, and the end of a run on the next wall that comes into
   the corner (a return, seen from its side). Fronts show how they open: a long-dashed triangle points at
   the hinges (a door at its side, a lift-up flap at its top, an oven or dishwasher door at its bottom);
   drawers and fixed fronts have none; appliances are named. What is behind the fronts is dashed: a
   cupboard's shelves, a wardrobe's fittings, shelves, partitions and rails. Below: pieces and gaps, then
   the wall. Above: wall units, then openings. Left: the height of everything from the floor; right: each
   opening's sill and head.
3. **A front elevation of each piece that stands free** (or of every piece when there is no room).

Each sheet lists its pieces (mark, name, width × height × depth, wall, height above the floor) and, in red,
what to check before making: pieces that overlap, a piece in front of a window or door at its height, a
piece running past the end of its wall or taller than it. Title block: project, drawing, sheet n of N,
scale, units, date. Scales are the standard ones that fit (1:10, 1:20, 1:25, 1:50…). Line weights follow
ISO 128 (cut 0.5, outlines 0.35, thin 0.18, hidden dashed, centre lines chain, swings long dashes);
dimension figures sit above their line, read from the bottom or the right (ISO 129). Notes move clear of
marks and figures they would sit on.

How a kitchen front opens is the fitting's `opens` in `src/domain/wardrobe/fittings.ts` (every kind with
the `front` trait has one; the registry test checks it). Door leaves, the fridge/freezer split and shelf
spacing are `hingedLeaves`, `fridgeSplit` and `shelfHeights` in `domain/kitchen/kitchen-fronts.ts`, shared
with the 3D view.

## Code

| Concern | Place |
|---|---|
| The drawing model (lines, notes, marks, dimension strings), millimetres | `src/domain/drawings/drawing.ts` |
| Which wall a piece stands against, marks | `src/domain/drawings/room-pieces.ts` (uses `wallAgainst` in `studio/scene-gaps.ts`) |
| Plan, plan symbols, wall elevation | `plan-view.ts`, `plan-symbols.ts`, `wall-elevation.ts` |
| A piece's front, its fronts and what is behind them | `piece-front.ts`, `fronts.ts` |
| What to check before making | `checks.ts` |
| The set of sheets | `technical-drawings.ts` |
| Sheet layout, scale, SVG, dimension strings | `src/presentation/drawings/sheet-layout.ts`, `sheet-svg.ts`, `dimension-svg.ts` |
| Menu item, viewer, print | `src/presentation/drawings/drawings-viewer.ts`, `drawings.css` |

A dimension string is a list of stops along a line, so its figures always add up to its total. The
domain says which side a string stands on and how far it must clear (a wall's thickness); the
presentation sets the paper spacing. Kitchen fronts come from `kitchenFrontRect`
(`domain/kitchen/kitchen-fronts.ts`), the same rule the 3D view uses. A furniture module's `mark`
gives the letter of its pieces' marks.

## Not yet

Unit details (front, inside and section of each piece at 1:10), schedules (cutting list, hardware) and
room door swings (the room does not store which way a door opens) are the next steps. Sloped ceilings are
not drawn on elevations. Worktop joints, cut-outs, fillers and materials are not noted. A plain kitchen
unit with nothing added has no front, as in the 3D view.
