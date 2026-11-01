# Make: one piece, every part, every measurement

Select a wardrobe or cabinet in Furniture and press **Make** in its toolbar (between Fronts and More). Make takes that
piece down to the boards it is cut from, inside the editor: the same view, camera, gestures, light, top pills, bottom
toolbar and panels as everywhere else. It reads the design and never changes it. **Done**, Escape, or Studio | Furniture
put the editor back as it was.

## What a person sees

- **The piece alone, drawn from its parts.** Its boards replace the room in the editor's 3D view, at the piece's own
  place. Every board is one mesh, from `cabinetBoards`, so what is on screen is the cutting list. Drag turns the view,
  right-drag or shift-drag pans, two fingers pinch and pan, the wheel zooms: the editor's own camera code, unchanged.
- **Every measurement on show**, written over the view as the editor writes its own (hairlines, white rounded labels):
  rank 1 the piece (width, height, depth, plinth), rank 2 its openings (bay widths, clear heights up each bay, a
  shelf's depth, every front's size), rank 3 the part picked (its length, width, thickness and where it sits). Labels
  are placed rank first; one that would overlap another waits until the view turns. A measurement across the inside is
  shown only while its plane faces the viewer, so nothing collapses onto one line when the piece is seen from the side.
- **The toolbar holds Make's tools:** Done, Take apart (the boards move away from what they touch and the camera backs
  off to keep them all in view), Doors (solid, or dashed outlines so the inside shows), Sizes (measurements on or off),
  View (3D, Front, Side, Top through the editor's framing; Lines, Material, X-ray looks; part numbers), Parts.
- **A tap picks a part.** The rest fades, the measurements switch to it, and the editor's panel (a bottom sheet on a
  phone) shows its size, its decor, its cut size after edge banding (0, 0.4, 1 or 2 mm, remembered in the browser),
  its flat drawing, and Previous / Next. Parts lists every part; **Full drawing set** opens the paid technical drawings.

## Where the code is

| Layer | File | What it owns |
|---|---|---|
| Domain | `make/make-parts.ts` | `makePiece`: the piece's boards as numbered parts; identical boards counted together; `decorOf`; `cutWithBand` |
| Domain | `make/make-measures.ts` | `pieceMeasures` (ranks 1 and 2, with the plane each faces), `partMeasures` (rank 3), `apartOffset`, `heightsAt` |
| Presentation | `make/make-3d.ts` | The boards as meshes on `MAKE_LAYER` in the editor's scene; looks; selection; take apart; picking |
| Presentation | `make/make-marks.ts` | Measurements, sizes and part numbers in screen pixels from a camera projector |
| Presentation | `make/make-sheet.ts`, `make-panel.ts` | A part lying flat and its tile; the panel's list and part detail |
| Presentation | `make/make-view.ts`, `make-view.ports.d.ts`, `make.css` | Opening and closing inside the editor, tools, keys, the per-frame overlay |
| Wiring | `contextual-actions.js` (`make` context, `makeViewActions`), `contextual-toolbar.js`, `mount-editor-bindings.js`, `bindings/canvas.js`, `editor-runtime.ts` | The Make tool, its toolbar, and taps on the canvas |

## Decisions (keep them)

- **Make is part of the editor.** No screen, bar, pill or panel of its own: the editor's toolbar, panels and camera.
- **The camera is the editor's.** While Make is open the canvas drags nothing; drags turn and taps pick, exactly as on
  empty space. The camera sees only `MAKE_LAYER` (the lights are added to it), so the room needs no hiding.
- **What you see is the cutting list.** Make draws from `pieceBoards`, never from the editor's 3D renderer.
- **Keys stay inside Make**, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
- **The full drawing set stays paid.**

## Known limits

- No drilling, joints, fasteners, hardware list, cut layout or assembly steps yet.
- Doors are drawn closed (solid or as outlines); they do not swing open.
- The edge banding deduction is a viewing choice; the cutting list in the drawing set gives finished sizes.
- Hanging rails and other bought fittings are not drawn (they are not boards).

Tests: `tests/architecture/make.test.ts`, `tests/contextual-actions.test.cjs`.
