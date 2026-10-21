# AI design images

The sparkle **AI image** button in the top toolbar captures the whole current design as three
1024 × 768 (1K) JPEGs at 97% quality: front, left perspective and right perspective. The captures use the
existing material colors and texture maps with a neutral, unlit capture pass, close the cabinet doors, include furniture hidden by editor
selection, and omit selection glows, dimensions and handles. A separate scene and offscreen
render target keep the editor camera and viewport unchanged.
All three cameras fit the complete visible furniture geometry, including elevated upper units,
shared worktops and rotated return wings, with an 8% margin at every image edge. A level camera
at 135 cm and a 45° vertical field of view (approximately a 32 mm architectural lens at 4:3)
keep verticals parallel. Supporting cameras turn 20° to either side of the overview and retain
the same whole-design target instead of zooming into individual wings.

Reference captures have no directional lighting, environment reflections, shadow maps, painted
contact shadows or ambient-occlusion overlays. Unlit materials preserve diffuse textures,
configured colors, transparency and glass outlines. Editor-only darkening of cabinet backs and
plinths is removed for the reference pass. Thin geometry contours keep actual panel divisions
legible where adjoining faces share the same color, without shading the surfaces. Tone mapping is disabled during capture; the editor's
materials, lighting, shadow settings and exposure are restored before returning to the viewport.

The same synchronous snapshot supplies a versioned JSON specification with room walls,
openings, ceilings, furniture positions/rotations, dimensions, sections, resolved fitting and
divider positions, custom roof profiles, door details, finish colors and the full installation
technical drawing set (including construction, cutting/hardware lists and review issues).
Design lengths are centimetres; technical drawing lengths are millimetres. Camera metadata stays within the app’s request and is not forwarded to Gemini. No saved project/session identifiers are required.

`POST /api/design-images` accepts `{ specification, references, renderConfig? }` and returns
`{ model, image: { mimeType, data }, text? }`. The server validates three distinct views, limits the
request to 12 MiB and specification to 2 MiB, and uses Gemini's Interactions REST API with
`gemini-nano-banana-2.1`, `store: false`, `generation_config.thinking_level: high`, and a text-plus-image response (`response_format: [{ type: "text" }, { type: "image", mime_type: "image/jpeg", image_size: "2K", aspect_ratio: "4:3" }]`). The output aspect ratio matches the reference captures to avoid cropping or expanding the room. One 2K photograph is generated
from all three references. Final model text is shown beneath the photograph when returned; thought steps are excluded. Image-only responses remain usable, while responses without an image still report a generation error.

Gemini receives the three reference images, numbered plain-language view roles, dynamic system
instructions and a concise Tier 1 manifest of selected finishes and per-wing modules.
`serializeConfigurationSummary` extracts only active finishes, fitting overrides, accessories, bays,
item sizes/positions, divider layouts and selected wall finishes from the validated specification.
Unselected palette entries, full design JSON, technical drawings, and camera metadata are never forwarded to Gemini. The app retains its versioned specification for validation,
preview and download. The compact JSON preview omits drawing vectors and deduplicates review
issues using `src/application/projects/design-image-model-specification.ts`.
The server always orders the images as front, left and right, even if the request arrives in a
different order. The three numbered labels identify front, left and right overviews of the same
design. Image 1 locks the camera and configured joinery geometry; Images 2 and 3 verify internal
module divisions and occluded geometry without changing the camera or duplicating furniture.
Tier 2 explicitly removes floor-base strips and completes cropped walls, ceiling and flooring.

Clicking the toolbar **AI image** button opens an Apple-inspired presentation sheet with design highlights
and an explicit "Generate Image" option, rather than immediately initiating a paid generation.
During generation, users enjoy a magical waiting experience with animated aurora lighting, a celestial
luminous orb, twinkling particles, dynamic photography staging messages, and a glass cancellation control.
Opening the dialog immediately prepares the three 1K reference images and shows them with full-size links. An expandable JSON preview and download show the compact design specification, explicitly marked as not sent to Gemini. Generate reuses the reviewed snapshot; reopening the dialog refreshes it from the current design.
When complete, the generated photograph is revealed with one-tap image saving and the option to generate again.
The app keeps the result only in the mounted editor's memory; download it before leaving the design.
Generated images are visualizations and may differ from precise construction geometry.

The server calls `buildSystemInstruction(config)` in `src/infrastructure/gemini/design-image-prompt.ts`
with category, staging level (1, 2 or 3), `hasIntegratedLed` and `hasCeilingBulkhead`. Optional
`renderConfig` supplies these settings; its category must match the configured furniture. Without
it, category follows the furniture product (kitchen if any kitchen unit exists, otherwise wardrobe),
staging defaults to Level 2, and both flags default to false. The current editor uses these defaults;
it has no staging, LED or bulkhead controls. Only the active category, staging and lighting/ceiling
rules reach Gemini. Rug styling appears only at Level 3. The photographic anchor is Architectural
Digest editorial quality with a Phase One IQ4 and 28–35 mm tilt-shift lens. Tier 1 locks the selected
finishes and joinery; Tier 2 completes the room and removes CAD artifacts. Shadow-free reference
captures communicate finishes; the photograph receives natural shadows and lighting.

While generation runs, an animated sparkle and light trails show the waiting state; the reference preview returns after generation. The two progress labels reflect capture and the pending image request;
the animation does not estimate a completion percentage. Decorative captions rotate, with
a longer-wait message after a minute. Reduced-motion preferences disable all loader motion.
Success, errors, cancellation, and editor disposal stop the animation and its timers.

## Configure the key

For `npm run dev` and `npm run preview`, set `GEMINI_API_KEY` in the shell environment or
in the ignored `.env.local` file, then restart Vite. There is no client-side key setting.
Never use `VITE_GEMINI_API_KEY`: Vite exposes `VITE_` variables to browsers.

For Cloudflare, set the runtime secret separately on production and development:

```sh
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GEMINI_API_KEY --env dev
```

These commands prompt for the key; do not put it in the command line or wrangler.jsonc.
Build-time environment variables on Workers Builds do not substitute for runtime secrets.
For Wrangler local development, copy `.dev.vars.example` to `.dev.vars` and set the value
there. Both secret files are ignored by git. Use a Gemini project with image-generation
access and billing enabled. A missing key produces a 503 with the operator code `NOT_CONFIGURED`.
Customers see only “Image generation is temporarily unavailable. Please try again later.”
The browser maps known error codes to customer copy and never displays server/provider message text,
including messages about credentials, billing or configuration. Unexpected browser errors use the same safe fallback.

Cloudflare serves static assets as before and routes `/api/*` to `src/app/worker.ts`.
The API rejects cross-origin browser requests and uses a Cloudflare rate-limit binding
allowing three generations per minute per IP/location. Vite uses a shared three-per-minute
local limit. This public anonymous editor does not authenticate generations; use provider
quotas/budget controls for an appropriate total spending limit. Cancellation aborts the
request, but a generation already accepted by Google may still incur charges. Requests
have a 150-second upstream timeout and are never automatically retried.

Errors use `{ error: { code, message } }` with 400 (invalid design/JSON), 403 (origin),
405 (method), 413 (size), 415 (content type), 429 (limit/quota), 502 (provider/no image),
503 (configuration), and 504 (timeout). All API responses use `Cache-Control: no-store`.
Before each provider call, the server logs the complete serialized Gemini request body, including
system/user prompts, design summary, and base64 reference images, under the
`gemini_image_request` event. The API key is in a separate header and is not logged. These logs
contain user design data; restrict log access and retention accordingly. Provider response bodies
and credentials are never returned to the browser.
Server failure logs contain only an event name, generated request ID, model, application error code,
upstream HTTP status, Google's canonical error status (`providerReason`, e.g. `INVALID_ARGUMENT`) and
Google's error message (`providerMessage`) with key-like and long base64-like runs redacted and capped
at 300 characters; the request ID is also returned in `X-Request-ID` for operator correlation.
The Interactions `ImageResponseFormat` supports JPEG output. PNG is accepted for reference inputs,
but must not be requested as the output MIME type; the viewer downloads the actual returned format.
Do not set `response_format.delivery`: although listed in the schema, Nano Banana 2.1 rejects it
with 400 "Image delivery mode is not supported." and returns inline image data by default.

API references: [Nano Banana 2.1](https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1),
[image generation](https://ai.google.dev/gemini-api/docs/image-generation), and
[Interactions API](https://ai.google.dev/api/interactions-api).

## Verification

`npm run check` includes request validation, outbound Gemini contract, safe provider errors,
rate limits, geometry cleanup, specification fidelity and static-asset routing tests.
With Vite running on port 5177, run `npm run check:ai-images` for real WebGL captures
of a shaped wardrobe and an L-shaped kitchen, desktop/mobile loading layouts, reduced motion,
download, retry, cancellation, and disposal checks. The script holds the mocked response while
verifying the loading state, then writes review images
and JSON to `/tmp/wardrobe-ai-verification` (override with `AI_IMAGE_OUTPUT`). It makes no
paid Gemini calls. A live smoke test requires the configured runtime key.
