# Make: one piece, every part, every measurement

Select a wardrobe or cabinet in Furniture and press **Make** in its toolbar (between Fronts and More). Make takes that
piece down to the boards it is cut from, inside the editor: the same view, camera, gestures, light, top pills, bottom
toolbar and panels as everywhere else. It reads the design and changes one thing only, how the piece is put together
(joints and back), as one undo step. **Done**, Escape, or Studio | Furniture put the editor back as it was.

## What a person sees

- **The piece alone, drawn from its parts.** Its boards replace the room in the editor's 3D view, at the piece's own
  place. Every board is one mesh, from `cabinetBoards`, so what is on screen is the cutting list, plus the drawer boxes
  Make adds for the runners. Every hole is a dark ring at its mouth; handles, hanging rails, runners, legs, hangers and
  wall brackets are drawn in metal. Drag turns the view, right-drag or shift-drag pans, two fingers pinch and pan, the
  wheel zooms: the editor's own camera code, unchanged.
- **A drawing, by default**: the Lines look draws the piece as an assembly manual does, on a sheet of paper (the
  editor's panel colour) with ink outlines of a steady width (Three's thick lines) and unshaded boards; hardware in grey.
  Material and X-ray are in View.
- **Every measurement on show**, written over the view as the editor writes its own (hairlines, white rounded labels):
  rank 1 the piece, rank 2 its openings and fronts (a column of fronts measured across once, every front up its side),
  rank 3 the part picked. Where each of a part's boards sits is a running dimension: one line up from the floor (or
  across from the left face) with a tick at each board and its figure beside that tick. A label that would overlap another waits
  until the view turns; a measurement across the inside shows only while its plane faces the viewer.
- **The toolbar holds Make's tools:** Done, Take apart (the boards move away from what they touch; the camera backs off
  to keep them in view), Doors (solid, or dashed outlines), Sizes, View (3D, Front, Side, Top; Lines, Material, X-ray;
  Open doors, which swings doors on their hinges and slides drawers out on their runners; part numbers), Parts.
- **A tap picks a part.** The rest fades, the measurements switch to it, and the editor's panel (a bottom sheet on a
  phone) shows its size, decor, cut size after edge banding (0, 0.4, 1 or 2 mm, remembered in the browser), its flat
  drawing with every hole (a ring on the face up, filled right through, dashed from the face under it, a tick in an
  edge), grooves, hole positions from the corner in millimetres, holes counted by size, and Previous / Next.
- **Parts** opens the panel's four tabs:
  - **Parts**: every part, numbered; save the drawings; the full (paid) drawing set.
  - **Hardware**: Joints (Screws, Cams, Dowels) and Back (Nailed, Grooved), saved with the design; the drilling check
    (holes running into each other, too near an edge, through the far face, meeting inside); everything to buy, counted.
  - **Steps**: the assembly as a film, in the editor's own view. Every part starts laid flat on the floor in front of
    the piece (nothing appears from nowhere); a directed camera opens on the parts, looks down on the drilling, stands
    back as each board is lifted, stood up and carried in (one after another, the base before the sides, shelves from
    the bottom up), then fixes them joint by joint, and ends going round the finished piece. Dragging or
    zooming takes the camera; Follow gives it back. Each step (plinth; base and sides; partitions; top;
    back; inside; drawers; doors and fronts; fixing to the wall) drills its holes one after another (a drill bit going
    in and out, the hole left behind), puts in what goes in before the boards come together (a cam's bolt into the
    face board, dowels into a board's end, hinge cups into the back of each door; into a board waiting on the floor, its
    drilled face turned up, or one already standing), brings its boards in from where they wait (shelf pins and hinge
    plates pushed in first), then fixes them **one joint at a time**
    (`make-fixing.ts`): the fittings going in through one board from one side, split where they are far apart. For each
    joint the camera comes close and looks across the way they go in (never down it), every fastener grows into view
    at the end of a dashed line into its ringed hole, a callout counts what goes in ("×3", the screw, 7 × 50 mm), and
    they go in one after another: screws turning, each cam pushed home and then turned half round onto its bolt,
    nails driven. Every part in a callout is named (translated). The parts a step adds are
    picked out and numbered over the view while they come in. Play / pause (Space), a scrub bar (the editor's
    slider), the time, Previous / Next step (the arrows), and every step as a chapter with its start time. The view
    turns and zooms while it plays; the player stays open.
  - **Cutting**: every stock sheet (2800 × 2070 mm, 10 mm trim, 4 mm kerf) per decor and thickness with its parts on
    it and how much is used, parts longer than a sheet, and the edge banding to buy; save the cut list (CSV).
- **Saving** the drawings (A3 PDF: parts six to a page with holes measured, the stock sheets, hardware and steps) or the
  cut list (CSV a panel saw or optimiser takes) is part of the paid drawing set: the same price and 24-hour pass.

## How the piece goes together (domain, centimetres; holes in millimetres)

- `findJoints`: every place one board's edge meets another's face. Doors, fronts, backs, adjustable shelves and a top
  set at a slope are not joined there.
- A top set at a slope (`tiltOf`) is screwed down into every side and partition under it: connector screws Ø7 straight
  down through it in the upright's own plane, whatever the joint system (a cam or dowel cannot sit square to a sloped
  edge). Its holes are marked along the slope on its drawing; it is measured along the slope, through its thickness and
  up to each end, and it waits on the floor levelled.
- `jointFittings`: connectors 5 cm in from each end of a joint and no more than 30 cm apart. Confirmat Ø7 through the
  face board, Ø5 × 45 pilot in the edge; cam Ø15 × 12.5 in the edge board 34 mm from the joint, bolt Ø5 × 11, Ø8 × 34;
  dowels Ø8 × 12 / × 25. Plinths are screwed (Ø4, pilot Ø2.5 × 30). A board joined from both faces at one place moves
  the second joint's connectors 32 mm along, so they never meet inside it.
- `backFixing`: nails every 15 cm into each board the back touches, or a groove in each.
- `frontHardware`: hinges by door height as the drawing set counts them (≤ 900 mm 2, ≤ 1600 3, ≤ 2000 4, else 5), only
  as high as the upright the door hangs from; cups Ø35 × 13 22.5 mm from the hinge edge, plates on the System 32 line
  (37 mm in) 32 mm apart; nothing drilled in glass. Handles 128 mm; runners on the uprights; four shelf pins under each
  adjustable shelf in rows of five; rails 4 mm shorter than the bay with an end support each side; legs, hangers and
  wall brackets as the hardware list has them.
- `drawerBoxes`: two sides and two ends 18 mm on a 6 mm bottom, 12.5 mm clear of each upright, as long as the runner,
  clear of the boards above and below.
- Parts: identical boards are one part; boards drilled differently are separate parts, unless one turned end for end or
  over matches the other (a turn that would move a banded edge is not allowed, so a carcass side stays handed).

## Where the code is

| Layer | File | What it owns |
|---|---|---|
| Domain | `make/make-parts.ts` | `makePiece`: boards, parts, holes, grooves, fittings, steps, buy list, checks, motions; `cutWithBand` |
| Domain | `make/make-joints.ts`, `make-hardware.ts` | Joints and connectors, the back; hinges, handles, runners, pins, rails, legs; drawer boxes; door and drawer motion |
| Domain | `make/make-assembly.ts` | Holes on a flat board, drilling signatures, assembly steps, buy list, drilling checks |
| Domain | `make/make-cut-layout.ts` | Stock sheets, strips, kerf, trim, grain; edge banding metres |
| Domain | `make/make-timeline.ts` | The film: each step's drill, place and fix phases in seconds; what is where at any time (pure) |
| Domain | `make/make-fixing.ts` | Where and which way each fitting goes in, and a step's fittings gathered into joints fixed in turn |
| Domain | `make/make-construction.ts`, `make/make-measures.ts` | Joint system and back fixing; ranked measurements, take apart |
| Application | `commands/make-commands.ts` | `setConstruction`: one undo step, defaults never written down |
| Presentation | `make/make-3d.ts`, `make-fittings-3d.ts` | Boards, holes and hardware on `MAKE_LAYER`; looks, selection, take apart, open, the film's boards |
| Presentation | `make/make-play-3d.ts`, `make-player.ts` | Drill bits and fasteners moving in the film; the player (time, play, seek, chapters) |
| Presentation | `make/make-director.ts` | The film's shots, fitted with the editor's own framing and glided between, a function of time |
| Domain | `make/make-staging.ts` | Where each part waits, lying flat on the floor in front of the piece |
| Presentation | `make/make-marks.ts`, `make-sheet.ts` | Measurements and numbers over the view; a part lying flat with its holes |
| Presentation | `make/make-panel.ts`, `make-panel-tabs.ts`, `make-export.ts` | The panel and its tabs; the PDF and CSV |
| Presentation | `make/make-view.ts`, `make-view.ports.d.ts`, `make.css` | Opening and closing inside the editor, tools, keys, the per-frame overlay |
| Wiring | `contextual-actions.js`, `contextual-toolbar.js`, `mount-editor-bindings.js`, `bindings/canvas.js`, `editor-runtime.ts` | The Make tool, its toolbar and View menu, taps, the joint command, paying |

## Decisions (keep them)

- **The film is a function of time.** `make-timeline.ts` says where everything is at any second, so play, pause,
  scrubbing and replay always agree; every hole names its fitting (`Hole.of`) so it is drilled before that goes in.

- **Make is part of the editor.** No screen, bar, pill or panel of its own: the editor's toolbar, panels and camera.
- **The camera is the editor's.** While Make is open the canvas drags nothing; drags turn and taps pick. The camera sees
  only `MAKE_LAYER` (the lights are added to it), so the room needs no hiding.
- **What you see is the cutting list.** Make draws from `pieceBoards`, never from the editor's 3D renderer.
- **Counts agree with the drawing set.** Hinges, runners, rails, pins, handles, legs, hangers and brackets are tested
  against `hardwareList`.
- **Keys stay inside Make**, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
- **Saving is paid**, as part of the technical drawings feature; no price of its own.

## Known limits

- A sloped top is screwed down vertically, not square to its face; its hole rings in 3D lie level on the slope.
- The cut layout lays parts in strips (guillotine), with no free nesting or offcut reuse, on one stock size.
- The film shows hardware 1.6 times its size while it moves (it lands at its size). The camera comes close on each
  joint, not on each single screw; a joint whose screws go in from underneath (a partition through the base) is seen
  from a low side, partly behind the plinth.
- Hole positions follow common practice (System 32, 37 mm line, cups 22.5 mm in), not a particular hardware maker's
  template; the PDF says so. Edge-hole positions are not dimensioned on the drawings.
- Labels keep a 6 px gap; one that would crowd another waits until the view turns.
- Measurements over the view do not follow open doors (a front's sizes hide while it is open).

Tests: `tests/architecture/make.test.ts`, `tests/architecture/make-construction.test.ts`, `tests/architecture/make-timeline.test.ts`,
`tests/contextual-actions.test.cjs`; in a browser, `scripts/check-make.cjs` (part of `npm run check:mobile`).
