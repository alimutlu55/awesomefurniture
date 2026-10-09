import type { ProjectRepository, StoredProject } from '../../../application/ports/project-repository';
import type { ProjectDocument } from '../../../domain/project/project';
import { assertRevision, newestFirst, nextRecord, summarize } from '../records';

/** Explicit test/development adapter. Never silently substitute for failed disk storage. */
export class MemoryProjectRepository implements ProjectRepository {
  private readonly records = new Map<string, StoredProject>();

  constructor(private readonly now = () => new Date().toISOString()) {}

  async list() { return [...this.records.values()].map(summarize).sort(newestFirst); }
  async load(id: string): Promise<StoredProject | null> {
    return structuredClone(this.records.get(id) ?? null);
  }
  async save(document: ProjectDocument, expectedRevision: number | null): Promise<StoredProject> {
    const next = nextRecord(document, this.records.get(document.id) ?? null, expectedRevision, this.now);
    this.records.set(document.id, next);
    return structuredClone(next);
  }
  async delete(id: string, expectedRevision: number): Promise<void> {
    assertRevision(this.records.get(id) ?? null, expectedRevision);
    this.records.delete(id);
  }
}
