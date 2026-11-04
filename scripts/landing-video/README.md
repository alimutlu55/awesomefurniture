# FurniDraw landing films

Run from the project root. Install the project dependencies, Playwright Chromium, FFmpeg with libx264, Python 3 and Pillow. The default capture site is the development studio. Each film uses an isolated browser context, English, light mode, a 1088 × 680 viewport and double device scale. The edit uses settled frames from real actions, eased pointer movement, close-ups, and a half-second return dissolve. Timing is independent of WebGL speed and service latency.

## Recreate the six published loops

1. Capture the interactive stages.

   ```sh
   node scripts/landing-video/capture.mjs walls dimensions studio beauty parametric autolayout joinery
   ```

2. Start the repository’s development server in a second terminal for the embedded drawing viewer.

   ```sh
   npm run dev -- --host 127.0.0.1 --port 5370 --strictPort
   ```

   Capture the actual embedded editor, which reads the same design spec through the project’s own builder. It generates the plan, elevation, cutting schedule and all other sheets on demand. Shop drawings use millimetres. The main studio uses centimetres.

   ```sh
   EMBED_DRAWINGS=1 STUDIO_URL='http://127.0.0.1:5370/editor.html?lang=en' node scripts/landing-video/capture.mjs drawings
   ```

3. Capture the canonical furnished view for the hero. The beauty stage also supplies its closing shot.

   ```sh
   node scripts/landing-video/capture.mjs overview
   HERO_3D_END=1 python3 scripts/landing-video/encode.py hero studio parametric autolayout make drawings
   python3 scripts/landing-video/verify.py
   ```

The working captures default to `/tmp/furnidraw-landing-frames`. Set `CAPTURE_DIR` to a new folder before recording to isolate a fresh take. The encoder writes the named MP4 and JPG files into `public/assets/video/`. Run the capture again after an error before encoding that stage.

## Complete the real AI reveal

Use a development recording account with 10 credits, a working image provider and a Playwright storage-state file kept outside the repository. The capture waits for a successful image from the studio, decodes its result and saves the genuine photograph. It never uses the style thumbnails for the reveal.

```sh
FURNIDRAW_STORAGE_STATE=/private/path/to/dev-session.json node scripts/landing-video/capture.mjs render
python3 scripts/landing-video/encode.py hero render
python3 scripts/landing-video/verify.py hero render
```

## Recording notes

The room is 320 × 420 cm, with a 240 × 230 × 60 cm oak wardrobe. The resize take leaves additional clearance beside the wardrobe so the 300 cm width fits. Make uses a copy with an initially empty interior, then shows the cutting list for its actual shelf, drawer, hinged fronts and knob. For the drawing film, the standalone hosted viewer did not display sheets after the trial menu action. The embedded editor produced fourteen sheets and passed its manufacturing release check.

The development AI endpoint returned HTTP 502 with code `PROVIDER_ERROR` for Realistic photo and Studio look. Request ID for the Studio look attempt: `b90138ba-caab-4d91-af66-4c9093b49714`. The initial hero ends on the finished studio model; the real-render hero edit and render wipe are available in the encoder when a generation succeeds.
