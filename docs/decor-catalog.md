# Board SKU catalog

`src/domain/materials/decor-catalog.ts` is the shared source for the picker, Three.js materials,
Gemini prompt, and Material & Hardware Schedule. It contains 12 board decor/structure combinations
and a separate 38mm H1318 ST10 laminate worktop stock item. PM and ST9 are distinct IDs.
`ConfiguredMaterialsState` stores carcass/front IDs, linked selection, pulls, internal metal finish,
and an optional worktop ID. Only catalog IDs and compatible target zones pass persistence and API validation.

New editor cabinets store explicit material IDs. Documents without materials retain their original
geometry and resolve legacy Oak/White/Walnut/Graphite/Sage to a documented manufacturer decor.
The old `fin`/`finish` fields remain for version-1 document/pricing compatibility; once `materials`
exists it owns the appearance. Per-fitting legacy finish overrides also resolve through the catalog.
Changing a SKU is a normal undoable command and triggers the existing render/autosave workflow.

## Sources and stock specification

Manufacturer decor names and surface structures were checked on 2026-10-22:

- [Egger H1318 ST10 Natural Wild Oak](https://www.egger.com/en/furniture-interior-design/decors/H1318_10?country=GB)
- [Egger H3170 ST12 Natural Kendal Oak](https://www.egger.com/en/furniture-interior-design/decors/H3170_12?country=GB)
- [Egger H3734 ST9 Natural Dijon Walnut](https://www.egger.com/en/furniture-interior-design/decors/H3734_9?country=GB)
- [Egger U702 PM Cashmere Grey](https://www.egger.com/en/furniture-interior-design/decors/U702_PM?country=GB)
- [Egger decorative product/texture overview](https://www.egger.com/get_download/2af31a26-55b3-45c6-9a0e-27d963dcabdd/Product_Decors_and_Services_Brochure_2024.pdf)
- [Egger U638 ST9 Sage Green](https://www.egger.com/en/furniture-interior-design/decors/U638_9?country=GB)
- [Kronospan Cashmere, BS Bureau Structure](https://www.kronospan.com/en_US/decors/view/kronodesign/color/K5981/) (current regional page prefixes the code K5981; the catalog uses the 5981 trade designation).
- [Swiss Krono D3025 OW Sonoma Oak, 18mm sample](https://sklep.swisskrono.pl/produkt/d3025-ow-dab-sonoma-probka-plyty-laminowanej/)

The 18mm boards, 38mm laminate worktop and edge treatments are this configurator's chosen stock
specification, rather than a claim that every manufacturer supplies every thickness in every region.
PM denotes the lacquered PerfectSense product, not ST9 melamine with an anti-fingerprint coating.
Back panels remain the separately dimensioned 6mm backing in the cutting list. Untouched legacy
wardrobe doors remain 16mm; selecting materials makes solid doors 18mm. Unselected legacy worktops
remain 40mm. Selecting the 38mm worktop updates run geometry, appliance level, dimensions and cuts.
Different worktop selections split continuous runs. Glass doors retain their separate construction.

## Appearance and swatches

Hex colors and roughness are visual approximations, not spectrophotometer measurements or measured BRDFs.
The three Egger woodgrains use their actual 1024×576 manufacturer full-board scans, stored locally under
`public/textures/decors/`. Their source image URLs are recorded in that directory's README. They span
approximately 2311×1300mm with grain along the image's horizontal axis. Board UVs rotate the grain up
uprights/fronts and along horizontal boards. Unicolors have no woodgrain map. Swiss Krono uses its
color fallback until a verified swatch is added; no generic oak photograph is presented as its exact grain.
Textures share decoded images, have independent GPU ownership, and retain the fallback on load failure.

The image preparation step attaches available curated swatches after the three geometry references.
Each is deduplicated by SKU and labeled with its precise cabinet/module and target zones; the final
text instruction remains last. Missing assets leave textual descriptors intact. No arbitrary remote
URL from a request is fetched. The server validates swatch IDs against selected, textured catalog entries.
API consumers can omit `decorSwatches` for text-only material guidance.

The final Gemini text contains `serializeDecorPromptManifest` for each cabinet, exact SKU and structure,
board thickness, grain, edging and tactile descriptors. Handleless mode explicitly says zero visible
handles and 2mm shadow gaps. `LOG_LEVEL=debug` retains the existing full outgoing-body logging,
including this text and optional swatches, without API-key headers. Normal logs do not dump image data.

## Manufacturing and verification

The shared technical drawing model includes a paginated Material & Hardware Schedule. The viewer and
PDF use this same model. Cutting rows distinguish carcass, front and door SKUs, with actual cut thickness;
hardware rows replace pulls with push-to-open mechanisms in handleless mode. Hinge/runner drilling and
load ratings remain supplier-confirmed items.

`tests/architecture/decor-catalog.test.ts` covers linked/contrasting commands, validated persistence,
PBR colors/roughness, absent handles, the actual outgoing Gemini body/debug log, swatch scope/order,
manufacturing codes and worktop thickness. Provider calls are mocked; no paid render is required by tests.

Run `npm run check` for the full automated checks. With Vite running on port 5177, `npm run check:decors`
also checks the desktop/mobile picker, undo/redo, real WebGL capture and attached swatches in a browser.
Use `DECOR_TEST_URL` to select another development server and `DECOR_TEST_OUTPUT` for screenshots.
