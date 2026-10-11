import type { InputField } from '@/types';
import type { FullProjectDetails } from '@/api/types/projects';
import { specsStreamToInputFields } from '@/lib/parameter-adapter';
import { mergeLocalEdits } from '@/lib/review/edits';

/**
 * Per-project data, keyed by projectId.
 *
 * THIS IS THE FIX FOR THE D11 BUG. Before, `fields: InputField[]` was a single
 * array owned by the page, cleared and refilled on every project switch. A
 * stream started for project A kept a closure over the page's setters, so when
 * the user switched to project B the running job wrote A's candidates into B's
 * rows -- `handlePopulateExtractedData` matches by parameter_key, so any two
 * projects sharing a template silently cross-contaminated, and `applyFlagChain`
 * then rewrote B's flag ids.
 *
 * Keying the DATA (not just the loading flags) by projectId makes that
 * impossible: a job applies its results to `state.get(job.projectId)`, which is
 * unrelated to whatever is on screen.
 */

export interface ProjectState {
  projectId: string;
  details: FullProjectDetails | null;
  fields: InputField[];
  /** Partial specs accumulated during a run, before `complete` lands. */
  liveSpecs: Record<string, unknown> | null;
  lastFetchedAt: number | null;
  loading: { details: boolean; save: boolean };
  error: string | null;
  /**
   * Parameter keys with unsaved local edits (value, unit, chosen candidate).
   * Save sends these rows only, and a refresh from the backend keeps their
   * edits (lib/review/edits.ts `mergeLocalEdits`).
   */
  dirty: readonly string[];
  /** A backend call in flight for one row: that row, and only that row, shows it (CLAUDE.md 8.1). */
  rowOps: Readonly<Record<string, RowOp>>;
}

/** What a row is waiting for. Corrections are jobs, read from the job store instead. */
export type RowOp = 'flag' | 'unflag' | 'select' | 'accept';

export const emptyProjectState = (projectId: string): ProjectState => ({
  projectId,
  details: null,
  fields: [],
  liveSpecs: null,
  lastFetchedAt: null,
  loading: { details: false, save: false },
  error: null,
  dirty: [],
  rowOps: {},
});

/**
 * Where the user was in one document (AM12): restored when they come back to
 * it, even after its viewer was unmounted. PDF positions are a page plus a
 * fraction of that page, so they survive a zoom or a resized pane.
 */
export interface DocumentViewState {
  scale?: number;
  page?: number;
  /** 0-1 offset of the viewport's top within `page`. */
  pageOffset?: number;
  /** Excel: the sheet that was open. */
  sheet?: string;
  /** Excel: scroll position and selected cell per sheet name, so each sheet keeps its place. */
  sheets?: Record<string, ExcelSheetView>;
  /** The last highlight nonce the viewer scrolled to, so a remount does not jump again. */
  handledNonce?: number;
}

export interface ExcelSheetView {
  top: number;
  left: number;
  /** 0-based selected cell. */
  r: number;
  c: number;
}

type Listener = () => void;

export class ProjectDataStore {
  private states = new Map<string, ProjectState>();
  /**
   * Cached empty states, one per projectId.
   *
   * `get()` is read by useSyncExternalStore, which compares snapshots by
   * reference and throws "getSnapshot should be cached to avoid an infinite
   * loop" if a fresh object comes back each call. Before this cache, asking
   * for a project with no state yet — the normal case on first render —
   * minted a new object every time and spun the render loop.
   */
  private blanks = new Map<string, ProjectState>();
  private listeners = new Set<Listener>();
  /** Bumped on every change so useSyncExternalStore sees a new snapshot. */
  private version = 0;
  /**
   * Per-document view state, keyed by projectId then documentId.
   *
   * Deliberately NOT reactive: it is written on every scroll frame and read
   * only when a viewer mounts, so emitting would re-render every subscriber of
   * this store for nothing. Kept out of ProjectState for the same reason.
   */
  private views = new Map<string, Map<string, DocumentViewState>>();
  /** The document last open in each project's viewer. Not reactive either. */
  private activeDocs = new Map<string, string>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private emit() {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  get(projectId: string): ProjectState {
    const existing = this.states.get(projectId);
    if (existing) return existing;

    let blank = this.blanks.get(projectId);
    if (!blank) {
      blank = emptyProjectState(projectId);
      this.blanks.set(projectId, blank);
    }
    return blank;
  }

  /** Read without creating state, for callers that only want to know. */
  peek(projectId: string): ProjectState | undefined {
    return this.states.get(projectId);
  }

  private update(projectId: string, mutate: (prev: ProjectState) => ProjectState) {
    const prev = this.get(projectId);
    const next = mutate(prev);
    if (next === prev) return;
    this.states.set(projectId, next);
    this.emit();
  }

  setLoading(projectId: string, key: keyof ProjectState['loading'], value: boolean) {
    this.update(projectId, (prev) => ({
      ...prev,
      loading: { ...prev.loading, [key]: value },
    }));
  }

  setError(projectId: string, error: string | null) {
    this.update(projectId, (prev) => ({ ...prev, error }));
  }

  /**
   * Replace the project's data with a fresh load. Unsaved edits survive: a
   * job finishing on one row, or a flag raised on another, refreshes the
   * whole project, and used to revert every unsaved edit with it.
   */
  setDetails(projectId: string, details: FullProjectDetails, fields: InputField[]) {
    this.update(projectId, (prev) => {
      const keys = new Set(fields.map((f) => f.id));
      const dirty = prev.dirty.filter((k) => keys.has(k));
      return {
        ...prev,
        details,
        fields: mergeLocalEdits(fields, prev.fields, new Set(dirty)),
        dirty: dirty.length === prev.dirty.length ? prev.dirty : dirty,
        lastFetchedAt: Date.now(),
        error: null,
        loading: { ...prev.loading, details: false },
      };
    });
  }

  setFields(projectId: string, fields: InputField[]) {
    this.update(projectId, (prev) => ({ ...prev, fields }));
  }

  /**
   * Change one parameter. `dirty: true` records an unsaved edit.
   * Works on the CURRENT state, so concurrent updates to other rows (a run's
   * partial results, another row's flag) are never overwritten by a stale copy.
   */
  updateField(projectId: string, key: string, fn: (field: InputField) => InputField, opts: { dirty?: boolean } = {}) {
    this.update(projectId, (prev) => {
      const idx = prev.fields.findIndex((f) => f.id === key);
      if (idx === -1) return prev;
      const nextField = fn(prev.fields[idx]);
      if (nextField === prev.fields[idx]) return prev;
      const fields = [...prev.fields];
      fields[idx] = nextField;
      if (!opts.dirty) return { ...prev, fields };
      return {
        ...prev,
        fields,
        dirty: prev.dirty.includes(key) ? prev.dirty : [...prev.dirty, key],
      };
    });
  }

  /**
   * After a save: the rows in `saved` are clean again, unless they changed
   * while the save was in flight (then the field object differs from the one
   * that was sent, and the newer edit stays dirty).
   */
  markSaved(projectId: string, saved: readonly InputField[]) {
    this.update(projectId, (prev) => {
      const sent = new Map(saved.map((f) => [f.id, f]));
      const dirty = prev.dirty.filter((k) => {
        const field = prev.fields.find((f) => f.id === k);
        return !(sent.has(k) && sent.get(k) === field);
      });
      return dirty.length === prev.dirty.length ? prev : { ...prev, dirty };
    });
  }

  /** Forget a row's unsaved edit, e.g. when a re-extraction will replace its value. */
  dropDirty(projectId: string, key: string) {
    this.update(projectId, (prev) => (prev.dirty.includes(key) ? { ...prev, dirty: prev.dirty.filter((k) => k !== key) } : prev));
  }

  setRowOp(projectId: string, key: string, op: RowOp | null) {
    this.update(projectId, (prev) => {
      if ((prev.rowOps[key] ?? null) === op) return prev;
      const rowOps = { ...prev.rowOps };
      if (op) rowOps[key] = op;
      else delete rowOps[key];
      return { ...prev, rowOps };
    });
  }

  /**
   * Merge a `partial` / `complete` spec map into one project's fields.
   *
   * Carries over the two hard-won rules from the old ParameterManager:
   *  - candidates are sorted by confidence and the highest is selected;
   *  - the previous selection is preserved by `candidateId`, never by
   *    `spec.id`, because spec ids are re-minted per response. A flagged field
   *    is excluded from that preservation, since a correction run is allowed
   *    to re-pick for exactly the row the engineer disputed.
   */
  applySpecs(projectId: string, specs: Record<string, unknown>) {
    const incoming = specsStreamToInputFields(specs);
    this.update(projectId, (prev) => {
      if (prev.fields.length === 0) return { ...prev, liveSpecs: specs };

      const next = [...prev.fields];
      for (const field of incoming) {
        const idx = next.findIndex((f) => f.id === field.id);
        if (idx === -1 || !field.specifications?.length) continue;
        // A row with an unsaved edit keeps it; the refresh at `complete`
        // brings the new candidates in beside it (setDetails' merge).
        if (prev.dirty.includes(field.id)) continue;

        const before = next[idx];
        const sorted = [...field.specifications].sort(
          (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
        );

        const previouslySelected = before.isFlagged
          ? undefined
          : before.specifications.find((s) => s.id === before.selectedSpecId);
        const preserved = previouslySelected?.candidateId
          ? sorted.find((s) => s.candidateId === previouslySelected.candidateId)
          : undefined;

        next[idx] = {
          ...before,
          specifications: sorted,
          selectedSpecId: preserved?.id ?? sorted[0].id,
        };
      }

      return { ...prev, fields: next, liveSpecs: specs };
    });
  }

  /**
   * Advance flag ids onto the successors the backend opened.
   *
   * MUST run after applySpecs for the same response. The old code carried a
   * comment explaining why: applySpecs spreads the previous field, so running
   * the chain first would have the fresh successor ids immediately overwritten
   * by the stale ones carried forward.
   */
  applyFlagChain(projectId: string, chain: Record<string, string>) {
    if (!chain || Object.keys(chain).length === 0) return;
    this.update(projectId, (prev) => ({
      ...prev,
      fields: prev.fields.map((f) => {
        if (!f.activeFlagId) return f;
        const successor = chain[f.activeFlagId];
        return successor ? { ...f, activeFlagId: successor } : f;
      }),
    }));
  }

  clearLiveSpecs(projectId: string) {
    this.update(projectId, (prev) => ({ ...prev, liveSpecs: null }));
  }

  getDocumentView(projectId: string, documentId: string): DocumentViewState | undefined {
    return this.views.get(projectId)?.get(documentId);
  }

  setDocumentView(projectId: string, documentId: string, patch: DocumentViewState) {
    let perProject = this.views.get(projectId);
    if (!perProject) {
      perProject = new Map();
      this.views.set(projectId, perProject);
    }
    perProject.set(documentId, { ...perProject.get(documentId), ...patch });
  }

  getActiveDocument(projectId: string): string | undefined {
    return this.activeDocs.get(projectId);
  }

  setActiveDocument(projectId: string, documentId: string) {
    this.activeDocs.set(projectId, documentId);
  }

  /** Drops cached state, e.g. on sign-out, so another user cannot see it. */
  reset() {
    this.states.clear();
    this.blanks.clear();
    this.views.clear();
    this.activeDocs.clear();
    this.emit();
  }
}

export const projectDataStore = new ProjectDataStore();
