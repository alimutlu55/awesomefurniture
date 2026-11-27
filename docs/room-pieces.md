# Room pieces: one model for everything that stands in a room

Status: **design, not built.** Written 2026-11-27 after furnishings shipped without the 3D turn handle wardrobes have.

## Why

Wardrobes, kitchen units, fixtures (toilet, basin) and furnishings (bed, rug) are four separate stacks. Each one
re-implements moving, turning, collision, snapping and gap readings, and each new kind gets only the parts someone
remembered to copy:

| Today | Count | Where |
|---|---|---|
| Drag implementations | 7 | `cabinet-drag.js`, `studio-2d-gestures.ts` (×2), `fixture-editor.ts`, `furnishing-editor.ts`, `studio-2d-furnishings.ts`, `studio-editor.ts` |
| Turn implementations | 5 | `cabinet-drag.js` + `viewport-handles.js`, `studio-2d-rotate.ts`, `turnStudioFurnishing`, the typed angle in `studio-fields.ts`, `setCabinetPose` |
| Pose / footprint types | 8 | `Pose`, `Footprint`, `Standing`, `Obstacle`, `PlacedBox`, `UnitPose`, `PanelPose`, renderer `Footprint` |
| Command sets that are clones | 2 | `fixture-commands.ts`, `furnishing-commands.ts` |

What the copying has already got wrong:
- Furnishings have no 3D turn handle.
- The 2D turn of a furnishing does not push it out of a wall, but R does.
- A fixture's gaps ignore wardrobes and beds.
- A wardrobe resized into a bed says "would overlap another wardrobe".
- Furnishings can stand in a doorway.
- Wardrobes have no R key or arrow nudge in 3D, while furnishings do.

## The rule

**Every physical rule and every interaction lives in the interfaces and the abstract classes. A concrete piece only
says what it is:**
- its sizes and types;
- how it is placed (on the floor, against a wall, hung on a wall);
- whether it blocks other pieces;
- the free floor it needs;
- its finishes;
- its 3D model, its card and its plan symbol.

Adding a kind is one registry entry plus those three drawings; collision, snapping, turning, gaps, saving, undo, toolbar,
2D and 3D gestures come from the base classes.

## Layer 1: domain (rules, plain data in, plain data out)

The saved data stays plain JSON, as now; classes are views over that data and never hold state of their own. Every method is
pure and returns data, so the domain rules (no DOM, no Three.js) hold.

### Shared vocabulary (replaces the 8 pose types)

```ts
/** Where a piece is. x/z is its middle on the floor, y its underside, angle in degrees; at 0 its back is at -z. */
interface Pose { readonly x: number; readonly y: number; readonly z: number; readonly angle: number }
interface Size { readonly width: number; readonly depth: number; readonly height: number }
/** A piece in the room as every rule sees it: what collides, what is measured, what is drawn on the plan. */
interface Body extends Pose, Size { readonly key: PieceKey }      // PieceKey = { kind: PieceFamily; id: string }
interface Room { readonly studio: Studio | undefined; readonly bodies: readonly Body[] }   // every piece, from every family
/** What an edit comes back with: the new data, or why not, and what lined up on the way. */
interface Outcome<T> { readonly value: T | null; readonly reason?: string; readonly guides?: readonly Guide[] }
```

### Capability interfaces (one per action)

```ts
interface Placeable  { body(): Body; place(room: Room, hint: PlaceHint): Pose | null }           // where a new one goes
interface Collidable { readonly blocks: boolean; clashes(room: Room): string[] }                  // walls, shapes, doorways, other bodies
interface Movable    { readonly mobility: 'floor' | 'along-wall' | 'on-wall' | 'on-worktop';
                       move(room: Room, to: Pose, free: boolean): Outcome<Pose> }                 // snap, align, stop at the last valid pose
interface Turnable   { turn(room: Room, angle: number, free: boolean): Outcome<Pose>;              // 5° steps, quarter-turn catch, out of walls
                       quarterTurn(room: Room): Outcome<Pose> }
interface Resizable  { limits(): SizeLimits; resize(room: Room, size: Partial<Size>, keep: 'back' | 'middle'): Outcome<Size> }
interface Alignable  { targets(room: Room, along: WallFrame): AlignTarget[] }                     // wall middle, window, ends, neighbours
interface Measurable { readonly needs: { front: number; sides: number };
                       gaps(room: Room): Gap[] }                                                  // steady lines from the middle of each side
interface Duplicable { copyPose(room: Room): Pose | null }
interface Typed      { types(): readonly PieceType[]; withType(id: string): Size }
interface Finishable { finishGroups(): readonly FinishGroup[] }
interface FollowsRoom { followRoom(before: Studio, after: Studio): Pose | null }                  // wall moved, split, removed
```

### Abstract classes (where the rules are written once)

```ts
/** Everything every piece does: its body, collision against the room, gaps, duplicate, validation, saving. */
abstract class Piece<D extends PieceData> implements Placeable, Collidable, Measurable, Duplicable, Resizable {
  constructor(protected readonly data: D, protected readonly kind: PieceKindEntry) {}
  // implemented once: body(), clashes() (one shrink-then-overlap rule, doorways included), gaps() (gapsAround + steadyGap),
  // copyPose() (right, left, front, then place()), limits()/resize() from the registry entry, problems()
  abstract place(room: Room, hint: PlaceHint): Pose | null;
}

/** Stands anywhere on the floor at any angle: wardrobes, kitchen base and tall units, beds, desks, rugs. */
abstract class FloorPiece<D> extends Piece<D> implements Movable, Turnable, Alignable {
  readonly mobility = 'floor';
  // implemented once: move() = snapToWall + resolveAlignment(targets) + furthestValid;
  // turn() = 5°/90° snap + pushOutOfWalls; place() from the entry's placing (against the wall in view, beside X, under X, middle)
}

/** Stands against a wall, its angle the wall's: toilets, basins, radiators. */
abstract class WallPiece<D> extends Piece<D> implements Movable, FollowsRoom, Alignable {
  readonly mobility = 'along-wall';
  // implemented once: move() along the wall with targets; followRoom() (today's keepFixtures, split, removed with its wall)
}

/** Hangs on a wall at a height: kitchen wall units, shelves. Moves along and up and down its wall. */
abstract class HangingPiece<D> extends WallPiece<D> { readonly mobility = 'on-wall' }
```

### Concrete classes (only what the kind is)

```ts
class Cabinet     extends FloorPiece<EditorCabinetData>  {}   // wardrobes, chests, sideboards, TV units, shoe cabinets
class KitchenUnit extends FloorPiece<EditorCabinetData>  {}   // base, tall; worktop pieces use 'on-worktop'
class WallUnit    extends HangingPiece<EditorCabinetData> {}  // kitchen wall units, wall shelf
class Fixture     extends WallPiece<StudioFixture>       {}   // toilet, basin (+ its boxing rule)
class Furnishing  extends FloorPiece<StudioFurnishing>   {}   // bed, bedside table, desk, armchair
class Rug         extends Furnishing { readonly blocks = false }
```

A concrete class only overrides what really differs. The toilet's boxing, the kitchen run's worktop and plinth, and a
cabinet's Make and drawings stay in their own modules, called from the concrete class.

### One registry

`PIECE_KINDS` lists every kind once, each entry pointing at its existing registry: `FURNITURE`, `KITCHEN_UNITS`,
`FIXTURES` and `FURNISHINGS`. An entry gives:
- its family (which concrete class);
- its sizes and types;
- its placing;
- `blocks`;
- `needs`;
- its finishes.

`pieceOf(data)` returns the concrete instance. The registry tests walk every kind through every capability, so a kind
missing something fails with the step named.

## Layer 2: application (one command set)

`createPieceCommands(getScene, { checkpoint, report })` replaces `fixture-commands.ts`, `furnishing-commands.ts` and the pose
half of `scene-commands.ts`:

| Command | What it does, for any piece |
|---|---|
| `add(kind, hint)` | `place()`, then validation and one undo step. Returns the key or the reason |
| `preview(key, edit)` | A live move, turn or resize while dragging. No checkpoint |
| `commit(key, edit)` | The same edit as one undo step, refused with the reason |
| `duplicate(key)`, `remove(key)` | `copyPose()` and validation |
| `problem(room, key)` | The room's rules plus every body that collides |

Analytics are counted here once, with copies counted too.

## Layer 3: presentation (one set of gestures and tools)

| Tool | Built once, from the capability |
|---|---|
| 3D drag | `Movable`: floor, along a wall, on a wall or on a worktop picks the plane. 4 px threshold, one undo step, Shift moves freely, the reason shown where it stops |
| 3D turn handle | `Turnable`: today's wardrobe ring and ↻ button, for every turnable piece |
| 2D drag and turn handle | The same `Movable` and `Turnable` calls on the plan |
| Keys | Arrows nudge (`Movable`), R turns (`Turnable`), Delete removes, Escape lets go |
| Gap labels | `Measurable`: one renderer in 3D and on the plan, amber under `needs` |
| Guides | `Alignable`, through the existing overlays |
| Toolbar | Built from capabilities: Type (`Typed`), Size (`Resizable`), Finish (`Finishable`), More › Turn (`Turnable`), Duplicate, Remove. Cabinets keep Interior, Fronts and Make on top |
| Selection | `{ kind, id }` for every piece. The wardrobe's `activeWardrobe` becomes the cabinet case of it |
| Framing | One three-quarter frame, used on add and on select |

Each kind still has its own model, card and plan symbol, keyed by the registry, so a kind without them does not compile.

## Migration (each step its own commit, `npm run check` green, golden tests unchanged)

1. **Domain model**: build `Piece`, `FloorPiece`, `Furnishing` and `Rug`, and move the furnishing rules onto them. Tests
   check that they behave as today, plus the fixes: a turn on the plan pushes out of walls, and doorways are checked.
2. **Gestures for `FloorPiece`**: lift the 3D turn handle out of `viewport-handles.js` into a `Turnable` tool, with
   wardrobes behaving exactly as now. Furnishings get it, with arrows and R.
3. **One command set**: `fixture-commands` and `furnishing-commands` become `createPieceCommands`.
4. **Fixtures onto `WallPiece`**: `keepFixtures` and the fixture drag move into the base. Fixture gaps then see wardrobes and beds.
5. **Cabinets and kitchen units onto `FloorPiece` and `HangingPiece`**: a behaviour-preserving move. `cabinet-drag.js`,
   the 2D wardrobe drag and the five rotations collapse into the shared tools. Golden, buildability and kitchen tests are unchanged.
6. **Toolbar and selection from capabilities**: `room-fixture`, `room-furnishing` and per-kind menus come from one builder.

The order means the turn handle reaches furnishings after step 2, and every later step removes code rather than adding it.
