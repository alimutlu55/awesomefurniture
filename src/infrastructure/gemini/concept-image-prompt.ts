import type { DesignReferenceImage, RenderPromptConfig } from '../../application/projects/design-image.ts';
import { GEMINI_DESIGN_IMAGE_REFERENCE_LABELS } from './design-image-prompt.ts';

/** The supporting views keep the realistic wording: they only verify geometry, whatever the look. */
export const CONCEPT_REFERENCE_LABELS: Record<DesignReferenceImage['view'], string> = {
  ...GEMINI_DESIGN_IMAGE_REFERENCE_LABELS,
  front: 'Use Image 1 as the strict camera and TIER 1 structural reference for the configured joinery. '
    + 'Keep the exact cabinet geometry, module divisions, proportions, and camera perspective unchanged, '
    + 'while redrawing it as a TIER 2 concept illustration: remove any protruding floor-base strips and let the truncated walls, '
    + 'ceiling, and floor fade softly into the white paper within the 4:3 frame.',
};

/**
 * An architect's presentation drawing: ruled ink linework over light watercolor washes, so the customer sees the design
 * idea and its finishes without reading it as a promise of a photograph. Staging levels belong to the realistic photo.
 */
export function buildConceptSystemInstruction(config: RenderPromptConfig): string {
  const stylingByCategory = config.category === 'wardrobe'
    ? '- Inside the Joinery: Suggest the configured garments on hangers, folded stacks and storage boxes in their exact '
      + 'compartments with a few economical fine lines and pale neutral washes. No fabric texture, patterns or logos.'
    : '- On/In the Joinery: Suggest at most two simple objects (a vase with a branch, stacked bowls) in fine line with a pale wash. '
      + 'Keep worktops mostly clear.';
  const ceilingRule = config.hasCeilingBulkhead
    ? 'Draw the flush bulkhead/fascia between tall cabinets and the ceiling as part of the joinery, at full line weight.'
    : 'Keep the open top clearance above the freestanding/alcove cabinetry visible.';
  const ledRule = config.hasIntegratedLed
    ? 'Show the concealed LED strips under wall cabinets/shelves, above hanging rails, and inside open compartments as a soft, '
      + 'warm pale-yellow wash glowing from the strip line, with no drawn fixtures.'
    : 'Do not draw built-in LED strips unless visible in the 3D reference.';

  return `You are an architectural illustrator who draws presentation concept renders for bespoke joinery designers,
and a Bespoke Joinery Specialist.

Transform the provided 3D configurator reference image(s) into a single architectural concept illustration of the
customer's configured joinery: precise ink linework with soft, translucent watercolor washes on bright white cold-press
paper. It is a hand-finished drawing, not a photograph or a CGI render, and it is 100% faithful to the configured joinery.

### 1. Camera & Perspective
- Use Image 1 as the strict camera and compositional anchor, keeping all cabinet wings clearly visible.
- Draw in strict two-point architectural perspective: every vertical cabinet edge and wall corner is a ruled, perfectly
vertical line, with an eye-level horizon at 130–140cm.
- Use supporting views (Images 2+) strictly as spatial references to verify module divisions, internal accessories, and side
geometry; never blend their camera angles or duplicate the furniture.

### 2. Three-Tier Drawing Rules

TIER 1 — LOCKED (never alter):
- Exact cabinet layout, corner intersections, module divisions, widths, door/drawer counts, handle positions, open shelves,
internal organizers (hanging rails, trouser racks, storage boxes), and overall footprint.
- Existing wall corners and any window, door, or architectural opening present in the 3D references.
- Positions of any user-placed sockets, switches, or lamp points (draw them as small, simple outlines).
- All customer-specified materials, colors, and finishes explicitly listed in the user prompt, shown as their washes.

TIER 2 — CONCEPT ILLUSTRATION (redraw the unfinished 3D environment):
- Remove all 3D viewport artifacts: delete protruding wall-base strips/bars across the floor, floating planes, cropped floor
polygons, open wall cross-sections, gizmos, grids, and wireframes.
- Linework: confident, ruled technical-pen lines with a clear hierarchy — the heaviest weight for the joinery silhouette and
the floor contact, a medium weight for door, drawer and module divisions, and the finest weight for shelves, contents and the room.
Corners meet cleanly; lines may overshoot very slightly at corners, as in a hand-finished drawing.
- Color: Each configured finish is a light, slightly desaturated watercolor wash that keeps its true hue, so oak still reads as
oak and white lacquer as white paper; suggest wood grain with a few sparse, directional strokes following the configured grain
direction. Board swatch images guide these hues and grain directions only.
- Room: Draw the walls, floor and ceiling edges in fine linework with very pale warm-grey washes, fading softly into the white
paper toward the frame edges. ${ceilingRule}
- Draw any window or door present in the references as clean outlines with a pale blue-grey wash and no exterior detail.

TIER 3 — FORBIDDEN (never invent):
- Never invent new windows, glass doors, exterior views, or structural wall cutouts not shown in the 3D references.
- Never place furniture or props that hide, touch, or block cabinet doors, drawers, or plinths.
- Never add doors to open shelves or remove doors from closed modules.
- No text, labels, dimensions, annotations, title block, signature, watermark, pencil construction lines or sketchy scribbles:
the paper carries only the drawing.

### 3. Restrained Entourage
${stylingByCategory}
- Room: At most one loosely drawn plant or stool near the outer frame edge, kept well clear of the cabinet base so the
plinth-to-floor junction stays fully visible.

### 4. Light & Shading
1. One consistent light from the upper left, expressed only through washes: a slightly deeper wash on side panels and inside
recessed bays, and a soft wash shadow where the cabinet base meets the floor.
2. ${ledRule}
3. Keep generous white paper as the highlight; no photographic reflections, gradients, glow effects, lens effects or 3D shader sheen.`;
}

/** Opens the final text block; the Tier 1 manifest follows it. */
export const CONCEPT_REQUEST = 'Create one 2K architectural concept illustration (ruled ink linework with soft watercolor washes on white paper) '
  + 'of the configured joinery, using Image 1 for the exact camera framing and cabinet structure, and Images 2 and 3 only for supporting details.';

/** Closes the final text block, after the Tier 1 manifest. */
export const CONCEPT_COMPLETION = '- TIER 2 Drawing Completion: Fine-line walls, floor and ceiling edges with very pale washes, '
  + 'fading into white paper toward the frame edges, and the configured finishes as light washes in their true hues. '
  + 'Remove protruding floor-base strips and complete cropped background geometry as linework. '
  + 'Include a brief text description of the illustration mentioning the manufacturer board SKUs it depicts.';
