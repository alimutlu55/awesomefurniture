import type { DesignReferenceImage, RenderPromptConfig } from '../../application/projects/design-image.ts';

export type { RenderPromptConfig };

export const GEMINI_DESIGN_IMAGE_REFERENCE_LABELS: Record<DesignReferenceImage['view'], string> = {
  front: 'Use Image 1 as the strict camera and TIER 1 structural reference for the configured joinery. '
    + 'Keep the exact cabinet geometry, module divisions, proportions, and camera perspective unchanged, '
    + 'while applying TIER 2 cleanup to remove any protruding floor-base strips and extend the truncated walls, '
    + 'ceiling, and wooden floor seamlessly to fill the 4:3 frame.',
  left: 'Image 2 (left supporting view) shows the SAME design as Image 1. '
    + 'Use it strictly to verify internal module divisions and occluded geometry; do not adopt its camera angle or duplicate the furniture.',
  right: 'Image 3 (right supporting view) shows the SAME design as Images 1 and 2. '
    + 'Use it strictly to verify internal module divisions and occluded geometry; do not adopt its camera angle or duplicate the furniture.',
};

/** Resolve all conditionals before sending instructions, so inactive concepts cannot influence the photograph. */
export function buildSystemInstruction(config: RenderPromptConfig): string {
  const stylingByCategory = config.category === 'wardrobe'
    ? '- Inside/On the Joinery: Upgrade rigid 3D placeholder garments and boxes in the exact same compartments '
      + 'into tactile real-world equivalents—linen or felt storage boxes, tailored garments with natural cotton/wool weight '
      + 'and drape on hangers, neatly folded knitwear/trousers, and 2–3 pairs of minimal footwear where appropriate.'
    : '- On/In the Joinery: A designer kettle or espresso machine, a ceramic vase with botanicals, a wooden board '
      + 'leaning on the backsplash, stacked bowls or glassware on open shelves. Keep worktops uncluttered.';
  const stagingByLevel = {
    1: '- Foreground Atmosphere (Level 1): Joinery-only styling. Keep the surrounding floor and foreground completely empty.',
    2: '- Foreground Atmosphere (Level 2): Add at most 1–2 low-profile movable props near the outer frame edges '
      + '(e.g., a minimal plant, a small stool, or slippers), kept at least 60cm clear of the cabinet base '
      + 'so the plinth-to-floor junction remains completely unobstructed.',
    3: '- Foreground Atmosphere (Level 3): Add a restrained seating vignette or rug in the wider room '
      + 'without covering or crowding the cabinets, plinths, or doors.',
  }[config.stagingLevel];
  const ceilingRule = config.hasCeilingBulkhead
    ? 'Finish truncated walls cleanly up to a continuous flat ceiling, with a flush bulkhead/fascia between tall cabinets and the ceiling.'
    : 'Finish truncated walls cleanly up to a continuous flat ceiling while preserving the open top clearance above the freestanding/alcove cabinetry.';
  const ledRule = config.hasIntegratedLed
    ? 'Concealed 2700K LED strips under wall cabinets/shelves, above hanging rails, and inside open compartments.'
    : 'Subtle natural bounce light inside open compartments without inventing built-in LED strips unless visible in the 3D reference.';

  return `You are an elite Editorial Interior Photographer (Architectural Digest editorial standard, shot on a Phase One IQ4
medium-format camera with a 28–35mm tilt-shift lens) and a Bespoke Joinery Specialist.

Transform the provided 3D configurator reference image(s) into a single ultra-photorealistic, lived-in luxury residential
photograph that is 100% faithful to the customer's configured joinery.

### 1. Camera & Perspective
- Use Image 1 as the strict camera and compositional anchor, keeping all cabinet wings clearly visible.
- Enforce strict two-point architectural perspective (all vertical cabinet edges and wall corners 100% vertical and parallel),
eye-level camera at 130–140cm.
- Use supporting views (Images 2+) strictly as spatial references to verify module divisions, internal accessories, and side
geometry; never blend their camera angles or duplicate the furniture.

### 2. Three-Tier Reality Rules

TIER 1 — LOCKED (never alter):
- Exact cabinet layout, corner intersections, module divisions, widths, door/drawer counts, handle positions, open shelves,
internal organizers (hanging rails, trouser racks, storage boxes), and overall footprint.
- Existing wall corners and any window, door, or architectural opening present in the 3D references.
- Positions of any user-placed sockets, switches, or lamp points (render them as flush architectural hardware or sconces).
- All customer-specified materials, colors, and finishes explicitly listed in the user prompt.

TIER 2 — ENHANCE & CLEAN UP (complete the unfinished 3D environment):
- Remove all 3D viewport artifacts: delete protruding wall-base strips/bars across the floor, floating planes, cropped floor
polygons, open wall cross-sections, gizmos, grids, and wireframes.
- ${ceilingRule} Extend the flooring seamlessly to the edges of the frame so the joinery sits inside a complete, enclosed room.
- Upgrade flat 3D shaders and unspecified room surfaces into tactile physical materials: natural woodgrain with realistic pore
depth and crisp 1mm edge-banding, ultra-matte finishes with clean 2mm shadow gaps between doors/drawers, realistic anodized or
brushed hardware, matte plaster walls, and wide-plank or parquet oak flooring with natural satin reflection.

TIER 3 — FORBIDDEN (never invent):
- Never invent new windows, glass doors, exterior views, or structural wall cutouts not shown in the 3D references.
- Never place furniture or props that hide, touch, or block cabinet doors, drawers, or plinths.
- Never add doors to open shelves or remove doors from closed modules.

### 3. Lived-In Styling & Staging
${stylingByCategory}
${stagingByLevel}

### 4. Multi-Layered Photographic Lighting
1. Natural Off-Camera Daylight: If no window opening exists in the 3D capture, illuminate the room with soft directional
off-camera daylight, creating natural shadow falloff across the walls and floor and deep ambient occlusion inside recessed
cabinet bays. Do not render a visible window.
2. Architectural Lighting: Soft warm 2700K recessed ceiling wash, plus: ${ledRule}
3. Physical Realism: Crisp contact shadows where the cabinet base meets the floor, accurate micro-contrast on matte surfaces,
and zero plastic 3D shader sheen.`;
}

/** Opens the final text block; the Tier 1 manifest follows it. */
export const REALISTIC_REQUEST = 'Create one realistic 2K interior photograph using Image 1 for the exact camera framing and cabinet structure, '
  + 'and Images 2 and 3 only for supporting details.';

/** Closes the final text block, after the Tier 1 manifest. */
export const REALISTIC_COMPLETION = '- TIER 2 Room Completion: Seamless matte off-white plaster walls and ceiling where no wall finish is specified, '
  + 'continuous oak flooring, and soft directional off-camera daylight. '
  + 'Remove protruding floor-base strips and complete cropped background geometry. '
  + 'Include a brief text description of the result mentioning the applied manufacturer board SKUs and surface structures.';
