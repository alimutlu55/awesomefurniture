# The experience layer: welcome, assembly, moods, reveal

Branch: `feature/extraordinary`. Everything here draws over the editor and changes how the scene *looks*.
The design itself changes only when a person builds one in the welcome (one undo step). Golden fixtures,
saved projects and the planner are untouched.

## What a person sees

1. **Welcome.** A new, empty design opens one of the editor's own panels, *Where will it live?*: docked beside
   the view on desktop, the shared bottom sheet on phones (handle, compact and expanded heights, scrolling,
   pull down or × or Escape to close, which puts the design back as it was). Pick a space (bedroom wall,
   alcove, walk-in, attic eaves, under the stairs, just the wardrobe) and the room appears in 3D beside or above
   the panel. Then *What goes inside?*: count belongings, starting from a way of living (Travel light, Everyday,
   Clothes lover, Two of us), and **Build**. The menu's **Plan from what I own** opens it again on any design
   (Undo takes the result back). Another panel opening closes it, as panels replace one another.
2. **Assembly.** The built design goes together in front of them, in a cabinetmaker's order: base, sides,
   back, top, then shelves, rails and drawers slid in from the front, doors last. Each part lands with a soft
   wooden knock (sounds are made as they play, no recordings). The camera frames the design as for any design.
   Whenever Auto design applies a layout to a wardrobe, its fittings fly into the carcass the same way.
3. **Reveal**, in the same kind of panel: *Everything fits.* (or *Almost everything fits.* with what is still to place), possession by
   possession, with *See it at night*, *Workshop* and, when something is short, *More layouts*.
4. **Moods** (the button left of AI image, a dropdown like the menu): **Living** (as it will look at home), **Maquette** (a white card
   architect's model), **Workshop** (a blueprint of lines); and the light of **Midday**, **Morning**, **Sunset**
   or **Night**, when the wardrobes' own LED strips light them from inside. Workshop adds **Take apart** (an
   exploded view), **Flat front elevation** (a dolly zoom into an elevation, square to the wardrobe) and
   **Open shop drawings**. The look, the time of day and Sounds are remembered in the browser.

## Files

| Layer | File | What it owns |
|---|---|---|
| Domain | `wardrobe/possessions.ts` | An `icon` for every possession; `possessionIcon(p)` |
| Presentation | `experience/experience.ts` | Composition: wires everything below into the editor, the per-frame hook, `neutral()` for captures, `persisted()` for saving during previews |
| Presentation | `experience/welcome.ts`, `welcome.css`, `space-art.ts` | The welcome sheet, its steps and counting, the space drawings |
| Presentation | `experience/spaces.ts` | The spaces offered (`SPACES`) and ways of living (`PERSONAS`) as design specs; belongings shared between wardrobes |
| Presentation | `experience/spec-worker.ts`, `spec-worker-client.ts` | `buildFromSpec` (Auto design included) off the page's thread, built ahead while the person counts |
| Presentation | `experience/reveal.ts` | The fit reveal; `fitSummary(report)` |
| Presentation | `experience/mood-control.ts`, `experience.css` | The mood button and panel; backdrops and labels for each mood |
| Presentation | `experience/stage-framing.ts` | Keeps the design in the free part of the view beside or above the welcome sheet |
| Presentation | `experience/wood-sounds.ts`, `preferences.ts` | Synthesised knocks and chord; the viewer's own choices in local storage |
| Viewport | `viewport/assembly-motion.ts` | Parts flying in (`play`) and the exploded view (`explode`); pure `assemblyPhase`, `assemblyApproach`, `explodedOffset` |
| Viewport | `viewport/scene-looks.ts` | Living, maquette, workshop: materials changed in place and put back exactly; edge lines |
| Viewport | `viewport/daylight.ts` | `TIMES_OF_DAY` (the first is the editor's own light) and the night lamps (`lampSpots`) |
| Viewport | `viewport/workshop-lens.ts` | The blueprint grid and the dolly zoom (`dollyZoom`) |
| Viewport | `viewport/scene-lighting.ts` | `MIDDAY_LIGHT`, and `set(setting)` for a time of day |
| Viewport | `viewport/viewport-resources.js`, `frame-renderer.js` | `frameHooks`: per-frame work after the camera is placed, before the frame is drawn |

## Decisions (keep them)

- **The scene's mood is not the design.** Looks and light are per viewer (local storage), never saved in a project,
  and `neutral()` draws the plain scene for AI image references and design thumbnails.
- **Materials are changed in place and restored exactly**, including a board's own shader (`onBeforeCompile`) and
  maps. New surfaces (a rebuilt wardrobe) are directed in the frame they appear, so nothing flashes.
- **The camera stays the editor's.** The workshop lens and the stage framing change the camera only after the editor
  has placed it each frame, and give it back unchanged (`applyView`) when they end. Every framing and gesture keeps working.
- **A preview is not saved.** While the welcome previews a space, `editor.scene()` (what is autosaved and what agents
  describe) is still the design it opened over.
- **Automated browsers start without the welcome** (`navigator.webdriver`), so scripted checks and assistants drive the
  editor directly. `?welcome=1` shows it anyway; `?welcome=0` never does. A design link (`#design=`, `#spec=`) opens
  the design instead.
- **Panels are the editor's panels.** The welcome and the reveal are `.pop.editor-panel`: the shared rules in
  `mobile-sheet.css` place and style them, and `mountMobileSheet` gives them the handle and gestures. The mood
  panel is a `.dd` dropdown mounted like the menu. None of them blurs the 3D view behind it.
- **Phones first.** Nothing moves the camera on its own (no sways or sweeps: the person's gestures are never
  fought). Night lights the whole scene with at most two lights (the strips glow in every section); the looks
  walk the scene only after a rebuild; shadows are redrawn when parts have landed, not while they fly.
- **Reduced motion:** no assembly, instant lens; the CSS animations stop.
- Listeners, timers, frames and observers go through the editor `lifetime` (`experience/lifetime.ports.d.ts`).

## Adding to it

- **A space:** one entry in `SPACES` (room by template or size, ceilings, wardrobes with their `share`) and a drawing in
  `space-art.ts`. `tests/architecture/experience.test.ts` builds every space, empty and planned.
- **A time of day:** one entry in `TIMES_OF_DAY` and a sky in `mood-control.ts`'s `SKIES`; a backdrop in `experience.css`.
- **A look:** a `SceneLook`, its surfaces in `surfaceLook`, a tile in `mood-control.ts` and a backdrop in `experience.css`.

## Known limits

- The welcome builds wardrobes only (as the design spec does); kitchens start from Add.
- Kitchen units get no night lamps.
- Sounds cannot be verified by the automated checks; they are quiet and follow the Sounds switch.
- The workshop's flat elevation squares to the active wardrobe; an L-shaped run shows one side at a time.
