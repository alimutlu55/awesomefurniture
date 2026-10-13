# Studio: development notes and handoff

Branch: `feature/studio` (from `main` at `2f3fcbf`). Not merged into `develop` or `main`.
Read `CLAUDE.md` first: commands, layer rules, guards, and how we work.

## What the user asked for

A **Studio**: the room the wardrobes stand in, as close to the real room as possible.

- Built-in studios, plus custom studios built by arranging and resizing walls.
- **UX is the most important thing**: selecting, building, resizing, camera moves, near-real UI
  elements and physics. Follow the app's existing easy-to-use, easy-to-edit approach.
- Later (not this branch): build the studio from a photo of the real room. The research is in
  `docs/studio-investigation.md`. That file is **untracked and not ours** (another session wrote it):
  read it, do not commit or edit it.

The user expects: test before saying something works, send screenshots as evidence (desktop and
phone), no noisy UI (no label backgrounds, no overlapping text), never claim done unverified.

## Design decisions (keep them)

- **One coordinate frame.** Studio corners use scene x/z in centimetres, the same as a wardrobe's
  position. A wardrobe's x/z is its centre; at angle 0 its back is at -z and its front faces +z.
- **Corners and walls.** A wall runs from corner `a` to corner `b`, centred on that line. Its
  **room side** is to the left of a→b: normal `(nx, nz) = (-uz, ux)`. That equals the front
  direction of a wardrobe at the wall's angle `atan2(-dz, dx)`, so a wardrobe flush against a wall
  simply takes the wall's angle. Moving a corner stretches every wall that meets there.
- **Openings** (door, window, archway) belong to a wall: `offset` is the distance from corner `a`
  to the opening's centre. Wall and corner moves keep openings where they are in the room
  (`keepOpenings` in `studio-edit.ts`).
- **Edits are pure functions** (`studio-edit.ts`) returning a new studio. The application command
  `editStudio(edit, recordHistory)` validates with `studioProblems` and refuses walls that would cut
  through a wardrobe, reporting the reason. A drag uses `recordHistory: false` for live previews and
  takes **one** checkpoint when it starts (copy the shape editor's pattern in `shape-inspector.ts`).
- **Physics**: walls are obstacles in the same collision rules as wardrobes
  (`createCabinetGeometry(getCabinets, getObstacles)`; adapter `studio-obstacles.ts`). Dragging,
  turning, resizing and reshaping wardrobes already stop at walls. Scene bounds stay wardrobe-only.
- **No room by default.** New and old projects have no `studio`. The golden tests must stay
  untouched by every studio commit.
- **Built-in studios are a registry** (`studio-templates.ts`): one entry each, laid out around the
  wardrobe wall (x = 0 is its middle; the back wall's room face is at z = 0). Picker art is drawn
  from the corners, so a new built-in needs no art.
- **Ceilings that come down** (stairs, landings, sloped roofs, boxes) are the `ceilings` list on `Studio`
  (absent when there are none, so old projects and the golden tests are untouched). Each belongs to a wall
  and has a profile like a wardrobe's top: `run: 'along'` changes along the wall and reaches `depth` into
  the room; `run: 'across'` slopes away from the wall. The lowest ceiling over a spot counts (`ceilingAt`).
- **Wardrobes follow the ceiling** (`studio-fit.ts`, `ceiling-commands.ts`): a wardrobe that a ceiling comes
  down over takes shape template `'room'` (top = the lowest ceiling over its depth, filled up to the room's
  ceiling elsewhere); leaving it, it stands regular at its tallest point. A shape someone sets that stays
  under the ceiling is kept; one that would rise into it is refused with the reason.
- **As few handles as possible.** A selected wall shows its two corner dots and "+" on free ends, nothing
  else: the wall, a door or a window is dragged by its own surface (`surface.grab` in `room-wiring.ts`,
  routed from `bindings/canvas.js`). A ceiling shows one height pill per point (handle and measurement in
  one; tap to type) and one depth grip. Lengths are typed by tapping them on the model.

## Files

| Layer | File | What it does |
|---|---|---|
| Domain | `src/domain/studio/studio.ts` | Model, limits, defaults, `wallLine`, `wallBox`, `wallExtent`, `wallFace` (inside length), `studioBounds`, `nextId` |
| Domain | `src/domain/studio/studio-templates.ts` | Built-in studios registry: wall, corner, alcove, bedroom, walk-in |
| Domain | `src/domain/studio/studio-edit.ts` | Edits: move corner or wall, inside length, size, split, extend, merge corners, suggest a wall, openings, translate |
| Domain | `src/domain/studio/studio-validation.ts` | `studioProblems` (worded as what to do), `openingRange` |
| Domain | `src/domain/studio/studio-obstacles.ts` | Walls as collision obstacles |
| Domain | `src/domain/studio/studio-placement.ts` | `placeAgainstWall`, `pushOutOfWalls`, `snapToWall`, `wallSpot` (a wall's free stretch) |
| Domain | `src/domain/studio/studio-ceiling.ts` | Ceilings: `ceilingAt`, `ceilingFrame`, `reachAt`, the `CEILING_SHAPES` registry, edits, validation |
| Domain | `src/domain/studio/studio-fit.ts` | `ceilingTop` (a wardrobe's top under the ceiling), `sectionsUnder` (partitions at steps and bends) |
| Application | `src/application/commands/ceiling-commands.ts` | Wardrobes follow the ceiling: `follow`, `followAll`, `shapeBlocked` |
| Application | `src/application/commands/studio-commands.ts` | `placeStudio`, `editStudio`, `studioProblem`, `addStudioWall`, `addStudioOpening`, `placeNewCabinet`, `wallSnap` |
| Presentation | `viewport/studio-renderer.ts`, `studio-surfaces.ts` | Walls, openings, floor, ceiling; cutaway (walls lower to a cut stub); selection outline; wardrobe snap strip |
| Presentation | `viewport/studio-overlay.ts` | Room handles and height pills, live rulers (tap a length to type it), guides, refusal reasons |
| Presentation | `viewport/studio-ceilings.ts` | Ceilings: solid from inside the room below the ceiling, thin lines from above |
| Presentation | `editor/studio-ceiling-drag.ts`, `studio-ceiling-panel.ts` | Pill and depth-grip geometry and snapping; the Ceiling choices drawn from the registry |
| Presentation | `editor/studio-editor.ts`, `studio-drag.ts` | Room selection, drags (corner, wall, opening, "+"), snapping, measures, toolbar commands |
| Presentation | `editor/studio-fields.ts` | Size popover fields (wall: length inside, height, thickness; opening: width, height, sill, from left end) |
| Presentation | `editor/studio-panel.ts`, `studio-art.ts` | Walls category of Add item (desktop fold `#padd-room`, phone category `room`) |
| Presentation | `editor/room-wiring.ts`, `studio.css` | Wiring, keys (Esc, Delete), room framing; styles |
| Tests | `tests/architecture/studio*.test.ts`, `scripts/check-studio.cjs` | Model, physics, editing; real UI flows on desktop and phone |

## Status

| Slice | State |
|---|---|
| 1. Domain model, built-in studios, edits, validation | **Done** |
| 2. Walls as obstacles, room placement, new wardrobes inside the room, wall snap, saving | **Done** |
| 3. Rendering, Room picker, cutaway, camera framing, drag snap | **Done**, verified desktop and 375 px |
| 4. Editing UX: select and change walls, corners, openings | **Done**, verified desktop and 375 px |

`npm run check` (354 tests), `npm run check:mobile` and `node scripts/check-studio.cjs` pass (the last two
need the dev server at 127.0.0.1:5173). Golden fixtures are unchanged.

How it works now:

- **Add item → Walls** (desktop fold "Walls and rooms", phone category "Walls"): Wall, Door, Window, Archway,
  and the built-in rooms. The Room section left the wardrobe panel.
- **Click or tap a wall** (when no wardrobe is in front of it) or an opening to select it. The contextual
  toolbar shows its actions on desktop and phone: wall → Size, Split, Door, Window, More (Archway, Add wall,
  Remove wall); opening → Size, Remove. Size opens exact fields. Esc leaves, Delete removes.
- **Handles**: corner dots (floor), a grip on the wall's top edge (moves it along its room side), "+" on free
  ends (drag to draw a wall, click for a right-angle wall), a grip on each opening (slides it). Drags go as far
  as the room allows and say why they stopped; one undo step each; Shift drags freely. Snaps: corners square
  with neighbours, align with other corners, 45°, and join a free end dropped within 36 cm of another free end;
  walls align with corners; openings centre on the wall.
- **Lengths are inside lengths** (`wallFace`), as a tape measure reads them. Setting one moves the next wall
  square, so a room grows instead of skewing.
- **Cutaway**: walls between the camera and the room lower to a 14 cm stub with a darker cut top (no ghosting).
  The selected wall keeps a full-height outline. The ceiling shows only from inside the room.
- **Camera in a room**: the camera goes exactly where the person moves it, with or without a room; the room never
  moves, clamps or re-aims it (an earlier version kept eye-level views inside the room with a wider lens and a
  45° stop, which looked good in stills but fought pinch, orbit and pan on phones; it was removed). Walls between
  the camera and the room are cut away, to a 14 cm stub from above and a line on the floor near eye level.
  Selecting a wall seen from behind swings the view round to it. Right- or middle-drag, Shift-drag on empty
  space and two fingers pan (vertical moves pan up and down at eye level, along the floor from above), kept
  near the room without ever jumping. A project with a room opens on the whole room.
- **Wardrobes in the way**: while a wardrobe is selected, another one between it and the camera is hidden and
  shown as a dashed footprint (`viewport/wardrobe-occlusion.ts`).
- **Wardrobe drags** follow the pointer in 1 cm steps (were 5 cm); a green strip marks the wall face a wardrobe
  snapped to.

![Bedroom, wall selected, desktop](verification/studio-wall-selected-desktop.jpg)
![Door size, phone](verification/studio-door-size-phone.jpg)

## Realistic rendering

The look follows the user's reference photos (a styled walk-in wardrobe): a photographed interior, not a game.
Rendering only: nothing here changes the model, the planner or the golden tests.

- **Light**: `scene-lighting.ts`, with a RoomEnvironment for soft reflections, a warm sun with soft PCF shadows and a sky fill.
  Shadows redraw only when `shadowKey` changes (`frame-renderer.js`), which keeps phones smooth.
- **Materials**: `wood-grain.ts` (oak), `fabric.ts` (cloth, folded garments as rounded boxes, shoes),
  `hardware.ts` (bar pulls on drawers and doors), and `studio-surfaces.ts` (floor boards and contact shade).
- **No room**: the wardrobe stands on oak boards that fade out (`stage-floor.ts`). **In a room**: the ceiling
  shows whenever the camera is below it, with recessed downlights. Doors have raised panels and a lever.
  Windows have a sash and glow like daylight. Shade lines run where walls meet the floor, the ceiling and each other.
- **Default room view**: front-on at eye level (`frameRoom` in `room-wiring.ts`).
- Still to do: an ambient-occlusion pass on capable devices, an optional LED strip under the top shelf, and
  labels restyled to the references.

## Ceilings and fitting wardrobes (branch `claude/wall-adjustment-ux-*`)

How to build the user's under-stairs space:

1. Walls › **Under stairs** (built in, from the photos), or any room then select a wall › **Ceiling** ›
   Stairs / Stairs with landing / Sloped ceiling / Box or beam (also in the Walls sheet).
2. The view turns to eye level; drag a height pill up, down or along (snaps level, to steps and the wall's
   ends), or tap it and type. The grip sets how far it reaches into the room (snaps to the opposite wall).
   Drag the ceiling itself to raise or lower it. Flip, Size and Remove are in the toolbar.
3. Select the wall › **Wardrobe**: a wardrobe fills its free stretch, flush, fitted under the stairs and
   divided where they step and bend. Wardrobes standing against a wall go with it when it is pushed or pulled.

Verified on desktop (1440 × 900) and phone (375 × 812, real touch events): `node scripts/check-studio.cjs`
(with `MOBILE_TEST_URL` for another port). Tests: `studio-ceilings.test.ts`, `studio-ceiling-commands.test.ts`.

Limits: a wardrobe's top can slope side to side, not front to back, so under a roof sloping down to its own
wall it is flat at the lowest point. Ceiling solids hide while the camera is above the room's ceiling.

## Measuring assistant (resizing and moving)

What a carpenter reads while something moves or is resized, and nothing else on the model:

- **Wardrobe moved or resized** (`domain/studio/scene-gaps.ts`, `viewport/assist-overlay.ts`): dark tags on
  dimension lines to the side walls or neighbours (filler gaps), the ceiling (top filler) and, when tight, the
  room in front (amber under 60 cm: doors need it). Each gap is the smallest of three readings along the face.
  Green when it lines up: Flush, Centred, Fronts in line, Tops level; within about 8 px it snaps there
  (`align-commands.ts`, Shift moves freely). Pressed against a wall it slides along it.
- **Fitting edge dragged** (`viewport/item-dimensions.js`): only the size it sets and the gaps it closes.
- **Divider dragged**: its gaps in dark tags. **Wall pushed**: the gap to the nearest wardrobe in front.
  **Corner dragged**: its angle (green at 90° Square and 180° Straight); snaps Square, Straight, Parallel, 45°.
- While any of these shows, the label layer is marked (`#labels[data-assist]`, `[data-room-drag]`) and
  every other handle, "+" and tag hides (`studio.css`).

## What is left

- Corner and opening fields have no keyboard-free precise X/Z entry (corners move by dragging or arrow keys).
- Removing a corner (merging two collinear walls into one) is not offered.
- `check-studio.cjs` taps the back wall at a fixed point of the framed view; if framing changes, update `VIEWS`.
- Walls meet only at corners: a wall cannot start from the middle of another (split it first).
- Phone gestures were checked with synthetic touches (one-finger orbit, pinch, two-finger pan) in Playwright,
  not on a real phone.
- Later: wall materials, lighting, photo-assisted building, front-to-back sloped wardrobe tops.

## Gotchas

- **Architecture ratchet**: `npm run check:architecture` fails on files over 400 lines, lines over
  240 characters, hand-written kind or possession lists, and HTML in the domain. Older files are held
  at their size in `scripts/architecture-baseline.json`. `inspector-presenter.js` is at its limit
  (439 lines): add nothing to it, put new UI in its own module.
- **Hash-locked files**: `editor.html`, `editor.css` and `wardrobe-planner.js` are hashed in
  `tests/fixtures/editor-baseline.json`. Refresh the hash in the same commit and say why. Prefer
  styling in `shape.css` and new CSS files.
- **Golden tests** must stay untouched: a scene without a studio must behave exactly as before.
- Tests construct `createCabinetRenderer` with partial fakes, so the studio renderer is optional there.
- New ports go in the matching `.ports.d.ts` (for example `editor-gestures.ports.d.ts` got `wallSnap`).
- Commit messages end with the attribution line the session gives. Push only this branch; merge
  into `develop` or `main` only when the user asks, by fast-forward.
- Once, this checkout switched from a feature branch to `main` without any command of ours. Check
  `git branch --show-current` before committing.
