# Built-in wardrobe shapes

Wardrobes can follow irregular spaces: sloped ceilings, stepped heights, the space
under a staircase, or an alcove with a beam or boxing. Every shape uses one model;
templates are only starting data for it.

## Model

`src/domain/wardrobe/shape/wardrobe-shape.ts` (strict TypeScript, centimetres).

A skeleton is an x-monotone **outer top profile** across the full cabinet width:

```ts
interface WardrobeShape {
  template: 'regular' | 'sloped' | 'stepped' | 'under-stairs' | 'alcove' | 'custom';
  top: { x: number; y: number; partition?: number }[]; // x from the left outer face, y outer height
}
```

- Consecutive points with different `x` form a **top panel** (flat or sloped).
- Two consecutive points with the same `x` form a **step**. Its riser board sits on
  the higher side of the step. A step can carry `partition: k`, which places it on
  partition `k` so that the riser continues the partition board; it follows the
  partition when section widths change.
- `EditorDesign.shape` is optional. Absent means the long-standing regular
  rectangle, so older designs and projects are unchanged. `design.h` is always the
  profile's tallest point.

Derived geometry (all pure functions):

| Function | Meaning |
| --- | --- |
| `resolveShape(design)` | Stored profile scaled to the cabinet width, anchored steps placed on their partitions |
| `shapeBoards(shape)` | Top boards (vertical end cuts, vertical thickness `PANEL/cos θ`) and step risers, as front-elevation polygons |
| `ceilingPieces` / `ceilingMin` / `ceilingMax` | Underside of the top: the clear interior lies below it; exact for linear pieces |
| `fitSpans(pieces, x0, x1, top)` | Exact parts of a span where the clear height reaches `top` |
| `shapePanels(shape)` | Sides, top panels and steps with length, angle and rise, for inspectors |
| `shapeProblems(shape, w)` | Every validation rule; empty when buildable |
| `setPoint`, `setPanelAngle`, `setStepRise`, `splitPanel`, `addStep`, `removePoint`, `resizeShape` | Pure edits; callers validate the result |

Validation rejects: points outside the width or not left-to-right, parts lower
than 40 cm or taller than 280 cm, slopes steeper than 70° (build those as a step),
top panels narrower than 5 cm, steps on a side panel, steps without room for their
riser, two steps at one position, and tops leaving less than 15 cm clear above the
base board.

## Templates

`src/domain/wardrobe/shape/shape-templates.ts` lists the templates. Each `create`
returns a starting profile and suggested sections for the current size, and the
result is checked with `shapeProblems`.

To add a template, add one entry to `SHAPE_TEMPLATES` (and its id to
`SHAPE_TEMPLATE_IDS`). Geometry rules, commands, persistence, rendering, previews
and the inspector need no changes.

## How the rest of the editor uses it

- **Geometry rules** (`wardrobe-geometry.js`): every clear-height check uses the
  section's ceiling over the fitting's own span (`ceilingIn`, `fitsCeiling`,
  `overflow`). Moves, resizing, duplication, shelf boards, measurements and free
  spaces all go through these. Free spaces under a slope keep their tallest height
  and report `hMin`/`sloped`; steps split spaces exactly. A regular wardrobe keeps
  its exact previous clear height (218.4 cm for 230 cm).
- **Angle cutting** (`angle-cut.ts`, `itemFit`, `boardFit`): every fitting that
  meets a sloped or stepped top is cut to it. Its enclosure (top and bottom
  boards, drawer front, highlight and picking outline) is clipped exactly to the
  underside of the top boards, so it meets the slope flush. Its working core
  (drawer box, rail, basket, trouser rack) stays a rectangle so standard hardware
  fits: the fitting's own height where a part at least its minimum width allows
  it, otherwise down to its minimum height. Shelf contents fill every part that
  clears the top. A fitting is rejected only when its minimum core cannot fit, or
  when it would rise above the top's tallest point. Shelf boards are cut while at
  least 15 cm of whole board remains; vertical dividers are cut at the top.
  Measurements report the cut and the usable core.
- **Adding fittings**: under a slope a new fitting fills the space and is cut to
  the angle, keeping its default height where its core fits.
- **Commands**: `sceneCommands.applyShapeTemplate(id)` and
  `sceneCommands.setShape(shape, recordHistory, refit)` validate, check collisions,
  set the height and refit. `sizing.fitToShape()` shrinks fittings to their minimum
  height, then slides/narrows them into the taller part, and only then removes them;
  shelf boards that no longer fit are removed. Every change reports what happened
  and is a single Undo step. Resizing scales the profile horizontally and shifts it
  vertically, so measured slopes and steps are kept.
- **Auto design**: the planner plans rectangular cabinets. For a shaped wardrobe the
  wardrobe keeps its own partitions, the idea's bays are matched to them by height,
  bays whose columns no longer fit are planned on their own at their clear height,
  and the result is fitted under the top.
- **Persistence**: `Wardrobe.shape` is saved as-is. The codec validates it with the
  same `shapeProblems` rules and checks that the height matches the profile.
  Projects without `shape` open as regular wardrobes.
- **Rendering**: `frame-geometry.ts` builds panels from `shapeBoards` and
  `ceilingPolyline`. Axis-aligned panels stay boxes (regular wardrobes render as
  before); angled ones are extruded prisms with panel-scaled UVs. Partitions,
  backs, doors, section highlights and hit areas follow the profile.

## Editing

- **Wardrobe settings › Shape** (desktop side panel; on phones **More › Shape**):
  template previews and **Adjust panels**, which lists the left side, each top
  panel (angle, width, board length), break points and steps (position, rise,
  heights) and the right side, with precise inputs. Top panels can be split or
  given a step; break points and steps can be removed.
- **Model handles**: with Adjust panels open, each break point has a handle showing
  its height. Drag it (sides move vertically only); heights snap to neighbouring
  points, positions to partition faces. Arrow keys move a focused handle by 1 cm,
  Shift+arrows by 0.5 cm. A drag is previewed live and committed as one Undo step.
- **Add item › Wardrobe** (phones) and **New wardrobe shapes** (desktop): add a new
  wardrobe that starts from a template.

## Limits

- The top profile varies; the base, depth and plinth are uniform across the
  wardrobe. Obstructions at floor level and per-section depths are not modelled.
- A fitting's working core is rectangular by design (runners, rails and baskets
  are); only its boards and fronts are angled.
- Auto design idea cards preview rectangular layouts; applying one adapts it.
