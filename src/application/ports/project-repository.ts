import type { ProjectDocument } from '../../domain/project/project';

export interface StoredProject {
  readonly document: ProjectDocument;
  /** Storage revision, distinct from the document's schema version. */
  readonly revision: number;
  readonly updatedAt: string;
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface ProjectRepository {
  list(): Promise<readonly ProjectSummary[]>;
  load(id: string): Promise<StoredProject | null>;
  /** null means create-only; an existing document requires its current revision. */
  save(document: ProjectDocument, expectedRevision: number | null): Promise<StoredProject>;
  delete(id: string, expectedRevision: number): Promise<void>;
}

export class ProjectConflictError extends Error {
  constructor() {
    super('This project changed elsewhere. Reopen it before saving again.');
    this.name = 'ProjectConflictError';
  }
}
