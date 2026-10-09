import type { ProjectRepository, StoredProject } from '../../../application/ports/project-repository';
import type { ProjectDocument } from '../../../domain/project/project';
import { parseStoredProject } from '../../serialization/project-codec';
import { assertRevision, newestFirst, nextRecord, summarize } from '../records';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private connection: Promise<IDBDatabase> | undefined;

  constructor(
    private readonly factory: IDBFactory,
    private readonly databaseName = 'wardrobe-projects',
    private readonly now = () => new Date().toISOString(),
  ) {}

  private open(): Promise<IDBDatabase> {
    if (!this.connection) {
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.databaseName, 1);
        let blocked = false;
        request.onupgradeneeded = () => {
          request.result.createObjectStore('projects', { keyPath: 'document.id' });
        };
        request.onblocked = () => {
          blocked = true;
          reject(new Error('Close other Wardrobe tabs to update local project storage.'));
        };
        request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) { db.close(); return; }
          db.onversionchange = () => { db.close(); this.connection = undefined; };
          resolve(db);
        };
      }).catch((error: unknown) => { this.connection = undefined; throw error; });
    }
    return this.connection;
  }

  private async transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    const db = await this.open();
    const tx = db.transaction('projects', mode);
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Local storage transaction aborted.'));
      tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed.'));
    });
    const operation = work(tx.objectStore('projects')).catch((error: unknown) => {
      try { tx.abort(); } catch { /* Transaction may already be aborted. */ }
      throw error;
    });
    const [result] = await Promise.all([operation, completed]);
    return result;
  }

  async list() {
    return this.transaction('readonly', async store => {
      const records: unknown[] = await requestResult(store.getAll());
      return records.map(parseStoredProject).map(summarize).sort(newestFirst);
    });
  }

  async load(id: string): Promise<StoredProject | null> {
    return this.transaction('readonly', async store => {
      const raw: unknown = await requestResult(store.get(id));
      return raw === undefined ? null : parseStoredProject(raw);
    });
  }

  async save(document: ProjectDocument, expectedRevision: number | null): Promise<StoredProject> {
    return this.transaction('readwrite', async store => {
      const raw: unknown = await requestResult(store.get(document.id));
      const current = raw === undefined ? null : parseStoredProject(raw);
      const next = nextRecord(document, current, expectedRevision, this.now);
      await requestResult(store.put(next));
      return next;
    });
  }

  async delete(id: string, expectedRevision: number): Promise<void> {
    await this.transaction('readwrite', async store => {
      const raw: unknown = await requestResult(store.get(id));
      assertRevision(raw === undefined ? null : parseStoredProject(raw), expectedRevision);
      await requestResult(store.delete(id));
    });
  }

  async close(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    if (connection) (await connection).close();
  }
}
