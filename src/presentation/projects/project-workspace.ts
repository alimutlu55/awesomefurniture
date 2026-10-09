import { renameProject } from '../../application/commands/rename-project';
import type { StoredProject } from '../../application/ports/project-repository';
import type { ProjectService } from '../../application/projects/project-service';

export function mountProjectWorkspace(root: HTMLElement, projects: ProjectService): void {
  root.innerHTML = `
    <header>
      <p class="eyebrow">WARDROBE / PROJECTS</p>
      <h1>A place for your next idea.</h1>
      <p>Create a project, design your wardrobe, and save it locally.</p>
      <a class="editor-link" href="./editor.html">Open wardrobe editor ↗</a>
    </header>
    <p class="notice">Projects stay in this browser. Use Save project in the editor menu to save your design.</p>
    <section aria-labelledby="projects-heading">
      <h2 id="projects-heading">Your projects</h2>
      <form id="create-project">
        <label for="project-name">New project name</label>
        <div class="row">
          <input id="project-name" name="name" required maxlength="120" placeholder="Bedroom wardrobe" />
          <button type="submit">Create project</button>
        </div>
      </form>
      <p id="status" role="status" aria-live="polite"></p>
      <ul id="project-list" aria-label="Saved projects"></ul>
    </section>
    <section id="project-details" aria-labelledby="details-heading" hidden>
      <h2 id="details-heading">Project details</h2>
      <form id="rename-project">
        <label for="saved-name">Project name</label>
        <div class="row">
          <input id="saved-name" required maxlength="120" />
          <button type="submit">Save name</button>
        </div>
      </form>
      <p id="project-meta"></p>
      <a id="edit-project" class="editor-link">Edit wardrobe ↗</a>
    </section>
  `;

  function element<T extends HTMLElement>(selector: string): T {
    const match = root.querySelector<T>(selector);
    if (!match) throw new Error(`Workspace element missing: ${selector}`);
    return match;
  }

  const status = element('#status');
  const list = element('#project-list');
  const name = element<HTMLInputElement>('#project-name');
  const savedName = element<HTMLInputElement>('#saved-name');
  let current: StoredProject | null = null;
  let busy = false;

  function showProject(project: StoredProject): void {
    current = project;
    element<HTMLAnchorElement>('#edit-project').href = `./editor.html?project=${encodeURIComponent(project.document.id)}`;
    savedName.value = project.document.name;
    element('#project-details').hidden = false;
    element('#project-meta').textContent =
      `${project.document.wardrobes.length} wardrobes · Saved locally ${new Date(project.updatedAt).toLocaleString()}`;
  }

  async function refresh(): Promise<void> {
    const summaries = await projects.list();
    list.replaceChildren();
    if (!summaries.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No projects yet. Create one to get started.';
      list.append(empty);
    }
    for (const summary of summaries) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = summary.name;
      button.onclick = () => { void perform(async () => {
        const project = await projects.open(summary.id);
        if (!project) throw new Error('This project no longer exists. Refresh the page.');
        showProject(project);
        status.textContent = 'Project opened.';
      }); };
      li.append(button);
      list.append(li);
    }
  }

  async function perform(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    status.textContent = 'Working…';
    try { await work(); }
    catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The operation failed. Please try again.';
    } finally {
      busy = false;
      root.removeAttribute('aria-busy');
      root.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }

  element<HTMLFormElement>('#create-project').onsubmit = event => {
    event.preventDefault();
    void perform(async () => {
      showProject(await projects.create(name.value));
      name.value = '';
      await refresh();
      status.textContent = 'Project created and saved locally.';
    });
  };
  element<HTMLFormElement>('#rename-project').onsubmit = event => {
    event.preventDefault();
    void perform(async () => {
      if (!current) return;
      const document = renameProject(current.document, savedName.value);
      showProject(await projects.save(document, current.revision));
      await refresh();
      status.textContent = 'Project saved locally.';
    });
  };
  void perform(async () => { await refresh(); status.textContent = ''; });
}
