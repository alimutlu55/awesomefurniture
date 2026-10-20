/** Named drawing purposes. Visibility is explicit and shared by the viewer and PDF. */
export const DRAWING_PRESETS = [
  { key: 'layout', label: 'Layout', description: 'Room arrangement and main sizes. Overhead units are light outlines.' },
  { key: 'installation', label: 'Installation', description: 'Exact positioning, services and mounting levels.' },
  { key: 'clearances', label: 'Clearances', description: 'Walkways, working aisles and opening envelopes.' },
  { key: 'details', label: 'Cabinet details', description: 'Individual construction views, sections and schedules.' },
] as const;
export type DrawingPreset = typeof DRAWING_PRESETS[number]['key'];
export interface DrawingOptions { readonly preset?: DrawingPreset; readonly upperPlan?: boolean; readonly clearanceProfile?: ClearanceProfile }
export const CLEARANCE_PROFILES = [
  { key: 'nkba-single', label: 'NKBA · one cook', walkway: 914, workAisle: 1067, source: 'NKBA planning guidelines 6–7 (recommendation)' },
  { key: 'nkba-multiple', label: 'NKBA · multiple cooks', walkway: 914, workAisle: 1219, source: 'NKBA planning guidelines 6–7 (recommendation)' },
  { key: 'project', label: 'Project · 900 mm', walkway: 900, workAisle: 900, source: 'Project review reference (not a code requirement)' },
] as const;
export type ClearanceProfile = typeof CLEARANCE_PROFILES[number]['key'];
export const clearanceRule = (key: ClearanceProfile = 'project') => CLEARANCE_PROFILES.find(p => p.key === key)!;
