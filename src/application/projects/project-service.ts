import { createProject } from '../../domain/project/project';
import type { ProjectRepository } from '../ports/project-repository';

export function createProjectService(repository: ProjectRepository, newId: () => string) {
  return {
    list: () => repository.list(),
    open: (id: string) => repository.load(id),
    create: (name: string) => repository.save(createProject(newId(), name), null),
    save: repository.save.bind(repository),
    delete: repository.delete.bind(repository),
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
