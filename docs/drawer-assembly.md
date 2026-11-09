# Drawers: how a drawer is built and hung

Every drawer in Make and Assembly Studio is a knock-down drawer box on bottom-mounted runners, built the way flat-pack
drawers are put together (the assembly instructions of common flat-pack wardrobe drawers were the reference). The
construction lives in `src/domain/make/drawer-box.ts`; the runners and locks in `src/domain/hardware/drawer-hardware.ts`.

## The box

| Part | What it is |
|---|---|
| Front | A wardrobe drawer's own front (its inner front) is the box front. A kitchen drawer, whose front is applied over the carcass, gets a box front of its own behind it. |
| Sides | Two 18 mm sides between the front and the back. A side has the bottom's groove at its lower edge and its cams on its inner face, so there is a left and a right side. |
| Back | 18 mm, as wide as the box, against the ends of the sides. |
| Bottom | 6 mm, captured in a groove 12 mm up from the lower edge and 8 mm deep in the front, both sides and the back, cut 1 mm short of each groove's floor (`BOTTOM_PLAY`) so it slides in and is centred with an equal gap each end. Never nailed. |

The box stands 12.5 mm clear of each upright (the runner's room) and 15 mm above the board under it (the runner's foot),
and is as deep as its runner, from the front's face to the back's rear face.
It is as tall as its compartment allows, up to 250 mm and down to 50 mm: a shallow drawer gets a shallow box (one cam a
corner instead of two), never a front with nothing behind it. Beside an in-bay divider, each box side runs on the rail
of the upright next to it, the divider or the cabinet side.

A drawer stack narrower than its bay, with open space beside it (drawers on one side, a trouser pull-out on the other),
has nothing to screw its runners to on that side. It gets its own side there, a divider from the board under the stack
to the one over it, inside the stack's width behind its fronts (`drawerStackSides` in
`src/domain/geometry/shared-board-spans.ts`). The editor draws it, Make builds it, and the boards between the drawers
stop at it. The planner's board count does not include it yet.

## Drawer stacks

Drawers are built as a chest of drawers is: drawers the same width, one above another, at most 5 cm apart with nothing
between them, are one stack (`drawerStacks` in `src/domain/geometry/shared-board-spans.ts`, used by the editor, Make,
the clearances and the planner's board count). A stack has a board under its lowest drawer and one over its highest, and
none between: its drawers run on runners screwed to the uprights either side. Each front covers its drawer's height
and an equal share of the gaps in the stack, so the fronts stand at one even reveal however far apart the drawers were
placed: 3 mm between fronts and 1.5 mm to the boards over and under the stack, the hinge registry's front reveal, as
between doors and kitchen fronts (`innerFront` in `src/domain/wardrobe/carcass.ts`). Drawers alike (width, front, runner) get the same box at the same place behind their fronts, so their sides,
backs, bottoms and fronts are each one part in the cutting list.

## Opening a drawer in the editor

"Open doors" pulls each drawer out as a drawer really moves (`src/domain/wardrobe/drawer-mechanism.ts`, drawn by
`src/presentation/viewport/drawer-slide.ts`). Only the drawer travels: its front, its handle, its box (open at the
top: two sides, the back, the bottom in its groove, and a kitchen drawer's own box front) and the drawer member of each
runner. The boards over and under it, a drawer stack's own side and the cabinet member of each runner, screwed to the
upright, stay with the carcass. The box is the one Make cuts (as deep as its runner, 12.5 mm clear of each upright,
15 mm above the board under it, up to 250 mm tall), and it comes out the runner's open pull from the hardware registry
(70% of the runner's length). A trouser pull-out and a wire basket slide out the same way, under the board over them.

## The steps (Assembly Studio chapters)

| Stage | What happens | Hardware |
|---|---|---|
| `drawer-boxes` | The front lies face down on a soft mat; cam bolts go into its inner face; the bottom goes into its groove at an angle and is swung up, the same gap at both ends. | Cam bolts, 2 a side |
| `drawer-sides` | Dowels go in; each side goes on over the bolts and dowel with the bottom in its groove; the cams are turned to lock. | Cams, 2 a side; one 8 × 35 dowel a side |
| `drawer-back` | The back is hooked over the edge of the bottom, swung into place, and fixed with expanding dowels hammered through it into the sides. | Expanding dowels 8 × 30, 2 a side |
| `drawer-runners` | Each runner's rear peg goes into its 5 mm hole; its front bracket is screwed with two 4 × 12 mm screws in 2.5 mm pilot holes. Nothing is screwed to the drawer. | Runners (a left and a right); 4 × 12 screws, 2 a runner |
| `drawers` | Both runners are pulled out; a locking plate goes over each front pin; each drawer in turn is lifted off the mat, its back hooked onto the rear hooks with the front held up, its front lowered so the pins come up through the bottom, and pushed home. | Locking plates, 1 a runner |
| `drawer-lock` | Under each drawer, a lever is screwed onto each front pin and turned to lock. | Locking levers, 1 a runner |
| `fronts` | Kitchen drawers only: the applied front is screwed on from inside the box front. | 4 × 30 screws, 2 a drawer |
| `drawer-test` | Each drawer is opened and closed in turn. | |

The box (and a wardrobe drawer's own front) is built outside the cabinet and goes in as one piece in `drawers`.

## The film (`drawer-film.ts`)

The boxes are built on a mat in front of the piece, in rows as the parts are laid out, each front lying face down (a
rigid pose: a turn about x and a move; holes, bits and fasteners ride on their board, so they follow). The bottom swings
up into the front's groove, the sides come down over the bolts, the back hooks over the bottom's edge and swings shut.
In `drawers` both runners are pulled out at once (`runnerPull`), then each drawer has its own turn (`INSTALL_EACH`
seconds): lifted off the mat, hooked on at the back with the front held up, lowered onto the pins, pushed home with its
runners. The drawer rails and the locks travel with the drawer from then on. The parts wait beyond the mat (`benchRoom`).

## Hinges behind drawers

A hinge's plate and arm stand in the cabinet's front corner, so a drawer behind a hinged door would hit a hinge at its
height (the reference flat-pack wardrobe moves its drawers a hole up for hinged doors). Make moves the hinges instead:
`hingeStationsClear` (`wardrobe/hinges.ts`) puts any hinge that would sit within 30 mm of a drawer front or box on the
upright it hangs from (`pulloutSpans`) above or below it, the outer two as near their usual places as they can be and the
rest evenly between. A door too short to spread its hinges keeps them where they were, and the `hinge-drawer`
manufacturing rule reports it as critical: move the drawer. The door popover reads the hinge heights from Make.

## Guidance (`make-instructions.ts`)

Each step's notes, shown in Assembly Studio's guidance and printed on the saved drawings' step pages: the tools (each
hardware entry's `assembly.tools`, and the drill when the step drills its own holes), the hardware one drawer takes and
for how many drawers, the parts by number with a box side's hand (left, right, or either), where each runner goes on its
upright (part, face, height from its lower end, screw and peg holes from its front edge), and the stage's `avoid` lines
from the registry. The callout over a joint says how its hardware goes in (`assembly.cue`).

## Holes

- Front: Ø5 × 11 bolt holes and Ø8 × 12 dowel holes in its inner face.
- Sides: Ø8 × 34 bores in the front end for the bolts, Ø15 × 12.5 cam housings 34 mm back on the inner face, Ø8 × 25
  dowel bores, and Ø8 × 22 bores in the rear end for the expanding dowels.
- Back: Ø8 through holes for the expanding dowels; a Ø6 × 10 hook hole 8 mm up from its lower edge over each side, which
  the runner's rear hook goes into (the 3D runner draws its hook and front pin over these holes).
- Bottom: a Ø10 through hole for each runner's front pin, 15 mm inside the side and 30 mm behind the front.
- Uprights: per runner, two Ø2.5 × 12 pilot holes on the 37 mm line, 32 mm apart, at the front (screws) and one Ø5 × 12
  hole near the rear (the peg).

## Known limits

- One drawer system for every drawer: no side-mounted or concealed undermount runners to choose, and no soft-close.
- Hole positions follow common practice (System 32, 37 mm line), not a runner maker's template.
- Drawer box parts are in the cutting list but not yet drawn on their own shop sheet.
- A door whose drawers leave no room to spread its hinges keeps them where they were and gets a critical `hinge-drawer`
  finding: the drawers must move. The planner does not yet keep drawer heights clear of hinges itself.
- The saved step pages draw a drawer box once (the first drawer); the others are counted beside it. Hardware is marked
  with a ring where it goes, not drawn.
