import type { FixtureKind } from './fixture-catalog';

export type FixtureAnchor =
  | { readonly kind: 'floor'; readonly x: number; readonly z: number; readonly y: number; readonly angle: number }
  | { readonly kind: 'wall'; readonly wall: string; readonly offset: number; readonly y: number; readonly gap: number }
  | { readonly kind: 'enclosure'; readonly enclosure: string; readonly offset: number; readonly y: number }
  | { readonly kind: 'fixture'; readonly fixture: string; readonly x: number; readonly z: number; readonly lift: number };

export interface StudioFixture {
  readonly id: string; readonly kind: FixtureKind; readonly variant: string;
  readonly w: number; readonly h: number; readonly d: number; readonly color: string;
  readonly anchor: FixtureAnchor;
  readonly status: 'new' | 'existing';
  readonly assembly?: string | undefined;
  /** Generic reserved carrier/cistern volume. These dimensions are not verified manufacturer data. */
  readonly installation?: { readonly w: number; readonly h: number; readonly d: number; readonly access: 'front' | 'top' } | undefined;
  readonly connections?: readonly { readonly role: string; readonly utility: string }[] | undefined;
}
export interface FixtureEnclosure {
  readonly id: string; readonly name: string;
  readonly anchor: Extract<FixtureAnchor, { kind: 'wall' | 'floor' }>;
  /** Finished outer dimensions, including the lining thickness. */
  readonly w: number; readonly h: number; readonly d: number; readonly lining: number;
  readonly color: string; readonly topColor: string; readonly sideColor: string;
  readonly finish: 'paint' | 'tile' | 'panel'; readonly form: 'boxing' | 'module';
  readonly status: 'new' | 'existing';
  readonly generatedFor?: string | undefined;
}
export interface FixturePose { readonly x: number; readonly y: number; readonly z: number; readonly angle: number }
