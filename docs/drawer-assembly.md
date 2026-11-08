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
| Bottom | 6 mm, captured in a groove 12 mm up from the lower edge and 8 mm deep in the front, both sides and the back. Never nailed. |

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

## The steps (Assembly Studio chapters)

| Stage | What happens | Hardware |
|---|---|---|
| `drawer-boxes` | The front lies face down on a soft mat; cam bolts go into its inner face; the bottom slides into its groove, the same gap at both ends. | Cam bolts, 2 a side |
| `drawer-sides` | Dowels go in; each side goes on over the bolts and dowel with the bottom in its groove; the cams are turned to lock. | Cams, 2 a side; one 8 × 35 dowel a side |
| `drawer-back` | The back is hooked over the edge of the bottom, swung into place, and fixed with expanding dowels hammered through it into the sides. | Expanding dowels 8 × 30, 2 a side |
| `drawer-runners` | Each runner's rear peg goes into a System 32 hole; its front bracket is screwed with two 4 × 12 mm screws. Nothing is screwed to the drawer. | Runners; 4 × 12 screws, 2 a runner |
| `drawers` | The runners are pulled out; a locking plate goes over each front pin; the drawer's back is hooked onto the rear hooks and its front lowered so the pins come up through the bottom. | Locking plates, 1 a runner |
| `drawer-lock` | Under each drawer, a lever is screwed onto each front pin and turned to lock. | Locking levers, 1 a runner |
| `fronts` | Kitchen drawers only: the applied front is screwed on from inside the box front. | 4 × 30 screws, 2 a drawer |
| `drawer-test` | Each drawer is opened and closed in turn. | |

The box (and a wardrobe drawer's own front) is built outside the cabinet and goes in as one piece in `drawers`.

## Holes

- Front: Ø5 × 11 bolt holes and Ø8 × 12 dowel holes in its inner face.
- Sides: Ø8 × 34 bores in the front end for the bolts, Ø15 × 12.5 cam housings 34 mm back on the inner face, Ø8 × 25
  dowel bores, and Ø8 × 22 bores in the rear end for the expanding dowels.
- Back: Ø8 through holes for the expanding dowels; a Ø6 × 10 hook hole 8 mm up from its lower edge over each side.
- Bottom: a Ø10 through hole for each runner's front pin, 15 mm inside the side and 30 mm behind the front.
- Uprights: per runner, two Ø5 System 32 holes 32 mm apart at the front (screws) and one near the rear (the peg).

## Known limits

- One drawer system for every drawer: no side-mounted or concealed undermount runners to choose, and no soft-close.
- Hole positions follow common practice (System 32, 37 mm line), not a runner maker's template.
- The film places the back and the bottom with the same approach as any other board: the back's hook-and-swing and the
  bottom's slide into its groove are described in the chapter text rather than animated.
- Drawer box parts are in the cutting list but not yet drawn on their own shop sheet.
