import type { ProjectBase, ProjectStatus } from '@/api/types/projects';

/**
 * The user's project list, plus which project is on screen.
 *
 * Separate from ProjectDataStore because it has a different lifetime: the list
 * is per user, the details are per project. It replaces ProjectContext's
 * `projects` / `currentProject` / `isLoading` triple -- note that `isLoading`
 * here covers ONLY fetching the list, never a project's own work, so it can no
 * longer blank the whole app.
 *
 * `activeProjectId` is selection state and is deliberately minimal: step 3
 * moves it into the URL (`/projects/[projectId]/...`, decision D4) and this
 * field goes away.
 */
type Listener = () => void;

export interface ProjectsIndexState {
  projects: ProjectBase[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: ProjectsIndexState = {
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,
};

class ProjectsIndex {
  private state: ProjectsIndexState = EMPTY;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ProjectsIndexState => this.state;
  getServerSnapshot = (): ProjectsIndexState => EMPTY;

  private update(next: Partial<ProjectsIndexState>) {
    const merged = { ...this.state, ...next };
    const changed = (Object.keys(next) as Array<keyof ProjectsIndexState>).some(
      (key) => merged[key] !== this.state[key],
    );
    if (!changed) return;
    this.state = merged;
    this.listeners.forEach((l) => l());
  }

  set(projects: ProjectBase[]) {
    this.update({ projects, error: null });
    // Keep a selection if one is still valid; otherwise fall back to the first
    // project so the pre-redesign screens keep their "open something" behaviour.
    const current = this.state.activeProjectId;
    if (!current || !projects.some((p) => p.id === current)) {
      this.update({ activeProjectId: projects[0]?.id ?? null });
    }
  }

  add(project: ProjectBase) {
    if (this.state.projects.some((p) => p.id === project.id)) return;
    this.update({ projects: [...this.state.projects, project] });
  }

  updateStatus(projectId: string, status: ProjectStatus) {
    if (!this.state.projects.some((p) => p.id === projectId && p.status !== status)) return;
    this.update({ projects: this.state.projects.map((p) => (p.id === projectId ? { ...p, status } : p)) });
  }

  setActive(projectId: string | null) {
    this.update({ activeProjectId: projectId });
  }

  setLoading(loading: boolean) {
    this.update({ loading });
  }

  setError(error: string | null) {
    this.update({ error });
  }

  reset() {
    this.state = EMPTY;
    this.listeners.forEach((l) => l());
  }
}

export const projectsIndex = new ProjectsIndex();
