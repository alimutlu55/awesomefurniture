/** This viewer's own choices about how the editor looks and sounds, kept in their browser. They are conveniences:
 * when storage is unavailable (a private window, blocked site data) everything starts from its default. */
const KEY = 'wardrobe-forge.experience';
export interface ExperiencePreferences { look: string; time: string; sounds: boolean; welcomed: boolean }
const DEFAULTS: ExperiencePreferences = { look: 'living', time: 'midday', sounds: true, welcomed: false };

export function readPreferences(storage: () => Storage | null): ExperiencePreferences {
  try {
    const saved = JSON.parse(storage()?.getItem(KEY) ?? '{}') as Partial<ExperiencePreferences>;
    return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}
export function writePreferences(storage: () => Storage | null, next: ExperiencePreferences) {
  try { storage()?.setItem(KEY, JSON.stringify(next)); } catch { /* storage is a convenience */ }
}
