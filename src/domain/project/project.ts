import type { Wardrobe } from '../wardrobe/wardrobe';

/** Serializable design only. Editor state and render resources live elsewhere. */
export interface ProjectDocument {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly units: 'cm';
  readonly wardrobes: readonly Wardrobe[];
}

export function projectName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 120) {
    throw new Error('Project name must contain between 1 and 120 characters.');
  }
  return name;
}

export function createProject(id: string, name: string): ProjectDocument {
  if (!id.trim()) throw new Error('Project ID is required.');
  return { schemaVersion: 1, id, name: projectName(name), units: 'cm', wardrobes: [] };
}
