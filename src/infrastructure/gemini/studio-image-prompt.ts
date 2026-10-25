import type { DesignReferenceImage, RenderPromptConfig } from '../../application/projects/design-image.ts';
import { GEMINI_DESIGN_IMAGE_REFERENCE_LABELS } from './design-image-prompt.ts';

/** The supporting views keep the realistic wording: they only verify geometry, whatever the look. */
export const STUDIO_REFERENCE_LABELS: Record<DesignReferenceImage['view'], string> = {
  ...GEMINI_DESIGN_IMAGE_REFERENCE_LABELS,
  front: 'Use Image 1 as the strict camera and TIER 1 structural reference for the configured joinery. '
    + 'Keep the exact cabinet geometry, module divisions, proportions, and camera perspective unchanged, '
    + 'while applying TIER 2 cleanup to remove any protruding floor-base strips and finish the truncated walls, '
    + 'ceiling, and floor as a clean, minimal studio set that fills the 4:3 frame.',
};

/**
 * A manufacturer's catalogue photograph: the joinery is the only subject, lit evenly in a quiet set so its
 * finishes read true to the board swatches. Staging levels belong to the realistic photo and are not used here.
 */
export function buildStudioSystemInstruction(config: RenderPromptConfig): string {
  const stylingByCategory = config.category === 'wardrobe'
    ? '- Inside the Joinery: Keep every configured garment, folded stack and storage box in its exact compartment, rendered '
      + 'as real, neatly pressed items in a restrained tonal palette (white, oatmeal, stone, soft grey) with generous breathing '
      + 'room between them. Garments hang straight on matching slim hangers; boxes are plain linen or felt. No logos, prints or bold colors.'
    : '- On/In the Joinery: Worktops stay clear except for at most one sculptural ceramic piece. Open shelves hold a few '
      + 'matching white ceramics or clear glassware in neat, evenly spaced groups. No appliances or clutter beyond those configured.';
  const ceilingRule = config.hasCeilingBulkhead
    ? 'Finish the truncated walls up to a flat ceiling, with a flush bulkhead/fascia between tall cabinets and the ceiling.'
    : 'Finish the truncated walls up to a flat ceiling while preserving the open top clearance above the freestanding/alcove cabinetry.';
  const ledRule = config.hasIntegratedLed
    ? 'Concealed LED strips under wall cabinets/shelves, above hanging rails, and inside open compartments glow softly, '
      + 'balanced a little below the studio light so they never flare or cast colored spill.'
    : 'Open compartments are filled evenly by the studio light; do not invent built-in LED strips unless visible in the 3D reference.';

  return `You are a commercial furniture photographer shooting the hero image for a premium joinery manufacturer's catalogue
(shot on a medium-format camera with a 32mm tilt-shift lens at f/11) and a Bespoke Joinery Specialist.

Transform the provided 3D configurator reference image(s) into a single high-key studio product photograph of the
customer's configured joinery, standing in a clean, minimal room set. The joinery is the only subject, and it must be
100% faithful to the configuration, with every finish reading true to its manufacturer swatch.

### 1. Camera & Perspective
- Use Image 1 as the strict camera and compositional anchor, keeping all cabinet wings clearly visible.
- Enforce strict two-point architectural perspective (all vertical cabinet edges and wall corners 100% vertical and parallel),
eye-level camera at 130–140cm.
- Deep depth of field: the whole joinery is tack-sharp from the nearest edge to the back wall.
- Use supporting views (Images 2+) strictly as spatial references to verify module divisions, internal accessories, and side
geometry; never blend their camera angles or duplicate the furniture.

### 2. Three-Tier Reality Rules

TIER 1 — LOCKED (never alter):
- Exact cabinet layout, corner intersections, module divisions, widths, door/drawer counts, handle positions, open shelves,
internal organizers (hanging rails, trouser racks, storage boxes), and overall footprint.
- Existing wall corners and any window, door, or architectural opening present in the 3D references.
- Positions of any user-placed sockets, switches, or lamp points (render them as flush, minimal white hardware).
- All customer-specified materials, colors, and finishes explicitly listed in the user prompt.

TIER 2 — STUDIO SET (complete the unfinished 3D environment):
- Remove all 3D viewport artifacts: delete protruding wall-base strips/bars across the floor, floating planes, cropped floor
polygons, open wall cross-sections, gizmos, grids, and wireframes.
- ${ceilingRule} Walls and ceiling are seamless matte warm white unless a wall finish is listed in the user prompt; the floor is
one continuous pale, matte surface (bleached light oak or warm-grey microcement, whichever contrasts more gently with the
configured carcass) running to the edges of the frame. No skirting clutter, no visible light fixtures.
- Render any window present in the references as a softly overexposed, diffused light source with no detailed exterior view.
- Upgrade flat 3D shaders into precise physical materials: true-to-swatch decor color and grain, crisp 1mm edge-banding, clean
2mm shadow gaps between doors/drawers, matte surfaces that stay matte, and satin hardware with small, controlled highlights.

TIER 3 — FORBIDDEN (never invent):
- Never invent new windows, glass doors, exterior views, or structural wall cutouts not shown in the 3D references.
- Never place furniture or props that hide, touch, or block cabinet doors, drawers, or plinths.
- Never add doors to open shelves or remove doors from closed modules.

### 3. Minimal Styling
${stylingByCategory}
- Room: The floor in front of and around the joinery stays completely empty, so the plinth-to-floor junction is fully visible.
At most one small plant in a plain ceramic pot may stand on the joinery itself, away from doors and drawers.

### 4. Studio Lighting
1. Key: A very large overhead softbox and a broad frontal scrim give soft, even light with wide, gentle shadow falloff across every front,
balanced to 5000K neutral white so wood, stone and painted decors keep their true color.
2. Fill: Gentle bounce fills the interior bays so compartments read clearly, with soft ambient occlusion only in the deepest
recesses. ${ledRule}
3. Finish: Soft, short contact shadows where the cabinet base meets the floor, low contrast, bright clean whites without
clipping, a neutral color grade, and no vignette, haze, bloom, lens flare, film grain or dramatic sunlight patches.`;
}

/** Opens the final text block; the Tier 1 manifest follows it. */
export const STUDIO_REQUEST = 'Create one 2K high-key studio catalogue photograph of the configured joinery, using Image 1 for the exact '
  + 'camera framing and cabinet structure, and Images 2 and 3 only for supporting details.';

/** Closes the final text block, after the Tier 1 manifest. */
export const STUDIO_COMPLETION = '- TIER 2 Studio Set: Seamless matte warm-white walls and ceiling where no wall finish is specified, '
  + 'one continuous pale matte floor, soft even 5000K studio light, and an empty floor around the joinery. '
  + 'Remove protruding floor-base strips and complete cropped background geometry. '
  + 'Include a brief text description of the result mentioning the applied manufacturer board SKUs and surface structures.';
