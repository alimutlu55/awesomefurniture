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
- **The toolbar holds Make's tools:** Done, Assembly (opens Assembly Studio in one tap), Doors (solid, or dashed outlines), Sizes, View (3D, Front, Side, Top; Lines, Material, X-ray;
  Take apart (with automatic framing), Open doors, which swings doors on their hinges and slides drawers out on their runners; part numbers), Parts.
- **A tap picks a part.** The rest fades, the measurements switch to it, and the editor's panel (a bottom sheet on a
  phone) shows its size, decor, cut size after edge banding (0, 0.4, 1 or 2 mm, remembered in the browser), its flat
  drawing with every hole (a ring on the face up, filled right through, dashed from the face under it, a tick in an
  edge), grooves, hole positions from the corner in millimetres, holes counted by size, and Previous / Next.
- **Parts** opens the panel's three tabs, with an Assembly Studio shortcut:
  - **Parts**: every part, numbered; save the drawings; the full (paid) drawing set.
  - **Hardware**: Joints (Screws, Cams, Dowels) and Back (Nailed, Grooved), saved with the design; the drilling check
    (holes running into each other, too near an edge, through the far face, meeting inside); everything to buy, counted.
  - **Assembly Studio** is a shortcut above the tabs, replacing embedded Steps playback. A part's detail has a
    direct stage link; each Hardware row opens its next relevant stage, using the same playhead.
  - **Cutting**: every stock sheet (2800 × 2070 mm, 10 mm trim, 4 mm kerf) per decor and thickness with its parts on
    it and how much is used, parts longer than a sheet, and the edge banding to buy; save the cut list (CSV).
- **Saving** the drawings (A3 PDF: parts six to a page with holes measured, the stock sheets, the hardware, then the steps
  two to a page, each with the step done and a close-up of a joint taken from the film (make-pictures.ts), its instruction, tools, a drawer's kit, the parts by number, where
  the runners go and what not to do (`make-steps-pdf.ts`); then the assembly plan written out with every joint's set-out) or the
  cut list (CSV a panel saw or optimiser takes) is part of the paid drawing set: the same price and 24-hour pass.

## Assembly Studio

A dedicated full-screen presentation over the editor's **existing canvas and camera**, using the same boards,
materials, hardware, timeline and director. The warm backdrop and contact shadow isolate the furniture; floating
controls reserve only the space they need. Portrait, tablet, desktop and landscape layouts use the editor's camera
fit calculation with measured control bounds. Chapter thumbnails project the actual cut outlines without a second
WebGL renderer. No scene or design edits are made when entering or leaving Studio.

- Play/pause, previous/next, reversible playback, and a continuous seek bar with chapter markers all read the same
  deterministic timeline. Chapters come from the actual piece's nonempty assembly stages.
- Explore pauses at the exact current time. Drag orbits, right-drag pans, two fingers pan and pinch. Tapping a part
  highlights its boards and connecting hardware, frames its current transformed bounds, and shows its dimensions,
  material and stage link. Playback resumes from the same time; the camera glides back to the director.
- Guidance is an optional compact overlay: the current phase, installation guidance, the tools, required boards (by part
  number, a drawer side's hand) and real hardware quantities, a drawer's kit, where the runners go, and what not to do
  (`make-instructions.ts`, `assembly-notes.ts`); then the step written out from the assembly plan (each part going in,
  each joint's set-out, the checks). **Before you start** (method, people, time, tools) is under the chapters. Studio
  opens only when nothing blocks building the piece (buildability.md). The callout over a joint says how its hardware
  goes in. The connection button jumps to a joint close-up. Opening guidance or chapters pauses playback.
- Drawers are built on a mat, front face down, and hooked onto pulled-out runners one at a time
  ([drawer-assembly.md](drawer-assembly.md), The film).
- Playback controls fade to 60% after four seconds without interaction, still readable (3:1 on the lightest backdrop) and in reach; any tap brings them back.
  Keyboard focus keeps controls visible. Space plays/pauses; arrows move between steps. Reduced motion starts paused.
- Back, Escape, or the back arrow restores the previous camera, selected part, panel, look and editing controls.
  Browser Forward reopens Studio. A hidden tab pauses the player. UI gestures never reach the 3D canvas.

## How the piece goes together (domain, centimetres; holes in millimetres)

The order it is built in, the connector each joint takes, the drilling clearances, the screws that hold hardware, the
proof that it can be built and the written plan are in [buildability.md](buildability.md).


- `findJoints`: every place one board's edge meets another's face. Doors, fronts, backs, adjustable shelves and a top
  set at a slope are not joined there.
- A top set at a slope (`tiltOf`) is screwed down into every side and partition under it: connector screws Ø7 straight
  down through it in the upright's own plane, whatever the joint system (a cam or dowel cannot sit square to a sloped
  edge). Its holes are marked along the slope on its drawing; it is measured along the slope, through its thickness and
  up to each end, and it waits on the floor levelled.
- `jointFittings`: connectors 5 cm in from each end of a joint (a quarter of a short one) and no more than 30 cm apart;
  two from 64 mm, one in the middle below. Confirmat Ø7 through the face board, Ø5 × 45 pilot in the edge; cam Ø15 × 12.5
  in the edge board 34 mm from the joint, bolt Ø5 × 11, Ø8 × 34; dowels Ø8 × 12 / × 25. Plinths are screwed (Ø4, pilot
  Ø2.5 × 30). A connector whose holes would come within 2 mm of any hole already set out, in either board and any
  direction, steps along its joint 32 mm at a time until it is clear. Each joint takes the connector it can be made
  with in the build order (`make-sequence.ts`).
- A top or base longer than a sheet is split either side of a partition that runs through it, so each piece is joined
  into the partition's face like a shelf; split plinth rails get a bearer under each base end.
- `backFixing`: nails every 15 cm into each board the back touches, or a groove in each.
  A back larger than a stock sheet (`make/stock-sheet.ts`: 2800 × 2070 mm less 10 mm trim) is split over the
  partition nearest the middle, again until each piece fits (`cabinetBoards`); the pieces meet on the partition's
  centre line, so the partition carries the joint.
- `frontHardware`: hinges by door height as the drawing set counts them (≤ 900 mm 2, ≤ 1600 3, ≤ 2000 4, else 5), only
  as high as the upright the door hangs from; cups Ø35 × 13 22.5 mm from the hinge edge, plates on the System 32 line
  (37 mm in) 32 mm apart; nothing drilled in glass. Handles 128 mm; runners on the uprights; four shelf pins under each
  adjustable shelf in rows of five (one hole right through a partition where two shelves are level either side); rails
  4 mm shorter than the bay with an end support screwed to the upright each side; legs, hangers and wall brackets; the
  sets a fitting names (pull-down rail, trouser rack, basket, flap lift, corner mechanism), an appliance door's kit, a
  fixed panel's screws and a wall shelf's brackets.
- `fixingScrews` (`make-fixings.ts`): the screws every piece of hardware is held by, from its registry entry.
- `drawerBoxes` (`drawer-box.ts`): knock-down drawers on bottom-mounted runners. The front (a wardrobe drawer's own front,
  or a box front behind a kitchen's applied front), two sides between it and a back as wide as the box, and a 6 mm bottom
  in a groove in all four; joined with cam bolts, cams and a dowel at the front, expanding dowels through the back; hooked
  onto the runners at the back and locked at the front. 12.5 mm clear of each upright, as long as the runner. See
  [drawer-assembly.md](drawer-assembly.md).
- Parts: identical boards are one part; boards drilled differently are separate parts, unless one turned end for end or
  over matches the other (a turn that would move a banded edge is not allowed, so a carcass side stays handed).

## Where the code is

| Layer | File | What it owns |
|---|---|---|
| Domain | `make/make-parts.ts` | `makePiece`: boards, parts, holes, grooves, fittings, steps, buy list, checks, motions; `cutWithBand` |
| Domain | `make/make-joints.ts`, `make-hardware.ts` | Joints and connectors, the back; hinges, handles, runners, pins, rails, legs; door and drawer motion |
| Domain | `make/drawer-box.ts`, `drawer-installation.ts`, `drawer-film.ts` | Drawer boxes, their joints, grooves, hook and pin holes and locks; runner screws; the drawers' film (the mat, hooking on) |
| Domain | `make/make-instructions.ts` | Each step's notes: tools, a drawer's kit, runner places, handed parts, what not to do |
| Domain | `make/make-assembly.ts` | Holes on a flat board, drilling signatures, assembly steps, buy list, drilling checks |
| Domain | `make/make-sequence.ts`, `bore-clearance.ts`, `make-fixings.ts` | Build order and the connector per joint; bores in three dimensions; the screws that hold hardware |
| Domain | `make/make-verify.ts`, `assembly-plan.ts`, `stand-up.ts` | The proof a piece can be built; the steps written out; the height needed to stand it up |
| Domain | `make/make-cut-layout.ts` | Stock sheets, strips, kerf, trim, grain; edge banding metres |
| Domain | `make/make-timeline.ts` | The film: each step's drill, place and fix phases in seconds; what is where at any time (pure) |
| Domain | `make/make-fixing.ts` | Where and which way each fitting goes in, and a step's fittings gathered into joints fixed in turn |
| Domain | `make/make-construction.ts`, `make/make-measures.ts` | Joint system and back fixing; ranked measurements, take apart |
| Application | `commands/make-commands.ts` | `setConstruction`: one undo step, defaults never written down |
| Presentation | `make/make-3d.ts`, `make-fittings-3d.ts` | Boards, holes and hardware on `MAKE_LAYER`; looks, selection, take apart, open, the film's boards |
| Presentation | `make/make-play-3d.ts`, `make-player.ts` | Drill bits and fasteners; deterministic forward/reverse playback, seek and chapters |
| Presentation | `make/assembly-studio.ts`, `assembly-studio-controller.ts`, `assembly-preview.ts` | Floating controls, guidance, lifecycle/state restoration, framing and chapter previews |
| Presentation | `make/make-director.ts` | The film's shots, fitted with the editor's own framing and glided between, a function of time |
| Domain | `make/make-staging.ts` | Where each part waits, lying flat on the floor in front of the piece |
| Presentation | `make/make-marks.ts`, `make-sheet.ts` | Measurements and numbers over the view; a part lying flat with its holes |
| Presentation | `make/make-panel.ts`, `make-panel-tabs.ts`, `make-export.ts`, `make-steps-pdf.ts` | The panel and its tabs; the PDF (with its step pages) and CSV |
| Presentation | `make/make-view.ts`, `make-view.ports.d.ts`, `make.css` | Opening and closing inside the editor, tools, keys, the per-frame overlay |
| Presentation | `make/make-gate.ts`, `assembly-plan-text.ts` | The gate into assembly and onto paper, saving; the plan in words for the Studio and the PDF |
| Wiring | `contextual-actions.js`, `contextual-toolbar.js`, `mount-editor-bindings.js`, `bindings/canvas.js`, `editor-runtime.ts` | The Make tool, its toolbar and View menu, taps, the joint command, paying |

## Decisions (keep them)

- **The film builds the way the plan says.** A piece the plan builds lying down goes together on its front edges and is
  stood up after the top and back (buildability.md); a low or hung piece, or one too tall to stand up in its room, is
  built standing.
- **The film is a function of time.** `make-timeline.ts` says where everything is at any second, so play, pause,
  scrubbing and replay always agree; every hole names its fitting (`Hole.of`) so it is drilled before that goes in.

- **Make is part of the editor.** Its technical tools keep the editor toolbar and panels. Assembly Studio temporarily
  replaces that chrome, while sharing the exact same canvas, camera, geometry and assembly engine.
- **The camera is the editor's.** While Make is open the canvas drags nothing; drags turn and taps pick. The camera sees
  only `MAKE_LAYER` (the lights are added to it), so the room needs no hiding.
- **What you see is the cutting list.** Make draws from `pieceBoards`, never from the editor's 3D renderer.
- **Counts agree with the drawing set.** The drawings' hardware list reads Make's buy list: hinges, runners, rails,
  pins, handles, legs, hangers, brackets, the sets mounted whole and every screw that holds them.
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

Tests: `tests/architecture/buildability.test.ts`, `tests/architecture/assembly-plan.test.ts`, `tests/architecture/make.test.ts`, `tests/architecture/make-construction.test.ts`, `tests/architecture/make-timeline.test.ts`,
`tests/architecture/assembly-studio.test.ts`, `tests/contextual-actions.test.cjs`; in a browser, `scripts/check-make.cjs` (part of `npm run check:mobile`).

Assembly Studio browser checks: `npm run check:assembly` (Chromium) and
`STUDIO_BROWSER=webkit node scripts/check-assembly-studio.cjs` (WebKit, including mobile viewport emulation).
Set `MOBILE_TEST_URL` to the running development server (default port 5173 for the Studio script).
These cover portrait, landscape and desktop, playback in both directions, seeking, chapters, guidance, Explore,
Parts/Hardware entry points, browser back/forward, touch targets and restoration. Chromium also dispatches native
two-finger touch input. Device Safari testing remains a separate physical-device check.
