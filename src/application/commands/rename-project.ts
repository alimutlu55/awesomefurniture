import { projectName, type ProjectDocument } from '../../domain/project/project';
/** Commands return a new document; side effects belong to the application shell. */
export function renameProject(project: ProjectDocument, value: string): ProjectDocument {
    const name = projectName(value);
    return name === project.name ? project : { ...project, name };
}
