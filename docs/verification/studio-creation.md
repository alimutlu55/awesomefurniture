# Studio-aware wardrobe creation

The reported overlap reproduced with a 150 × 115 cm prepared room and a sloped/flat ceiling.
The old Add path tried room placement, then silently used an open-floor pose when no spot fit.
It inserted the cabinet and consumed its identity/history checkpoint before checking the ceiling result.
The new regression failed against that implementation: a default 200 cm wardrobe intersected the walls,
and a room too small for any wardrobe still received one.

Creation now prepares detached candidates in `place-created-cabinet.ts` before committing anything.
It searches inward-facing wall positions and validates physical walls, other wardrobes and opening access.
Default width/depth can shrink within the existing 80–400 / 15–80 cm limits. Explicit width/depth and
copied footprints remain fixed. A selected wall/offset never falls back to another wall or the open floor.
The automatic top follows the studio ceiling, including slopes across the hidden rear edge; a final
full-surface ceiling check catches any penetration missed by the fitting approximation. Flat room height
also constrains creation when no separate ceiling feature exists.

Opening access uses a 50 cm room-side reservation with 7 cm casing at each edge, at the opening's actual
sill/height. This is an automatic-placement rule; existing drag/movement wall solids are unchanged.
A low wardrobe can still fit below a window. Minimum-height footprint checks reject occupied positions
before expensive ceiling sampling, so a filled room does not trigger a long fitting search.

Only a validated candidate enters the scene, with one undo checkpoint and identity increment. Failure
returns `null` and preserves existing wardrobes, active selection and undo history. The existing picker
stays available and never displays a false “added” result. Design-spec creation uses the same path.
The old under-stairs examples now leave 50 cm beside the adjacent door (330 cm wardrobe, rather than
380 cm spanning the access strip); their planning, save/reload and agent API checks still pass.

Validation: `npm run check` (702 tests) and `npm run check:mobile`. The latter now includes
`node --import tsx scripts/check-studio-placement.cjs`: it creates wardrobes through the UI in a narrow
sloped room, the same room with a door, and an unbuildable room, at 375 × 812 and 1440 × 900.
It independently checks the public report's placement against collision and full-depth ceiling rules,
then checks undo/redo and the room from an angled view. Supabase requests are mocked in this regression.
Unit cases additionally cover exact requests/offsets, failed duplication, flat low ceilings, translated
and rotated rooms with thick walls, shallow rooms, rear ceiling clearance, windows and save/reload.
Physical iPhone Safari was not available for verification.

Existing saved invalid placements are preserved; undo/remove that old addition and add again to use
the corrected placement rules.

Screenshots: [empty studio](studio-creation-before.png), [fitted wardrobe on phone](studio-creation-mobile.png),
[desktop](studio-creation-desktop.png).
