import { createProjectService } from '../application/projects/project-service';
import { IndexedDbProjectRepository } from '../infrastructure/persistence/indexeddb/indexeddb-project-repository';
import { mountProjectWorkspace } from '../presentation/projects/project-workspace';
import '../presentation/projects/styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application mount point is missing.');

try {
  if (!globalThis.indexedDB) throw new Error('This browser does not provide local project storage.');
  const repository = new IndexedDbProjectRepository(globalThis.indexedDB);
  const projects = createProjectService(repository, () => crypto.randomUUID());
  mountProjectWorkspace(root, projects);
} catch (error) {
  root.textContent = error instanceof Error ? error.message : 'Could not start the project workspace.';
}
