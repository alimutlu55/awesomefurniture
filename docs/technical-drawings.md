# Technical drawings

Menu (⋮) → **Technical drawings** turns the design into a carpenter's drawing set on A3 landscape
sheets: read on screen (zoom with the buttons, two fingers or Ctrl + wheel) and **Save as PDF**
through the browser's print, one A3 page per sheet. Every figure is a whole millimetre.

## The set

1. **Plan.** Walls cut and hatched at their real thickness, mitred where they meet; windows as three
   thin lines in their opening, doors and archways as gaps, each with its size (and a window's sill).
   Every piece's footprint with its mark (K1, W1…); wall-hung pieces dashed (above the cut); worktops;
   sink and hob centre lines. Per wall, outside it, three dimension strings, nearest first: the
   floor-standing pieces with the gaps beside them, the openings and sink/hob centre lines, the wall's
   whole room-face length. The depth of each run from its wall (carcass, worktop overhang). Elevation
   pointers (A, B…) show where each wall elevation is seen from.
2. **One elevation per wall with furniture.** The wall face end to end and floor to its height, its
   openings, every piece's front (doors as leaves, kitchen fronts as built, open fittings), worktop and
   plinth. Below: pieces and gaps, then the wall. Above: wall units, then openings. Left: the height of
   everything from the floor; right: each opening's sill and head.
3. **A front elevation of each piece that stands free** (or of every piece when there is no room).

Each sheet lists its pieces (mark, name, width × height × depth, wall, height above the floor) and has a
title block (project, drawing, sheet n of N, scale, units, date). Scales are the standard ones that fit
(1:10, 1:20, 1:25, 1:50…). Line weights follow ISO 128 (cut 0.5, outlines 0.35, thin 0.18, hidden dashed,
centre lines chain); dimension figures sit above their line, read from the bottom or the right (ISO 129).

## Code

| Concern | Place |
|---|---|
| The drawing model (lines, notes, marks, dimension strings), millimetres | `src/domain/drawings/drawing.ts` |
| Which wall a piece stands against, marks | `src/domain/drawings/room-pieces.ts` (uses `wallAgainst` in `studio/scene-gaps.ts`) |
| Plan, wall elevation, a piece's front | `plan-view.ts`, `wall-elevation.ts`, `piece-front.ts` |
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
door swings (the room does not store which way a door opens) are the next steps. Sloped ceilings are
not drawn on elevations. Runs that turn a corner are dimensioned per wall.
