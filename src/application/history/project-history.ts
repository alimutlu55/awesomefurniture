import type { ProjectDocument } from '../../domain/project/project';

/** Commit once per completed gesture. Never put repository revisions in history. */
export class ProjectHistory {
  private past: ProjectDocument[] = [];
  private future: ProjectDocument[] = [];
  private present: ProjectDocument;

  constructor(initial: ProjectDocument, private readonly limit = 60) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be positive.');
    this.present = structuredClone(initial);
  }

  get current(): ProjectDocument { return structuredClone(this.present); }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  commit(next: ProjectDocument): void {
    if (next.id !== this.present.id) throw new Error('History belongs to one project.');
    if (JSON.stringify(next) === JSON.stringify(this.present)) return;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = structuredClone(next);
    this.future = [];
  }

  undo(): ProjectDocument {
    const previous = this.past.pop();
    if (previous) { this.future.push(this.present); this.present = previous; }
    return this.current;
  }

  redo(): ProjectDocument {
    const next = this.future.pop();
    if (next) { this.past.push(this.present); this.present = next; }
    return this.current;
  }
}
