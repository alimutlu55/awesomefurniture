# Native floor plan: audit and implementation

## Audit before implementation

- Canonical state: `EditorScene.studio` already contains corner nodes, directed wall edges, thickness, height, hosted openings with offset/width/height/sill/hinge/swing, ceilings and fixtures. Cabinets retain their full `EditorState` and their world pose. No second geometry store is needed.
- Geometry: `wallFace` intersects inner faces; `moveCorner`, `moveWall`, `setInsideLength`, `mergeCorners`, and opening edits operate on this graph. Studio commands validate topology and cabinet collisions. `snapCorner`, `wallTargets`, `alignTo`, and `snapToWall` provide existing magnetic interactions.
- Rendering: Three.js perspective scene, raycasting and HTML screen overlays are coupled to perspective editing. A flat SVG projection avoids ceiling occlusion and reuses the canonical geometry without replacing the camera. Only finished edits rebuild the 3D scene.
- History/persistence: `createSceneHistory` stores editor model snapshots. Inspector refresh feeds the existing project mapper and autosave. Plan gestures use one before snapshot and rollback on cancellation.
- UI: use the existing floating mode controls, `tb`, `fl`, design variables, and reusable measurement badges for exact entry. Pointer capture and requestAnimationFrame coalesce gesture updates.

## Compatibility decision

No graph schema extensions are required: all requested entities already exist. Existing projects hydrate through the existing mapper unchanged, including unconfirmed door handing. The application-wide unit is centimetres at 0.1 cm precision. New floor-plan coordinates are quantized to this millimetre lattice. Changing the persisted schema to integer millimetres is deliberately deferred: it requires migrating every furniture, fixture, profile, server validator and export consumer, beyond a view-mode change. This implementation does not claim integer-mm storage.

## Verification

Geometry tests cover shared-node connectivity, opening bounds, miter points, cabinet identity and history rollback. Type checks, boundary checks and the existing regression suite are run alongside browser checks. A locked 60fps guarantee requires measurements on physical target phones; it cannot be inferred from frame scheduling.

## Delivered controls

The 2D button beside Studio/Furniture opens a plan without changing selection scope or the saved camera. The same button returns to 3D. Drag empty floor to pan, pinch or use wheel/zoom controls, and use Fit to frame the design. Wall creates connected runs by tapping corners; Select exits drawing. Drag wall centres to offset connected walls, corner dots to reshape them, and doors/windows to slide along their hosts. Tap dimension pills for exact entry in the current measurement unit. Selected openings expose width, height, sill (windows), offset, hinge and swing controls. Furniture preserves its configuration while translating or rotating and snaps to nearby wall faces; blocked poses are rejected. Escape cancels a gesture, exits drawing, or returns to 3D, in that order.

## Validation and remaining limits

- `npm run check`: dependency boundaries, architecture rules, editor type checks, 1,500 tests, production build, and SEO audit.
- `node scripts/check-floor-plan.cjs` (local preview defaults to port 5198; override `MOBILE_TEST_URL`): 390px phone and 1440px desktop, exact wall lengths, door placement/swing/size, connected corner edits, wall drawing, furniture configuration preservation, wall snapping, cancellation, undo/redo and mode switching. Phone also exercises two-finger pinch.
- No dependencies added. The existing project format, history snapshots and persistence mapper are reused. Legacy project roundtrip is covered by tests.
- Integer-millimetre canonical storage and its application-wide migration are **not implemented**. Existing centimetre-domain conventions remain; graph edits round to millimetres, while flush furniture placement retains the existing geometry engine's precision.
- Plan miters are derived for the architectural projection; the existing 3D wall renderer retains its own join construction. This change does not replace that renderer.
- The 3D camera is retained exactly; switching is immediate, without an animated camera flight. Physical-device 60fps profiling remains outstanding.
