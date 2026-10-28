# Professional kitchen drawing reference

Implementation reference: the three user-supplied sheets dated 15 October 2026:
`1.pdf` plan, `2.pdf` front A, `3.pdf` front B. PDF vector/text content and all three
rendered sheets were reviewed. These PDFs supersede the earlier screenshot's horizontal dimensions.
They specify design and installation intent; they do not supply manufacturer drilling/cut-out templates.

## Scope

The reference establishes drawing capabilities and presentation conventions. Each user's design supplies its own
geometry, components and installation settings. A difference from the reference kitchen is not a defect. No room,
cabinet, service or construction dimension is migrated to match the designer's example.

## Isolated regression example

All equations below are millimetres, using the printed dimensions rather than measured image pixels.

- Horizontal base chain: `580 + 40 + 200 + 627 + 600 + 600 + 600 + 600 + 18 + 250 = 4115`.
- Horizontal upper chain, including the same end clearance:
  `20 + 180 + 609 + 610 + 610 + 18 + 600 + 600 + 600 + 18 + 250 = 4115`.
- Left wall: `350 + 2920 = 3270`.
- Left installation chain: `18 + 716 + 800 + 716 + 400 + 40 + 580 = 3270`.
- Height A: `100 + 780 + 20 + 600 + 38 + 1074 + 100 = 2712`.
- Upper front allocation: `38 + 1074 = 1112`.
- Height B: `100 + 780 + 20 + 600 + 38 + 1174 = 2712`.
- Depth at the left run: `50 + 530 + 20 = 600`.

These values belong only to an isolated regression example. They are not required dimensions for other designs.
The reference's drawer figures `225 + 278 + 278 = 781` also differ by 1 mm from its marked 780 mm allocation;
that ambiguity is not copied into front cutting mathematics. Actual model zones and configured joints determine blanks.

## Reference-to-application coverage

| Reference detail | Application representation |
|---|---|
| Cabinet-by-cabinet front dimension chains | Installation plan dimensions offset from the actual run fronts into the room. Exact finished-wall stops, separate panels, gaps and corner segments remain explicit. |
| Upper cabinet and tall column chain outside wall | Independent upper-height chain, including tall units crossing that level; no union with unrelated base stops. |
| Wall totals and opening datums | Separate outside tiers; structural opening edges retain their finished-face datum. |
| 40 mm corner strip | Optional **Corner strip width** inside the corner cabinet's overall width. Consumes exposed space once; changes actual fixed-strip and door geometry, bill, rulers, plan/elevation and shop sheet together. |
| Separate return/end fillers | **Installation strip** and **End panel** in Add cabinet → Installation parts. Exact size controls; one solid board each. No fictitious storage, handle, hinge or legs on a solid end panel. |
| 18 mm end panels | End-panel width is the panel's actual thickness. Shares a worktop only when adjoining a worktop-bearing run at the same height. |
| 150/200 mm cargo modules | Base width limits allow narrow modules; cargo fitting clear-width limits and resize constraints preserve the actual carcass deduction. Supplier mechanism compatibility remains a procurement check. |
| 50 mm rear allowance, 530 mm carcass, front projection | Actual off-wall position, cabinet depth and worktop projection are separate depth stops. No fixed 50 mm allowance is invented. |
| 350 mm shallow uppers, 580 mm tall units | Actual module footprints, with overhead outlines/crosses on the main plan and a separate upper plan. |
| Sink bowl, tap, hob burners and control bar | Plan symbols inside the actual fixture envelope, turning and scaling with it. Overall symbols are not manufacturer cut-out templates. |
| Appliance labels, centres, housing allocations | Dedicated appliance detail sheets and schedule retain exact finished-wall/worktop datums without a cloud of long callouts over the cabinet plan. |
| Hinged, lift-up, drawer and fixed fronts | Opening symbols follow modeled operation; fixed installation parts have no hinge/handle. Nominal zones and actual front cutting sizes are separate. |
| 100 mm plinth, 780 mm carcass, 20 mm worktop | **Plinth height** and **Worktop thickness** settings. A plinth edit preserves the carcass and fittings, moves the top accordingly, and carries supported fixtures to the new work surface. Plinth list/geometry/detail heights use the same dimension. |
| 18 mm laminate and 19 mm painted MDF | Actual carcass boards retain the 18 mm construction; **Front thickness** sets the finished front assembly explicitly. Selected decor/stock, thickness and cutting list are reported together. Elevations distinguish laminated/other board and lacquered MDF fills, with material legends. |
| Separate upper reveals/boards and mounting levels | Individual solid parts and shelves can be positioned/sized explicitly; elevations show actual underside/top levels and exact component shop sheets. No 38 mm trim is added unless modeled. |
| Fridge front division | **Lower fridge door height** sets the nominal division explicitly; zero retains the existing automatic split. 3D and drawings use the same split and one joint deduction. |
| Fridge ventilation grilles | Optional **Vent grille width/height** defines the purchased outer envelope in the plinth. The 3D/elevation, separate setting-out detail and hardware/material schedules agree. Invalid/incomplete envelopes block manufacture. Outer size never becomes an invented cut-out/free-area rating. |
| Green new, blue retained, red removed/relocated services | Each wall service has an explicit **Installation status**. Dedicated service elevations and schedule use those colours plus textual status. Missing intent stays Unconfirmed. |
| Electrical sockets, switches, water/waste, gas and ducts | Existing wall utilities, exact offset/width/height/sill; service sheets dimension centre lines from finished wall left and FFL. A **Service label** names LED cable outlets or individual connections without guessing electrical function. |
| LED below upper units/shelf | Configured lighting uses shared model centre lines in 3D, elevations and service schedule. Upper lighting is below the unit; it is not drawn at the internal roof. |
| Service setting-out values (e.g. 200, 980, 1335, 1850, 1995 and FFL levels) | Recorded offsets and heights, dimensioned from a named finished-wall/floor datum. Values must be entered for the intended point; the drawing does not infer them from nearby cabinets. |
| Material legend, scale, title block, date, elevation markers | Shared paper marks drive SVG and vector PDF, with material/operation legends, stable cabinet marks, scale and model revision. The reference fixture orders horizontal wall A then left wall B. Existing projects keep their own wall-order references. |
| Review before workshop release | Invalid strip reservation, grille geometry and door divisions are blocking findings. Manufacturer cut-outs, ventilation free area, drilling, driver access/circuits and cable routes require their own confirmed specifications. |

## Precision rules

- Domain dimensions remain centimetres; installation/drawing stops are projected from actual poses and converted
  once to shared millimetre datums. Adjacent printed segments sum exactly to their printed total.
- No designer value is hard-coded into other kitchens. Legacy saves retain their construction unless explicitly edited.
- A corner allocation is `exposed + fixed strip + covered return = overall width`; attaching the strip does not add its width a second time.
- Fixed strips are solid parts. An attached 40 mm strip has a 40 mm blank; a 400 mm nominal moving front with a 3 mm joint has a 397 mm blank.
- Front clearance is deducted once. Two adjacent 600 mm nominal fronts have 597 mm blanks and one 3 mm joint, rather than the previous accidental 6 mm joint.
- The 3D mesh thickness, cutting list and section use the same specified front stock thickness.
- Raw arithmetic floating-point residue is retained until the drawing's shared stop conversion; no image-based scaling changes model geometry.

Editor movement reserves the corner joint throughout the swept path, including large pointer jumps
whose destination is beyond the neighbouring cabinet. Prospective return-leg collision guards are
used only for movement; they are never saved, drawn or included in the cutting list. The stopped
pose is checked again with its actual derived parts, and an overlapping drop is refused. Legacy
overlaps remain visible for review and can be moved apart without pushing further into the stock.
`tests/architecture/corner-collision-sweep.test.ts` covers both hands, arbitrary room rotations,
thicknesses, sideways/vertical jumps and numeric/preview commands. With Vite running,
`node scripts/check-corner-movement.mjs` verifies the isolated example at 375 px and desktop.

## Verification

`tests/architecture/installation-precision.test.ts` checks reference chain closure, exact strips/panels,
front blanks, stock thicknesses, specified fridge divisions, grille envelopes, service intent/datums,
lighting placement, validation, persistence and atomic construction edits.

`tests/architecture/installation-model-datums.test.ts` independently checks different user dimensions,
rotated corner assemblies, unchanged legacy allowances, finished-wall service datums, drawing immutability,
dimension figure collisions and the actual material/hardware of fixed parts.

`scripts/check-installation-plan.mjs` mounts an isolated editor at 375 and 1440 px, changes the strip through the
real numeric field, checks its ruler and undo, opens all technical sheets and downloads the vector PDF.
Run with `node --import tsx`; an optional local project JSON path runs the same checks on that design copy.
`scripts/preview-kitchen-drawings.mjs` exports SVG/PDF previews from a local project copy and asserts that both
the input model and source file are unchanged. These scripts never write to a saved cloud design.
`scripts/installation-drawing-fixture.mjs` is a geometry regression fixture based on the dimension chains;
its service plate and 500 × 60 grille envelopes are explicit examples, not manufacturer details supplied by the designer.

Private project snapshots, supplied PDFs and generated previews live under untracked `output/`; none are application defaults or live-project migrations.
