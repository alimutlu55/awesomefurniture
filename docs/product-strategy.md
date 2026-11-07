# FurniDraw platform strategy: seven capabilities that every feature stands on

Product owner and architecture analysis, November 2026. This replaces the earlier feature lists. The question
is not "which features next", but **which capabilities, once built, make dozens of features cheap, consistent and
correct**: for people using the editor, for the team extending it, and for partners building on it.

Every claim about the code below was checked in `src/`. Where the earlier draft of this document was wrong, it is
corrected here (see §9).

---

## Status (November 2026)

Built on `claude/awesome-furniture-strategy-aekj4c` (see [engine.md](engine.md)):

| Capability | State |
|---|---|
| 1. Build model | **Built.** Wraps Make; proven to use exactly the cutting list's boards; adds contents, loads, weight, revision |
| 3. One rule engine | **Built** with three packs (manufacturing check, Make's drilling check, engineering loads), live in the editor, fixes applied through editor commands |
| 4. Physics and loads | **Built** for shelf sag, rail span, lift and runner load, hinge load; stored weight now lives in the possession and purpose registries |
| 5. Catalog, profiles, targets | **Built** in part: a dated price list, three builder profiles that lower the model, quotes in zł/€/$. Not yet: supplier price lists, CNC or machine exports |
| 7c. Operation log | **Built** in part: a scene diff ("what changed") and a change history in the open editor, a product events port. Not yet: persisted versions, collaboration, an analytics adapter |
| 7d. Headless engine | **Built** in part: the agent API's `inspect()` and the `inspect_design` WebMCP tool return the check, passport and prices as JSON |
| 2. Components as definitions | **Not started.** Fittings still need planner and renderer code; sliding doors wait on this |
| 6. Needs and a generic solver | **Not started.** Auto design does not read the engine yet |
| 7a/7b. Tolerances, intent relations | **Not started** |

In the editor: **Design check** in the menu (check, price three ways, passport, changes), and **Split the bay**, a command
that keeps a bay's layout on both sides, which the Sections control could not.

## 1. The diagnosis: one piece of furniture is modelled five times

A wardrobe in FurniDraw is described once (`EditorDesign`) and then **re-derived separately** by every part of the
product that needs to know what it is made of:

| Question | Who answers it today | How |
|---|---|---|
| What boards is it made of? | `cabinetBoards` (`domain/drawings/cabinet-boards.ts`), used by drawings, Make, manufacturing rules and the carcass in `frame-geometry.ts` | A real board list (good) |
| What do the fittings look like? | `fitting-renderer.ts`, `kitchen-fitting-renderer.ts` | Per-kind branches in presentation (`k === 'drawer'`, `k === 'shoe'`, `case 'sink'`…): ~20 hand-written shapes |
| What does it hold? | `capacitiesOf` inside `wardrobe-planner.js` (hash-locked), `kitchen-storage.ts` for kitchens | Two separate capacity models |
| What does it cost? | `costing.js` | An area estimate: `a * 38 * finishFactor` plus relative prices per kind. **Not** from the board list or the hardware list |
| Is it buildable? | 15 modules in `wardrobe-rules/` (live, ~1,400 lines), 6 rules in `manufacturing-rules/` (only when drawings are issued), `studio-validation`, `fixture-validation`, planner gates | Five rule systems with different severities, timings and messages |
| How do I build it? | `make/` (joints, holes, assembly) | Reads `pieceBoards` (good), System 32 and joints chosen in code |

Consequences a person feels, even if they can't name them:

- **The price doesn't follow the construction.** Switch to 25 mm shelves, add an edge, change the back panel: the
  cutting list changes, the price doesn't.
- **Problems appear late.** The shelf span check (`manufacturing-rules/shelf-span.ts`) exists, but only fires when
  drawings are issued, and checks span against board thickness, not against what the planner put on the shelf.
- **Every new fitting costs code in three layers** (registry, planner capacity, renderer branch) and the
  architecture rules already warn about hand-written kind lists. A new furniture kind (hallway, desk, vanity) costs
  a planner, a storage model, a renderer and rules.
- **History is a stack of whole-scene strings** (`scene-history.ts`, 60 snapshots). Sharing copies the design;
  concurrent edits fork a new session. Nothing can say *what changed* between two versions.

**The platform move: one canonical build model, with everything else as a pure function of it.** That's the first
capability. The other six follow from it.

---

## 2. The target architecture

```
  REALITY            NEEDS                 INTENT
  room, services,    what people own,      the design + relations
  measurements ±     how they use it,      ("fill this wall", "align to
  tolerance          who reaches what      the window", "same as bay 2")
        │                 │                      │
        └────────┬────────┴──────────┬───────────┘
                 ▼                   ▼
        ┌─────────────────────────────────────┐
        │ 1. BUILD MODEL (part graph)         │  ← generated by
        │ parts · materials · edges · grain   │    2. COMPONENT DEFINITIONS
        │ hardware · operations · joints      │    (fittings, hardware, units
        │ loads · contents · provenance       │     as parametric generators)
        └─────────────────┬───────────────────┘
                          │ pure functions
     ┌──────────┬─────────┼──────────┬───────────┐
     ▼          ▼         ▼          ▼           ▼
  3. RULES   4. PHYSICS  CAPACITY   COST        ERGONOMICS      → findings + metrics, each with "why"
  (one       (loads,     (needs     (5. catalog  (reach,
  engine)    sag, tip)   solver)    × BOM)       clearances)
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ 5. BUILD TARGETS (compilers)        │  render · drawings · Make · cut list ·
        │ lowered by a manufacturing profile  │  CNC · AR · AI prompt · quote
        └─────────────────────────────────────┘

  Across all of it: 6. OPERATION LOG (history, versions, collaboration, analytics)
                    7. HEADLESS ENGINE + SDK (agents, partners, plugins)
```

Each capability below has: the problem today, the abstraction, what it unlocks for people, how to get there without
breaking the guards (golden tests, the planner hash, the layer rules), and the first feature that proves it.

---

## 3. Capability 1: the build model (a part graph)

**Problem.** Five derivations of the same piece (§1). Every new output (price, AR export, CNC, weight) means a sixth.

**Abstraction.** A pure domain function `buildModel(scene) → BuildModel`, millimetres, no DOM:

```ts
interface BuildModel {
  pieces: Piece[];                 // a wardrobe, a kitchen unit, a filler
}
interface Piece { id; pose; parts: Part[]; hardware: HardwareUse[]; joints: Joint[]; contents: Content[] }
interface Part {
  id; role: 'side' | 'shelf' | 'divider' | 'back' | 'front' | 'drawer-side' | …;
  solid: Box | Extrusion;          // exact geometry in mm
  material: MaterialRef;           // catalog SKU, thickness, grain direction
  edges: Record<EdgeId, EdgeBandRef | null>;
  operations: Operation[];         // holes, grooves, cut-outs (System 32, hinge cups, runner screws)
  source: Provenance;              // which design element and which component made it
}
interface HardwareUse { ref: HardwareKey; size; at: Placement; on: PartId[]; load?: Load }
interface Content { need: NeedRef; on: PartId; mass: number; volume }   // what sits on/in it
```

`cabinetBoards`/`pieceBoards` are already 70% of this. They become the first producer of `Part`; Make's joints and
holes (`make-joints`, `part-operations`) become `Joint` and `Operation`; the hardware list becomes `HardwareUse`.

**What it unlocks.** One source of truth for: the 3D model, drawings, Make, cutting list, hardware list, price,
weight, loads, AR/glTF export, CNC export, the AI image prompt, the design passport. **A feature that reads the
build model is consistent with every other feature by construction.**

**Migration.** Introduce `BuildModel` beside `cabinetBoards`, prove equality in a test (`buildModel(scene).parts`
matches `cabinetBoards` for every golden wardrobe and every kitchen preset), then move consumers one at a time:
manufacturing rules first (already on `pieceBoards`), then cost, then the fitting renderer. Golden tests stay
unchanged because the planner isn't touched.

**Proof feature.** *Design passport*: parts, sheets, yield, edge banding metres, hardware count, weight, build time,
read straight from the model.

---

## 4. Capability 2: components as parametric definitions

**Problem.** A fitting kind is a registry entry **plus** code in `capacitiesOf` (planner) **plus** a branch in a
renderer. Hardware is data (good), fittings are half data, furniture kinds are modules with their own planners and
storage models.

**Abstraction.** A component is a **generator** from parameters and context to parts, hardware, capacity and
interaction:

```ts
interface ComponentDef<P> {
  key; traits; params: ParamSchema<P>;                 // width, height, purpose, finish… with limits
  build(p: P, ctx: BayContext): { parts; hardware; joints; operations };   // into the build model
  capacity(p: P, ctx): Capacity;                       // what needs it serves, and how well (access, reach)
  motion?: Motion;                                     // slides 450 mm on runner X, swings 110° on hinge Y
  rules?: RuleRef[];                                   // its own checks (min width, runner length)
}
```

The renderer draws **parts and hardware** generically (boards, metal profiles, wire, glass, hardware models from the
hardware registry); per-kind drawing code disappears. Furniture modules (wardrobe, kitchen) become a set of
components plus layout rules.

**What it unlocks.**
- **New fittings in a day, as data**: tie racks, jewellery inserts, ironing boards, inner drawers, sliding doors
  (the `slidingTrack` hardware already exists; only the component is missing).
- **New furniture kinds** (hallway, desk, bathroom vanity, TV wall, attic knee-wall) without a new planner or
  renderer.
- **Manufacturer catalogs as components**: a runner or drawer system defined by its maker's data, so the model uses
  the real part, the real drilling and the real load.
- **Motion for free**: doors open, drawers slide, collisions show, because every component declares how it moves.

**Migration.** Wrap first, don't rewrite: a component adapter for each existing kind calls today's drawing code and
the planner's capacity function, so behaviour is identical. Then move kinds one at a time to generic parts.
`fittings.test.ts` already walks every registry entry; extend it to walk every component through
`build → render → rules → capacity`.

**Proof feature.** *Sliding doors* as the first component written natively, plus *doors and drawers that open*
from `motion`.

---

## 5. Capability 3: one rule engine, live

**Problem.** Five rule systems (§1). The manufacturing check is excellent but runs only at export; live rules return
messages that aren't linked to fixes; nothing explains *why* in a consistent form.

**Abstraction.**

```ts
interface Rule {
  id; pack: 'geometry' | 'manufacturing' | 'engineering' | 'ergonomics' | 'room' | 'standard:EN-14749' | 'maker:<x>';
  applies(model: BuildModel, ctx): boolean;
  check(model, ctx): Finding[];
}
interface Finding {
  rule; severity: 'blocking' | 'warning' | 'advice';
  on: PartId[] | PieceId[];                 // where to draw it on the model
  why: Explanation;                         // inputs, threshold, source standard
  fixes: FixProposal[];                     // each is a command the editor can apply and preview
}
```

Rules are evaluated incrementally on the build model as the person edits, cached by part hash (the same idea as
`modelRevision`). The planner reads the same rules as hard constraints, so Auto design and manual edits agree.

**What it unlocks.**
- **A design doctor**: every problem on the model, explained, with a one-tap fix and a preview of the fix.
- **Rule packs**: a country's standard, a manufacturer's hardware rules, a workshop's own limits, a
  "child-safe" pack (tip-over, finger gaps), an accessibility pack.
- **Fails closed everywhere**: export, ordering and agents use the same engine, so nothing buildable in the editor
  is refused later, and nothing refused later looked fine in the editor.

**Migration.** Wrap `manufacturing-rules/` first (they already share a `Rule` type and return findings with
severity), then live `wardrobe-rules` checks, then studio and fixture validation. Keep messages identical; add
`fixes` rule by rule.

**Proof feature.** *Live manufacturing check* in the editor with fixes ("this 96 cm shelf: add a divider / use
25 mm / add a rear rail").

---

## 6. Capability 4: physics and loads

**Problem.** The editor knows what's on every shelf (the planner assigns possessions), and the hardware registry
knows load ratings (`loadKg` on sliding gear, 15 kg on cargo pull-outs), but nothing connects them. The shelf check
uses a span table by thickness.

**Abstraction.** An evaluator over the build model: `Content.mass` from needs (a shirt, a book, a pan, each with a
mass), loads routed through parts to their supports (shelf → pins → side; drawer → runners; door → hinges; piece →
floor or wall brackets). Outputs: deflection per part (beam model with the material's stiffness from the catalog),
utilisation per hardware item against its rating, centre of mass and tip-over margin for an unfixed piece.

**What it unlocks.** Load-aware sag ("this shelf is fine for folded clothes, not for books"), hinge and runner
choice by real load, wall-fixing advice, a weight for shipping and carrying, heavier mirror doors flagged on a
track. These are **rules in the rule engine** fed by physics, so they share fixes and explanations.

**Migration.** Masses go into `possessions.ts` (one field per entry; the registry test enforces it). Stiffness goes
into the material catalog. Start with shelves and runners; hinges and tip-over next.

**Proof feature.** *Engineering view*: parts coloured by utilisation, live.

---

## 7. Capability 5: catalog, profiles and build targets

**Problem.** Prices are relative units on an area estimate. Board thickness, edge banding and grain are fixed
strings in `decor-base.ts`; System 32 and stock sizes are constants. Make already offers a per-piece choice of
joints (confirmat, cam, dowel) and back fixing (nailed, grooved) (`make-construction.ts`), but that choice changes
only Make: not the price, not the rules, and not what a given builder can actually do.

**Abstraction.** Three registries and a compiler step:

- **Catalog**: materials (decor SKU, thickness options, stiffness, sheet sizes, price per m² per region, grain),
  edge banding, hardware (price, load, drilling template). Providers per region and supplier, with
  **equivalences** (this Egger decor ≈ that Kronospan decor) for substitution.
- **Manufacturing profile**: what the builder can do: stock sheet sizes, saw kerf, edge bander yes/no, drilling
  (hand jig, System 32 line, CNC), allowed joints (cam, confirmat, dowel), max part size. Profiles: *DIY with a
  drill*, *panel shop*, *CNC workshop*, user-defined.
- **Build targets**: pure functions `(BuildModel, Profile, Catalog) → output`: drawings, Make, cut list, CNC
  programmes, glTF/USDZ, AI prompt, quote.
- **Lowering**: the profile **changes the build model**: a DIY profile picks confirmat screws and nailed backs
  (Make's existing choices become profile defaults); a CNC profile adds dowel holes. Same design, different construction, all
  derived, all checked by the same rules.

**What it unlocks.** A real price that follows every construction choice; "cheaper with the same look" by swapping
equivalents; **the same design built three ways** (DIY / panel shop / workshop) with three prices and three
instruction sets; exports any shop can read; a carpenter's own prices and limits as their profile (the foundation of
any pro offering later).

**Migration.** Move `carcass.ts` constants behind a profile with today's values as the default profile, so the
golden tests don't move. Price: compute from the build model in parallel with `costing.js`, show both internally,
switch when stable.

**Proof feature.** *Build it three ways*: a toggle that re-derives Make, the cutting list and the price per profile.

---

## 8. Capability 6: needs, a generic storage solver

**Problem.** Auto design is FurniDraw's most distinctive feature, and it only works for wardrobes and seven kinds of
clothes. Kitchens have a separate storage model; any new furniture kind would need a third.

**Abstraction.** **Needs** are generic: an item type with size, mass, count, growth, access frequency, who uses it
and how it's stored (hung, stacked, standing, lying). **Components declare capacity** for needs (Capability 2).
The solver allocates needs to space for any furniture kind, scoring access (reach per person), capacity, cost from
the catalog and engineering margins from physics.

```ts
interface Need { key; size: Bounds; mass; count; growth; access: 'daily' | 'weekly' | 'seasonal'; storedAs; user? }
```

**What it unlocks.** Auto design for kitchens (pots, pans, plates, small appliances, a cook's height), hallways
(coats, shoes, bags, a pram), offices, kids' rooms that change with age, garages. Multiple users with their own
reach ("her side, his side"). Trade-off sliders (cheaper ↔ more storage ↔ easier reach), since cost and access
are scored on the same model.

**Migration.** The numerical planner is hash-locked and the golden tests lock its output. Keep it as the wardrobe
solver behind the `Need` interface (seven needs map 1:1 to today's possessions); build the generic solver for new
kinds first (kitchen), and only compare against wardrobe goldens before ever routing wardrobes to it.

**Proof feature.** *Auto design for kitchens* from a list of what someone cooks with.

---

## 9. Capability 7 and the cross-cutting pieces

### 7a. Reality with tolerances

Every room dimension carries **where it came from and how sure it is**: typed, measured (tape, laser), scanned,
assumed, with a tolerance. Walls can be out of square and out of plumb. The build model derives **allowances**
from tolerances (scribe strips, fillers, adjustable plinths), and the rule engine blocks manufacture on assumptions
that matter.

Unlocks: a measuring checklist that knows which numbers matter, a *fits-if-you-measured* promise, a natural slot
for scanned rooms later (a scan is just a measurement source with its own tolerance).

### 7b. Intent: relations, not only numbers

`editorLayout` already stores intent (aligned vs pinned items, section weights); the spec has `fill`; wardrobes
follow ceilings. Generalise into **persistent relations**: *fills between wall A and wall B*, *centred on the
window*, *top aligned with the door head*, *same interior as bay 2*, *mirror of piece 1*. A small solver re-applies
them when anything changes.

Unlocks: re-measure the room and the design adapts; templates and shared designs that fit another room (remix);
copy/mirror that stays linked; designing "by intent" through agents and a chat.

### 7c. The operation log

Commands become serialisable operations (`{ op: 'setShelfHeight', target, from, to }`), recorded alongside the
snapshots that history uses today.

Unlocks: **versions and branches** (try a variant without losing the original), **what changed** between two
revisions (drawings revision notes, "rev B: shelf 3 moved +32 mm"), **live collaboration** later (operations merge;
snapshots don't), **product analytics for free** (every operation is an event, so there is no separate tracking
layer to maintain; there are no product analytics today), and a training set of how people actually edit designs.

### 7d. Headless engine and SDK

`mountEditor`, the design spec, `describeScene`, WebMCP and `#spec=` links are already an API. Make it a product:
an engine that runs without a viewport (build model, rules, solver, targets) in the browser, a Worker or a server.

Unlocks: partners (board suppliers, kitchen studios, retailers) embedding FurniDraw with their catalog and profile;
server-side rendering and validation of saved designs; agents that design, check and price end to end; a plugin
surface (a component, a rule pack, a catalog provider, a build target).

---

## 10. Sequence

Each step ships a feature people see, and leaves the platform stronger.

| Phase | Platform | Feature that proves it | Guard |
|---|---|---|---|
| 1 | **Build model** v1 (carcass + fittings via adapters, provenance) | Design passport | Equality test against `cabinetBoards` for goldens and kitchen presets |
| 2 | **Rule engine** wrapping manufacturing rules, live, with fixes | Live manufacturing check with one-tap fixes | Same findings as the export check on every fixture |
| 3 | **Components** (adapter for all kinds; first native component) + motion | Sliding doors; doors and drawers that open | `fittings.test.ts` walks build → render → rules → capacity |
| 4 | **Physics** (masses, stiffness, routing) | Engineering view, load-aware sag | Rule-engine tests per load case |
| 5 | **Catalog + profiles + targets** (today's values as default profile) | Real price; build it three ways | Golden tests unchanged on the default profile |
| 6 | **Operation log** beside snapshots | Versions, "what changed", product analytics | History tests; round-trip ops ↔ snapshots |
| 7 | **Needs + generic solver** for a new kind | Auto design for kitchens | Wardrobe goldens untouched |
| 8 | **Intent relations** + **tolerances** | Re-measure and adapt; measuring checklist | Spec round-trips |
| 9 | **Headless engine + SDK** | Partner embed with their catalog; plugins | Engine runs in tests without WebGL |

Dependencies: 1 → (2, 3) → 4 → 5; 6 is independent and can start any time; 7 needs 2 and 5; 8 needs 1; 9 needs 1, 2
and 5.

### How we'll know the platform is working

| Measure | Today | Target |
|---|---|---|
| Code places to touch for a new fitting kind | 3 layers (registry, planner, renderer) | 1 (a component definition) |
| Time to add a furniture kind | a module, a planner, storage, a renderer | components + layout rules, about 2 weeks |
| Rule systems | 5 | 1 engine, several packs |
| When a manufacturing problem first shows | when drawings are issued | while editing |
| Price derived from the cutting list | no | yes |
| How a design is built | joints and back chosen per piece, in Make only | a builder profile that changes construction, price, rules and outputs together |
| "What changed between versions" | not possible | per operation |

---

## 11. Corrections to the earlier draft

- It said no shelf deflection code exists. **Wrong**: `manufacturing-rules/shelf-span.ts` checks a shelf's clear
  span against its board thickness (`shelfSpanFor` in `carcass.ts`). What is missing is a **load-aware** check and
  showing it **while editing** instead of only at export (Capabilities 3 and 4).
- Most features from the earlier lists (sliding doors, opening doors, passport, price, accessories, lighting,
  corner wardrobes, kitchen Auto design) are now **consequences** of the capabilities above, not separate
  projects. Building them one by one on today's structure would add a sixth and seventh derivation of each piece.

---

## 12. Risks

| Risk | Answer |
|---|---|
| A big rewrite that stalls | No rewrite: every capability starts as an adapter around existing code, proven equal by tests, then replaces it one consumer at a time |
| Breaking the planner's guarantees | The hash-locked planner stays the wardrobe solver until a generic solver matches its goldens |
| Performance on phones | The build model and rules are cached by part hash and evaluated incrementally; physics only on what changed |
| Abstractions that fit nobody | Each phase is driven by a real feature (column "Feature that proves it"); no capability ships without one |
| File and line limits (400 lines, 240 chars) | New modules are small by design: one rule, one component, one target per file, as the registries already are |
