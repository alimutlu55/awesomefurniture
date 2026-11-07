import type { Construction } from '../../make/make-construction';

/**
 * Builder profiles: who builds the design and with what. A profile lowers the build model (every piece is built with its
 * joints and back, so Make, the hardware list and the drilling follow) and says what is bought as a service and what is
 * someone's time. The same design quoted under each profile is "build it three ways".
 *
 * TO ADD A PROFILE (a workshop's own, a supplier's): append one entry. Its construction must be one Make builds
 * (make-construction.ts); tests/architecture/engine-catalog.test.ts quotes every profile.
 */
export interface BuilderProfile {
  readonly key: string;
  readonly label: string;
  /** One line: who does what. */
  readonly summary: string;
  readonly construction: Construction;
  /** Services bought from a panel shop. Cutting and edging are always bought: they need a panel saw and an edge bander. */
  readonly services: { readonly drill: boolean; readonly groove: boolean };
  /** A workshop's time is paid for: assembly, and installation hours per piece. */
  readonly labour: { readonly assembly: boolean; readonly installHoursPerPiece: number; readonly margin: boolean };
  /** Minutes the person spends drilling one hole by hand, when nobody drills for them. */
  readonly handDrillMinutes: number;
}

export const BUILDER_PROFILES = [
  {
    key: 'diy', label: 'Build it yourself', summary: 'Boards cut and edged by a panel shop; you drill, assemble and fit.',
    construction: { joints: 'confirmat', back: 'nailed' },
    services: { drill: false, groove: false }, labour: { assembly: false, installHoursPerPiece: 0, margin: false }, handDrillMinutes: .75,
  },
  {
    key: 'panel-shop', label: 'Cut and drilled', summary: 'Boards cut, edged, drilled and grooved by CNC; you assemble and fit.',
    construction: { joints: 'cam', back: 'grooved' },
    services: { drill: true, groove: true }, labour: { assembly: false, installHoursPerPiece: 0, margin: false }, handDrillMinutes: 0,
  },
  {
    key: 'workshop', label: 'Built and fitted', summary: 'A workshop makes, assembles and fits it.',
    construction: { joints: 'dowel', back: 'grooved' },
    services: { drill: true, groove: true }, labour: { assembly: true, installHoursPerPiece: 1.5, margin: true }, handDrillMinutes: 0,
  },
] as const satisfies readonly BuilderProfile[];

export type BuilderProfileKey = typeof BUILDER_PROFILES[number]['key'];

export const builderProfile = (key: string): BuilderProfile | undefined => (BUILDER_PROFILES as readonly BuilderProfile[]).find(p => p.key === key);
