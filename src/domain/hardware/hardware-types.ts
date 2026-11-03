/**
 * Domain hardware registry types.
 * Every dimension in a hardware entry is in millimetres (mm) and angles in degrees.
 * Pure data only: no DOM, no Three.js, no brand-locked templates.
 */

export type HardwareCategory =
  | 'rail'
  | 'hinge'
  | 'runner'
  | 'connector'
  | 'support'
  | 'track'
  | 'leg'
  | 'bracket'
  | 'handle'
  | 'plinth'
  | 'lift'
  | 'mechanism'
  | 'lighting'
  | 'fixing';

export type MountTarget =
  | 'side'
  | 'partition'
  | 'top'
  | 'base'
  | 'back'
  | 'shelf'
  | 'door'
  | 'front'
  | 'drawer-box'
  | 'plinth'
  | 'worktop'
  | 'wall'
  | 'floor';

export type AssemblyStage =
  | 'plinth'
  | 'carcass'
  | 'partitions'
  | 'top'
  | 'back'
  | 'inside'
  | 'drawer-boxes'
  | 'drawer-runners'
  | 'cargo-frame'
  | 'cargo-baskets'
  | 'drawers'
  | 'fronts'
  | 'drawer-test'
  | 'doors'
  | 'wall';

export type HoleReference = 'system32' | 'front-edge' | 'rear-edge' | 'joint-line' | 'centre' | 'rebate';

export type HoleFace = 'inside' | 'outside' | 'front' | 'back' | 'top' | 'bottom' | 'edge';

export type HardwareHoleKind =
  | 'cup'
  | 'plate'
  | 'runner'
  | 'pin'
  | 'handle'
  | 'connector'
  | 'dowel'
  | 'bolt'
  | 'cam'
  | 'pilot'
  | 'screw';

export interface HolePatternSpec {
  readonly reference: HoleReference;
  /** Offset from the reference line in mm (e.g. 37 mm for System 32, 22.5 mm for hinge cup). */
  readonly lineMm: number;
  /** Pitch between holes in mm (e.g. 32 mm on System 32). */
  readonly pitchMm?: number;
  readonly face: HoleFace;
  readonly kind: HardwareHoleKind;
  readonly dMm: number;
  readonly depthMm: number;
  readonly through?: boolean;
  /** Station offsets along the reference line in mm. */
  readonly stationsMm?: readonly number[];
}

export interface FixingSpec {
  readonly target: MountTarget;
  readonly fromFace: HoleFace;
  readonly fastenerKind: 'screw' | 'bolt' | 'pin' | 'nail' | 'cam' | 'confirmat' | 'dowel';
  readonly size: string;
  readonly qtyPerUnit: number;
  readonly purpose?: 'runner-mount' | 'drawer-front' | 'cargo-lock';
  readonly pilotHole?: {
    readonly kind: HardwareHoleKind;
    readonly dMm: number;
    readonly depthMm: number;
  };
}

export interface MotionMemberSpec {
  readonly role: 'cabinet' | 'intermediate' | 'drawer' | 'leaf';
  /** Travel ratio relative to the primary moving element (0 = fixed, 0.5 = half-speed intermediate, 1 = full travel). */
  readonly ratio: number;
  readonly heightMm?: number;
  readonly lengthRatio?: number;
  readonly xOffsetMm?: number;
}

export type MotionSpec =
  | {
      readonly kind: 'swing';
      readonly axis: 'y' | 'x';
      readonly maxAngleDeg: number;
      readonly standoffMm?: number;
    }
  | {
      readonly kind: 'telescope';
      readonly axis: 'z';
      /** Ratio of nominal runner length that extends at full travel. */
      readonly extensionRatio: number;
      /** Ratio of runner length pulled out during open inspection / demonstration (0.7 = 70%). */
      readonly openPullRatio: number;
      readonly members: readonly MotionMemberSpec[];
    }
  | {
      readonly kind: 'slide';
      readonly axis: 'x' | 'z';
      readonly travelRatio: number;
    }
  | {
      readonly kind: 'lift';
      readonly axis: 'x';
      readonly maxAngleDeg: number;
    };

export interface HardwareExclusionRule {
  readonly material: 'glass';
  readonly forbidsHoles: boolean;
  readonly fallbackVariant?: string;
  readonly reason: string;
}

export interface HardwareRulesSpec {
  readonly clearanceMm: {
    readonly side?: number;
    readonly frontSetback?: number;
    readonly rearGap?: number;
    readonly topDrop?: number;
    readonly bottomGap?: number;
    readonly reveal?: number;
    readonly standoff?: number;
    readonly endCutShort?: number;
  };
  readonly boardThicknessMm: {
    readonly min: number;
    readonly max: number;
    readonly standard: readonly number[];
  };
  readonly minCarcassDepthMm?: number;
  readonly maxSpanMm?: Readonly<Record<number, number>> | number;
  readonly maxLeafMm?: { readonly width: number; readonly height: number };
  /** Upper threshold in mm -> quantity required (e.g. door height -> hinge count). */
  readonly quantityByHeightMm?: readonly (readonly [number, number])[];
  readonly edgeInsetMm?: number;
  readonly maxSpacingMm?: number;
  readonly systemLineMm?: number;
  readonly pitchMm?: number;
  readonly exclusions?: readonly HardwareExclusionRule[];
  readonly costEur?: number;
}

export interface AssemblyStageSpec {
  readonly stage: AssemblyStage;
  /** Prerequisite stages that must be completed before this stage can run. */
  readonly requires: readonly AssemblyStage[];
  readonly title: string;
  readonly summary: string;
  readonly drill?: string;
  readonly place?: string;
  readonly fix?: string;
}

export interface AssemblyStepSpec {
  readonly stage: AssemblyStage;
  readonly requires: readonly AssemblyStage[];
  readonly phase: 'before-place' | 'lying-before-place' | 'place' | 'hang' | 'after-place' | 'adjust' | 'test';
  readonly fittedFirst?: boolean;
  readonly adjustAxes?: readonly ('side' | 'height' | 'depth')[];
  readonly testsTravel?: boolean;
  readonly approachFrom: readonly [number, number, number];
  readonly instructions: {
    readonly title: string;
    readonly summary: string;
    readonly drill?: string;
    readonly place?: string;
    readonly fix?: string;
  };
}

export interface Model3DPrimitive {
  readonly shape: 'box' | 'cylinder' | 'ring' | 'disc' | 'sphere' | 'channel';
  readonly sizeMm: readonly [number, number, number];
  readonly offsetMm?: readonly [number, number, number];
  readonly axis?: 'x' | 'y' | 'z';
  readonly lod?: 'all' | 'make' | 'studio';
}

export interface HardwareDisplaySpec {
  readonly model3d: {
    readonly family:
      | 'runner-telescope'
      | 'hinge-cup'
      | 'mounting-plate'
      | 'handle'
      | 'rail-tube'
      | 'rail-support'
      | 'shelf-pin'
      | 'fastener'
      | 'cabinet-leg'
      | 'wall-bracket'
      | 'cargo-pullout'
      | 'corner-carousel'
      | 'lift-stay'
      | 'sliding-track'
      | 'led-strip';
    readonly primitives: readonly Model3DPrimitive[];
    readonly approachVector: readonly [number, number, number];
  };
  readonly drawingMark: {
    readonly symbol:
      | 'hinge-pivot'
      | 'runner-dashed'
      | 'rail-bar'
      | 'pin-tick'
      | 'handle-bar'
      | 'connector-cross'
      | 'leg-foot'
      | 'bracket-corner'
      | 'track-line'
      | 'lift-arc'
      | 'led-strip';
    readonly strokeDash?: readonly number[];
    readonly label?: string;
  };
  readonly listLine: {
    readonly label: string;
    readonly unit: 'pair' | 'pc' | 'set' | 'm';
    readonly defaultSpec: string;
  };
}

export interface HardwareVariantSpec {
  readonly key: string;
  readonly name: string;
  readonly sizeLabel: string;
  readonly sizesMm?: readonly number[];
  readonly fullSpan?: boolean;
  readonly angleDeg?: number;
  readonly projectionMm?: number;
  readonly fixing?: 'through' | 'back' | 'single' | 'none';
  readonly cup?: { readonly d: number; readonly depth: number; readonly fromEdge: number } | null;
  readonly use?: string;
  readonly loadKg?: number;
}

export interface HardwareEntry {
  readonly key: string;
  readonly category: HardwareCategory;
  readonly name: string;
  readonly unit: 'pair' | 'pc' | 'set' | 'm';
  readonly mountsOn: readonly MountTarget[];
  readonly sizesMm: readonly number[];
  readonly variants?: readonly HardwareVariantSpec[];
  readonly defaultVariant?: string;
  readonly rules: HardwareRulesSpec;
  readonly drilling: readonly HolePatternSpec[];
  readonly fixings: readonly FixingSpec[];
  readonly motion?: MotionSpec;
  readonly assembly: AssemblyStepSpec;
  readonly display: HardwareDisplaySpec;
  readonly source: string;
}
