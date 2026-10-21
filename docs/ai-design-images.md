# AI design images

The sparkle **AI image** button in the top toolbar captures the whole current design as three
1440 × 1080 JPEGs: front, left perspective and right perspective. The captures use the
existing materials and lighting, close the cabinet doors, include furniture hidden by editor
selection, and omit selection glows, dimensions and handles. A separate scene and offscreen
render target keep the editor camera and viewport unchanged.

The same synchronous snapshot supplies a versioned JSON specification with room walls,
openings, ceilings, furniture positions/rotations, dimensions, sections, resolved fitting and
divider positions, custom roof profiles, door details, finish colors and the full installation
technical drawing set (including construction, cutting/hardware lists and review issues).
Design lengths are centimetres; technical drawing lengths are millimetres. Camera metadata
travels with each reference. No saved project/session identifiers are required.

`POST /api/design-images` accepts `{ specification, references }` and returns
`{ model, image: { mimeType, data } }`. The server validates three distinct views, limits the
request to 12 MiB and specification to 2 MiB, and uses Gemini's Interactions REST API with
`gemini-nano-banana-2.1`, `store: false`, `generation_config.thinking_level: high`, automatic aspect ratio, and a 1K JPEG response. One photograph is generated
from all three references.

The model accepts at most 131,072 input tokens, so the server sends Gemini a compact copy of the
specification (`src/infrastructure/gemini/design-image-model-input.ts`): the `design` section is
unchanged, technical drawing sheets keep their titles, tables, pieces and checks but drop vector
`views` (keeping only view titles), and review issues repeated on every sheet are deduplicated into
one top-level `reviewIssues` list. A compact specification over 200,000 characters is refused with
413 `TOO_LARGE` before any provider request.

Clicking the toolbar **AI image** button opens an Apple-inspired presentation sheet with design highlights
and an explicit "Generate Image" option, rather than immediately initiating a paid generation.
During generation, users enjoy a magical waiting experience with animated aurora lighting, a celestial
luminous orb, twinkling particles, dynamic photography staging messages, and a glass cancellation control.
Technical artifacts like raw reference renders or internal JSON specifications are kept out of customer view.
When complete, the generated photograph is revealed with one-tap image saving and the option to generate again.
The app keeps the result only in the mounted editor's memory; download it before leaving the design.
Generated images are visualizations and may differ from precise construction geometry.

The server system prompt in `src/infrastructure/gemini/design-image-prompt.ts` uses the
architectural visualization and bespoke joinery instructions with `STAGING_LEVEL = 2`:
balanced styling, inclusive architectural camera framing, locked design geometry and
specified finishes, CAD artifact cleanup, and layered lighting. JSON remains authoritative
for dimensions and configured ceiling slopes; design text cannot override the instructions.

While generation runs, an animated sparkle, light trails, and floating cards show the three
captured views. The two progress labels reflect capture and the pending image request;
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
Provider response bodies and credentials are never logged or returned to the browser.
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
