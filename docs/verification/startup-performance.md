# Initial texture loading

The first scene used six uncompressed-for-web 2048² source JPEGs. Requests only started while creating
the renderer, after identity/session restoration. Each colour image then triggered a canvas readback,
two full pixel loops, and another canvas upload on the main thread. This made the floor and cabinet
appear plain first, then change as separate maps arrived.

Runtime maps now use pregraded 1024² WebP colour/normal images and 512² roughness. The original material
colours, physical tile sizes, lighting, geometry, controls and layout are unchanged. Fine texture detail
is filtered at a lower resolution; this deliberately reduces transfer and GPU upload/mipmap work.
Source JPEGs and an offline generator remain available; see public/textures/MANIFEST.md.

Both entry pages preload colour maps. Other maps start with session restoration. Mounts reuse decoded
images and install completed loads immediately, including the first frame. Pending callbacks ignore
disposed textures. Missing assets retain the existing neutral fallback.

## Measurement

Production build, headless Chrome, cold HTTP cache, 375×812 at DPR 2, 500,000 bytes/s download (4 Mbps),
80 ms network latency, 4× CPU slowdown. Auth requests are mocked as unavailable in both runs to isolate
texture loading from variable Supabase service time. Times below are texture response completion from
navigation, **not total app startup** or a measurement on physical iPhone hardware.

| Metric | Before (`cfb087b`) | After |
| --- | ---: | ---: |
| Six maps transferred | 15,489,374 bytes | 749,280 bytes (95.2% less) |
| Last texture response | 33.4 s | 2.7 s |
| First colour request | 2.27 s | 0.10 s |
| Main-thread colour grading | 170 ms + 188 ms | Removed |

These are controlled single-run diagnostic comparisons, not production percentile estimates.
Shader compilation and device GPU performance still vary. Texture filtering/compression was visually
checked with a furnished wardrobe on desktop and at 375px. Physical iOS Safari was not available.

## Repeat

1. `npm run build` and `npm run preview -- --host 127.0.0.1 --port 4173`.
2. `node scripts/check-startup.cjs` (set `CHROME_PATH` if Playwright's browser is not installed).
3. The script writes `/tmp/wardrobe-startup.json` and `.png`, prints resource/long-task timings, and
   enforces a <1 MB texture budget, six successful WebP loads, and no runtime colour grading.
   `PROFILE_URL`/`PROFILE_OUT` override URL/report prefix; `STARTUP_BASELINE=1` disables the new budgets
   when profiling the original build using the same script.
4. `npm run check` and `npm run check:mobile` cover typechecks, boundaries, unit/integration and existing
   desktop/mobile interaction regressions. Four added tests cover image reuse, ready-before-mount,
   missing assets, document isolation and disposal during loading.

Screenshots: [desktop](startup-desktop.jpg), [phone](startup-mobile.jpg).
