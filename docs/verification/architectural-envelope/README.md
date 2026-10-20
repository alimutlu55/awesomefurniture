# Epic 2: architectural envelope and spatial dimensioning

Implemented ENV-01, ENV-02 and ENV-03 in the shared technical drawing model used by SVG and PDF.

- Three vertical tiers: one reference cabinet stack, key installation levels, outer floor-to-ceiling total.
  Internal board dimensions and unrelated cabinet tops remain on individual shop sheets.
- Every room wall has an elevation, including walls without furniture. Wall sections, open-end
  breaks, window Hp/lintel heights, doors and radiators remain in the exported room context.
- Dashed 90° cabinet and room-door arcs, full-extension drawers and appliance drop-down envelopes.
- Minimum aisle dimensions across the full run width, including worktop overhangs, narrow obstacles,
  rotated layouts and radiator projections. Narrow aisles and static opening clashes are flagged.
- Short dimension figures spread along their tier with leaders, keeping all three tiers readable.

Verification: `npm run check` (874 tests, boundary/architecture rules, typechecks and production build).
Run Vite on port 5177, then `node --import tsx scripts/check-architectural-envelope.mjs` to reproduce
screenshots and PDFs. The script mounts a local fixture without connecting to saved user designs.
It checks four wall elevations, desktop and 375 px layouts, zoom, closing and the actual PDF download.

- `desktop-plan.png`, `desktop-elevation.png`: actual drawing viewer on desktop.
- `mobile-plan.png`, `mobile-zoom.png`: actual drawing viewer at 375 px.
- `envelope.pdf`: vector fixture output; `viewer-export.pdf`: PDF downloaded through the viewer.

Room-door handing is not currently stored: doors use a documented left-hinged inward swing.
The 900 mm aisle threshold is a project review reference. Opening checks compare each moving front
against static geometry; simultaneous moving-front clashes are not simulated. Without a room, the
outer elevation total is the piece height. Existing sloped-ceiling elevation limitations are unchanged.

## Superseded viewer evidence

These images record the original Epic 2 implementation. The current purpose-based viewer,
confirmed door handing, configurable clearance profiles and simultaneous-operation review are
verified in [professional drawings](../professional-drawings/README.md). The legacy check command
now runs that suite. The limitations above describe the earlier version only.
