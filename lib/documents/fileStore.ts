import type { ProjectDocument } from '@/api/types/projects';
import { fetchDocumentFile, type DocumentFileResult } from '@/api/documents';
import { MAX_CACHED_PROJECTS, PREFETCH_BUDGET_BYTES, PREFETCH_CONCURRENCY, PREFETCH_MIN_DOCS } from './config';
import { mayPrefetch, touchRecent } from './prefetch';

/**
 * The project's document files, fetched one document at a time (D7, AM12).
 *
 * Replaces DocumentManager.hydrateFiles, which fetched every document with one
 * Promise.all: a single 404 left the project with no documents at all. Here
 * each document has its own state, a missing file is "unavailable" (not an
 * error, values preserved), and the rest load regardless.
 *
 * Background prefetch is bounded twice: at most PREFETCH_CONCURRENCY fetches
 * at once, and a per-project byte budget past which the remaining documents
 * wait until they are opened. Opening a document always fetches it at once,
 * outside the prefetch queue.
 */

export type DocFileStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface DocFileState {
  status: DocFileStatus;
  /** Object URL of the fetched file, when ready. */
  url: string | null;
  mime: string | null;
  bytes: number;
  error: string | null;
}

export const IDLE: DocFileState = Object.freeze({ status: 'idle', url: null, mime: null, bytes: 0, error: null }) as DocFileState;

const PDF_MIME = 'application/pdf';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The viewer routes by MIME type; the backend's `type` is the most reliable hint. */
export function documentMime(doc: Pick<ProjectDocument, 'name' | 'type'>, blobType?: string): string {
  const t = (doc.type ?? '').toLowerCase();
  const name = doc.name.toLowerCase();
  if (t === 'pdf' || t.includes('pdf') || name.endsWith('.pdf')) return PDF_MIME;
  if (['excel', 'xlsx', 'xlsm', 'xls'].includes(t) || t.includes('sheet') || /\.xls[xm]?$/.test(name)) return XLSX_MIME;
  return blobType || 'application/octet-stream';
}

export function isSpreadsheetDocument(doc: Pick<ProjectDocument, 'name' | 'type'>): boolean {
  return documentMime(doc) === XLSX_MIME;
}

export function isPdfDocument(doc: Pick<ProjectDocument, 'name' | 'type'>): boolean {
  return documentMime(doc) === PDF_MIME;
}

interface Deps {
  fetchFile: (docId: string, signal: AbortSignal) => Promise<DocumentFileResult>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  concurrency: number;
  budget: number;
  minDocs: number;
  maxProjects: number;
}

interface QueueEntry {
  projectId: string;
  doc: ProjectDocument;
  index: number;
}

type Listener = () => void;

export class DocumentFileStore {
  private states = new Map<string, DocFileState>();
  private owner = new Map<string, string>(); // docId -> projectId
  private bytes = new Map<string, number>(); // projectId -> bytes prefetched or opened
  private aborts = new Map<string, AbortController>();
  private queue: QueueEntry[] = [];
  private running = 0;
  private recentProjects: string[] = [];
  private listeners = new Set<Listener>();
  private snapshot: ReadonlyMap<string, DocFileState> = new Map();
  private deps: Deps;

  constructor(deps: Partial<Deps> = {}) {
    this.deps = {
      fetchFile: fetchDocumentFile,
      createUrl: (b) => URL.createObjectURL(b),
      revokeUrl: (u) => URL.revokeObjectURL(u),
      concurrency: PREFETCH_CONCURRENCY,
      budget: PREFETCH_BUDGET_BYTES,
      minDocs: PREFETCH_MIN_DOCS,
      maxProjects: MAX_CACHED_PROJECTS,
      ...deps,
    };
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** One immutable map per change, so useSyncExternalStore sees a stable reference. */
  getSnapshot = (): ReadonlyMap<string, DocFileState> => this.snapshot;

  get(docId: string): DocFileState {
    return this.states.get(docId) ?? IDLE;
  }

  private set(docId: string, state: DocFileState) {
    this.states.set(docId, state);
    this.snapshot = new Map(this.states);
    this.listeners.forEach((l) => l());
  }

  /**
   * Marks the project as the one on screen. Files of projects beyond the last
   * MAX_CACHED_PROJECTS are released (object URLs revoked, fetches aborted).
   */
  focusProject(projectId: string) {
    this.recentProjects = touchRecent(this.recentProjects, projectId, Number.MAX_SAFE_INTEGER);
    const evicted = this.recentProjects.slice(this.deps.maxProjects);
    this.recentProjects = this.recentProjects.slice(0, this.deps.maxProjects);
    evicted.forEach((p) => this.releaseProject(p));
  }

  /** Fetches one document now (the user opened it), whatever the budget. */
  ensure(projectId: string, doc: ProjectDocument) {
    const s = this.get(doc.id);
    if (s.status !== 'idle') return;
    void this.load(projectId, doc);
  }

  /** Re-fetches after an error or an unavailable answer. */
  retry(projectId: string, doc: ProjectDocument) {
    const s = this.get(doc.id);
    if (s.status === 'loading' || s.status === 'ready') return;
    void this.load(projectId, doc);
  }

  /**
   * Fetches a document again even though it loaded, e.g. when the viewer
   * could not read the bytes it got. The old object URL is revoked and its
   * bytes no longer count against the prefetch budget.
   */
  reload(projectId: string, doc: ProjectDocument) {
    const s = this.get(doc.id);
    if (s.status === 'loading') return;
    if (s.url) this.deps.revokeUrl(s.url);
    if (s.bytes) this.bytes.set(projectId, Math.max(0, (this.bytes.get(projectId) ?? 0) - s.bytes));
    void this.load(projectId, doc);
  }

  /** Queues the project's documents for background fetching, in tab order. */
  prefetch(projectId: string, docs: ProjectDocument[]) {
    docs.forEach((doc, index) => {
      if (this.get(doc.id).status !== 'idle') return;
      if (this.queue.some((q) => q.doc.id === doc.id)) return;
      this.queue.push({ projectId, doc, index });
    });
    this.pump();
  }

  private pump() {
    while (this.running < this.deps.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (this.get(next.doc.id).status !== 'idle') continue;
      if (!this.recentProjects.includes(next.projectId) && this.recentProjects.length > 0) continue;
      const spent = this.bytes.get(next.projectId) ?? 0;
      if (!mayPrefetch(next.index, spent, { budget: this.deps.budget, minDocs: this.deps.minDocs })) continue;
      this.running += 1;
      void this.load(next.projectId, next.doc).finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }

  private async load(projectId: string, doc: ProjectDocument) {
    this.aborts.get(doc.id)?.abort();
    const ctrl = new AbortController();
    this.aborts.set(doc.id, ctrl);
    this.owner.set(doc.id, projectId);
    this.set(doc.id, { ...IDLE, status: 'loading' });
    try {
      const res = await this.deps.fetchFile(doc.id, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.kind === 'unavailable') {
        this.set(doc.id, { ...IDLE, status: 'unavailable' });
        return;
      }
      const size = res.blob.size;
      this.bytes.set(projectId, (this.bytes.get(projectId) ?? 0) + size);
      this.set(doc.id, {
        status: 'ready',
        url: this.deps.createUrl(res.blob),
        mime: documentMime(doc, res.blob.type),
        bytes: size,
        error: null,
      });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      this.set(doc.id, { ...IDLE, status: 'error', error: e instanceof Error ? e.message : 'The document could not be loaded.' });
    } finally {
      if (this.aborts.get(doc.id) === ctrl) this.aborts.delete(doc.id);
    }
  }

  private releaseProject(projectId: string) {
    this.queue = this.queue.filter((q) => q.projectId !== projectId);
    let changed = false;
    for (const [docId, p] of this.owner) {
      if (p !== projectId) continue;
      this.aborts.get(docId)?.abort();
      this.aborts.delete(docId);
      const url = this.states.get(docId)?.url;
      if (url) this.deps.revokeUrl(url);
      this.states.delete(docId);
      this.owner.delete(docId);
      changed = true;
    }
    this.bytes.delete(projectId);
    if (changed) {
      this.snapshot = new Map(this.states);
      this.listeners.forEach((l) => l());
    }
  }

  /** Sign-out: drop every file so another user cannot see it. */
  reset() {
    [...new Set(this.owner.values())].forEach((p) => this.releaseProject(p));
    this.aborts.forEach((c) => c.abort());
    this.aborts.clear();
    this.queue = [];
    this.recentProjects = [];
    this.states.clear();
    this.snapshot = new Map();
    this.listeners.forEach((l) => l());
  }
}

export const documentFiles = new DocumentFileStore();
