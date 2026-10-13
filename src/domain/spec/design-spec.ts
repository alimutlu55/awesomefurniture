/**
 * A design spec: a short description of the result (the room, what comes down from its ceiling, the
 * wardrobes and what they hold) that an agent or a person writes instead of building it step by step.
 * The interpreter (application/spec/build-from-spec.ts) builds it with the editor's own commands, so the
 * result obeys every rule the editor does. It is plain, versioned JSON so it can be stored and sent as is;
 * infrastructure/serialization/design-spec-codec.ts checks it and publishes its JSON Schema.
 *
 * Centimetres. Walls are numbered from 1. A room built from a width and depth (or a built-in room) has
 * wall 1 at the back (the wardrobe wall), then 2 on the right, 3 at the front, 4 on the left. "From"
 * distances along a wall are measured inside the room from the wall's left end, as you face the wall.
 * Allowed names (room templates, ceiling shapes, wardrobe shapes, possessions) are the registries'
 * keys; the codec reads them from the registries, never from a copy.
 */

export const DESIGN_SPEC_VERSION = 1;

export interface SpecOpening {
  readonly wall: number;
  readonly kind: 'door' | 'window' | 'archway';
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** A window's sill height above the floor. */
  readonly sill?: number | undefined;
  /** From the wall's left end inside to the opening's left edge; centred when left out. */
  readonly from?: number | undefined;
}

export interface SpecRoom {
  /** A built-in room by name (STUDIO_TEMPLATES), or a rectangle `width` × `depth` inside. */
  readonly template?: string | undefined;
  readonly width?: number | undefined;
  readonly depth?: number | undefined;
  /** Wall height (the flat ceiling), and wall thickness. */
  readonly height?: number | undefined;
  readonly thickness?: number | undefined;
  readonly openings?: readonly SpecOpening[] | undefined;
}

export interface SpecCeiling {
  readonly wall: number;
  /** A ceiling shape by name (CEILING_SHAPES): its starting profile on this wall. */
  readonly shape: string;
  /** Its own profile instead: [from the wall's left end inside, height] pairs, left to right. */
  readonly points?: readonly (readonly [number, number])[] | undefined;
  /** How far it reaches into the room from the wall. */
  readonly depth?: number | undefined;
}

export interface SpecWardrobe {
  /** The wall it stands against; without a room (or a wall) it stands on the open floor beside the others. */
  readonly against?: number | undefined;
  /** Fill the wall's free stretch, as wide as it allows. The default when no width is given. */
  readonly fill?: boolean | undefined;
  /** From the wall's left end inside to the wardrobe's left side. */
  readonly from?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly depth?: number | undefined;
  /** A wardrobe shape by name (SHAPE_TEMPLATES). Under a ceiling that comes down it takes that ceiling's shape. */
  readonly shape?: string | undefined;
  /** What it should hold, by possession (POSSESSIONS): Auto design plans for exactly these. */
  readonly for?: Readonly<Record<string, number>> | undefined;
  /** Plan its fittings with Auto design; on by default when `for` is given. */
  readonly autoDesign?: boolean | undefined;
}

export interface DesignSpec {
  readonly specVersion: typeof DESIGN_SPEC_VERSION;
  readonly name?: string | undefined;
  readonly room?: SpecRoom | undefined;
  readonly ceilings?: readonly SpecCeiling[] | undefined;
  readonly wardrobes?: readonly SpecWardrobe[] | undefined;
}

/** Why part of a spec could not be built: where in the spec (`wardrobes[0].from`) and what to do. */
export interface SpecProblem { readonly path: string; readonly message: string }
