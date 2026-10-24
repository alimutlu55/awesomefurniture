/** Generic planning objects, in centimetres. Dimensions are resolved on insertion, never product specifications. */
export interface FixtureVariant {
  readonly key: string; readonly name: string;
  readonly w: number; readonly h: number; readonly d: number; readonly elevation: number;
  readonly mounting: 'floor' | 'wall' | 'surface';
  readonly concealed?: boolean;
  readonly services?: readonly string[];
}
export interface FixtureDefinition {
  readonly key: string; readonly name: string; readonly category: string;
  readonly shape: string; readonly description: string; readonly color: string;
  readonly clearance: number; readonly services: readonly string[];
  readonly minimum: { readonly w: number; readonly h: number; readonly d: number };
  readonly variants: readonly FixtureVariant[];
}
export const FIXTURE_CATALOG = [
  { key: 'toilet', name: 'Toilet', category: 'Bathroom', shape: 'toilet', color: '#f7f5ef', clearance: 60,
    minimum: { w: 25, h: 25, d: 35 },
    description: 'Floor-standing or wall-hung, with an existing installation or a new enclosure', services: ['cold', 'waste'], variants: [
      { key: 'wall-hung', name: 'Wall-hung', w: 37, h: 32, d: 54, elevation: 10, mounting: 'wall', concealed: true },
      { key: 'close-coupled', name: 'Floor-standing · visible cistern', w: 38, h: 78, d: 67, elevation: 0, mounting: 'floor' },
      { key: 'back-to-wall', name: 'Back-to-wall · concealed cistern', w: 38, h: 42, d: 54, elevation: 0, mounting: 'wall', concealed: true },
    ] },
  { key: 'basin', name: 'Basin', category: 'Bathroom', shape: 'basin', color: '#f7f5ef', clearance: 60,
    minimum: { w: 20, h: 6, d: 20 },
    description: 'Wall-hung, vessel or pedestal washbasin; add a tap separately', services: ['hot', 'cold', 'waste'], variants: [
      { key: 'wall-hung', name: 'Wall-hung', w: 60, h: 16, d: 45, elevation: 69, mounting: 'wall' },
      { key: 'vessel', name: 'Countertop vessel', w: 45, h: 14, d: 36, elevation: 80, mounting: 'surface' },
      { key: 'pedestal', name: 'Pedestal', w: 56, h: 85, d: 45, elevation: 0, mounting: 'wall' },
    ] },
  { key: 'faucet', name: 'Faucet', category: 'Bathroom', shape: 'faucet', color: '#b9bec2', clearance: 0,
    minimum: { w: 3, h: 5, d: 5 },
    description: 'Deck-mounted or wall-mounted tap, with independent spout reach', services: ['hot', 'cold'], variants: [
      { key: 'deck', name: 'Deck-mounted', w: 5, h: 22, d: 18, elevation: 85, mounting: 'surface' },
      { key: 'wall', name: 'Wall-mounted · concealed', w: 18, h: 8, d: 20, elevation: 100, mounting: 'wall' },
    ] },
  { key: 'vanity', name: 'Vanity', category: 'Bathroom', shape: 'vanity', color: '#bb9671', clearance: 65,
    minimum: { w: 30, h: 20, d: 25 },
    description: 'Reference bathroom cabinet; supports a basin without entering furniture manufacturing', services: [], variants: [
      { key: 'floating', name: 'Floating', w: 80, h: 50, d: 50, elevation: 30, mounting: 'wall' },
      { key: 'floor', name: 'Floor-standing', w: 80, h: 80, d: 50, elevation: 0, mounting: 'floor' },
    ] },
  { key: 'mirror', name: 'Mirror', category: 'Bathroom', shape: 'mirror', color: '#bacbd0', clearance: 0,
    minimum: { w: 15, h: 15, d: 1 },
    description: 'Wall mirror, sized and positioned independently of the basin', services: [], variants: [
      { key: 'rectangle', name: 'Rectangular', w: 70, h: 80, d: 3, elevation: 110, mounting: 'wall' },
      { key: 'round', name: 'Round', w: 65, h: 65, d: 3, elevation: 115, mounting: 'wall' },
    ] },
  { key: 'shower-tray', name: 'Shower area', category: 'Bathroom', shape: 'tray', color: '#edeae3', clearance: 0,
    minimum: { w: 60, h: 1, d: 60 },
    description: 'Shower tray or a flush floor area', services: ['waste'], variants: [
      { key: 'tray', name: 'Raised tray', w: 90, h: 5, d: 90, elevation: 0, mounting: 'floor' },
      { key: 'flush', name: 'Flush floor area', w: 100, h: 1, d: 100, elevation: 0, mounting: 'floor' },
    ] },
  { key: 'shower-screen', name: 'Shower screen', category: 'Bathroom', shape: 'screen', color: '#bdd6db', clearance: 0,
    minimum: { w: 20, h: 100, d: .5 },
    description: 'Fixed glass panel or hinged shower door', services: [], variants: [
      { key: 'fixed', name: 'Fixed panel', w: 90, h: 200, d: 1, elevation: 5, mounting: 'floor' },
      { key: 'hinged-left', name: 'Hinged · left', w: 80, h: 200, d: 1, elevation: 5, mounting: 'floor' },
      { key: 'hinged-right', name: 'Hinged · right', w: 80, h: 200, d: 1, elevation: 5, mounting: 'floor' },
    ] },
  { key: 'shower-set', name: 'Shower fittings', category: 'Bathroom', shape: 'shower', color: '#b9bec2', clearance: 0,
    minimum: { w: 10, h: 40, d: 15 },
    description: 'Mixer, riser, overhead head and handset', services: ['hot', 'cold'], variants: [
      { key: 'exposed', name: 'Exposed mixer and riser', w: 25, h: 110, d: 35, elevation: 105, mounting: 'wall' },
      { key: 'concealed', name: 'Concealed mixer and overhead head', w: 25, h: 110, d: 35, elevation: 105, mounting: 'wall' },
    ] },
  { key: 'bath', name: 'Bathtub', category: 'Bathroom', shape: 'bath', color: '#f7f5ef', clearance: 60,
    minimum: { w: 100, h: 30, d: 50 },
    description: 'Freestanding bath or built-in bath with a panelled surround', services: ['hot', 'cold', 'waste'], variants: [
      { key: 'freestanding', name: 'Freestanding', w: 170, h: 58, d: 75, elevation: 0, mounting: 'floor' },
      { key: 'built-in', name: 'Built-in', w: 170, h: 58, d: 75, elevation: 0, mounting: 'floor' },
    ] },
  { key: 'bidet', name: 'Bidet', category: 'Bathroom', shape: 'basin', color: '#f7f5ef', clearance: 60,
    minimum: { w: 25, h: 20, d: 35 },
    description: 'Floor-standing or wall-hung bidet', services: ['hot', 'cold', 'waste'], variants: [
      { key: 'floor', name: 'Floor-standing', w: 36, h: 40, d: 54, elevation: 0, mounting: 'wall' },
      { key: 'wall', name: 'Wall-hung', w: 36, h: 30, d: 54, elevation: 10, mounting: 'wall' },
    ] },
  { key: 'towel-rail', name: 'Towel rail', category: 'Accessories', shape: 'rail', color: '#b9bec2', clearance: 0,
    minimum: { w: 10, h: 2, d: 3 },
    description: 'Wall-mounted towel rail', services: [], variants: [
      { key: 'rail', name: 'Single rail', w: 60, h: 5, d: 8, elevation: 110, mounting: 'wall' },
    ] },
  { key: 'roll-holder', name: 'Toilet-roll holder', category: 'Accessories', shape: 'rail', color: '#b9bec2', clearance: 0,
    minimum: { w: 10, h: 2, d: 3 },
    description: 'Wall-mounted toilet-roll holder', services: [], variants: [
      { key: 'holder', name: 'Holder', w: 18, h: 5, d: 8, elevation: 65, mounting: 'wall' },
    ] },
  { key: 'washer', name: 'Washing machine', category: 'Laundry', shape: 'laundry', color: '#f3f2ee', clearance: 65,
    minimum: { w: 40, h: 60, d: 40 },
    description: 'Front-loading washing machine with service and door access', services: ['cold', 'waste', 'power'], variants: [
      { key: 'front', name: 'Front-loading', w: 60, h: 85, d: 60, elevation: 0, mounting: 'floor' },
    ] },
  { key: 'dryer', name: 'Dryer', category: 'Laundry', shape: 'laundry', color: '#f3f2ee', clearance: 65,
    minimum: { w: 40, h: 60, d: 40 },
    description: 'Freestanding tumble dryer', services: ['power'], variants: [
      { key: 'front', name: 'Front-loading', w: 60, h: 85, d: 60, elevation: 0, mounting: 'floor' },
    ] },
  { key: 'towel-radiator', name: 'Towel radiator', category: 'Heating', shape: 'radiator', color: '#e9e8e2', clearance: 35,
    minimum: { w: 20, h: 30, d: 5 },
    description: 'Ladder radiator with independent height and wall position', services: ['heating'], variants: [
      { key: 'water', name: 'Hydronic', w: 50, h: 120, d: 10, elevation: 20, mounting: 'wall' },
      { key: 'electric', name: 'Electric', w: 50, h: 120, d: 10, elevation: 20, mounting: 'wall', services: ['power'] },
    ] },
] as const satisfies readonly FixtureDefinition[];

export type FixtureKind = typeof FIXTURE_CATALOG[number]['key'];
export const fixtureDefinition = (key: string): FixtureDefinition | undefined => FIXTURE_CATALOG.find(d => d.key === key);
export const fixtureVariant = (kind: string, variant: string) => fixtureDefinition(kind)?.variants.find(v => v.key === variant);
export const fixtureServices = (kind: string, variant: string): readonly string[] => fixtureVariant(kind, variant)?.services ?? fixtureDefinition(kind)?.services ?? [];
export const FIXTURE_CATEGORIES = [...new Set([...FIXTURE_CATALOG.map(f => f.category), 'Construction'])];
export const FIXTURE_FINISHES = [
  { name: 'Porcelain', color: '#f7f5ef' }, { name: 'Warm white', color: '#e9e8e2' }, { name: 'Graphite', color: '#3d4142' },
  { name: 'Chrome', color: '#b9bec2' }, { name: 'Brass', color: '#b69752' }, { name: 'Oak', color: '#bb9671' },
] as const;
export const FIXTURE_PRESETS = [
  { key: 'toilet-boxed', name: 'Toilet + enclosure', kind: 'toilet', description: 'Wall-hung toilet with a new partial-height enclosure' },
  { key: 'vanity-set', name: 'Vanity + basin + tap', kind: 'vanity', description: 'Floating vanity, vessel basin, deck tap and mirror' },
  { key: 'shower-set', name: 'Walk-in shower', kind: 'shower-tray', description: 'Shower tray, fixed front screen and wall-mounted fittings' },
] as const;
