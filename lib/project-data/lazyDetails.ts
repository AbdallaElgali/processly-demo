import { projectDataStore } from './store';
import { loadProjectDetails } from './actions';

/**
 * A soft prefetch queue for the Projects list cards (plan-A §4.3): each card
 * wants `GET /projects/{id}` for its document/parameter counts, but firing
 * all of them at once on a long list would compete with the browser's ~6
 * connections per origin against normal navigation. This is a convenience
 * cap on plain reads, separate from `lib/jobs`' JOB_CAP, which governs actual
 * background work (uploads/extractions/corrections) -- opening and browsing
 * projects is never capped (CLAUDE.md 8.1).
 */
const MAX_CONCURRENT = 6;
let active = 0;
const queue: string[] = [];
const attempted = new Set<string>();

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const projectId = queue.shift() as string;
    active += 1;
    void loadProjectDetails(projectId, { background: true }).finally(() => {
      active -= 1;
      pump();
    });
  }
}

/**
 * Queues a background fetch of one project's details, once per project for
 * this session. Safe to call on every card render/mount: it is a no-op once
 * the project is already cached (or already queued/attempted), so switching
 * filters or re-searching never re-triggers it.
 */
export function requestProjectCounts(projectId: string): void {
  if (attempted.has(projectId)) return;
  if (projectDataStore.peek(projectId)?.details) return;
  attempted.add(projectId);
  queue.push(projectId);
  pump();
}
