import { ProjectConflictError, type StoredProject, type ProjectSummary } from '../../application/ports/project-repository';
import type { ProjectDocument } from '../../domain/project/project';
import { parseProject, parseStoredProject } from '../serialization/project-codec';

export function assertRevision(current: StoredProject | null, expected: number | null): void {
  if ((current?.revision ?? null) !== expected) throw new ProjectConflictError();
}

export function nextRecord(
  document: ProjectDocument,
  current: StoredProject | null,
  expected: number | null,
  now: () => string,
): StoredProject {
  assertRevision(current, expected);
  return parseStoredProject({
    document: parseProject(document),
    revision: (current?.revision ?? 0) + 1,
    updatedAt: now(),
  });
}

export function summarize(record: StoredProject): ProjectSummary {
  return { id: record.document.id, name: record.document.name, revision: record.revision, updatedAt: record.updatedAt };
}

export const newestFirst = (a: ProjectSummary, b: ProjectSummary): number => b.updatedAt.localeCompare(a.updatedAt);
