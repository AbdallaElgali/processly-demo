'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument } from '@/api/types/projects';
import type { InputField, SpecificationSource } from '@/types';
import type { ViewerHighlight } from '@/components/DocumentViewer/types';
import { projectDataStore } from '@/lib/project-data/store';
import { documentFiles } from '@/lib/documents/fileStore';
import { KEEP_MOUNTED } from '@/lib/documents/config';
import { touchRecent } from '@/lib/documents/prefetch';
import { anchorKey, fieldAnchors, type SourceAnchor } from '@/lib/review/anchors';
import { stepIndex } from '@/lib/excel/matchNav';

/** The source the user jumped to, and the parameter's other anchors (1 of N). */
export interface SourceNav {
  fieldId: string | null;
  label: string | null;
  anchors: SourceAnchor[];
  index: number;
  /** The anchor names a document that is not in this project's list. */
  missingDocument: boolean;
}

interface State {
  projectId: string;
  chosen: string | null;
  recent: string[];
  highlights: Record<string, ViewerHighlight>;
  nav: SourceNav | null;
}

const initial = (projectId: string): State => ({
  projectId,
  chosen: projectDataStore.getActiveDocument(projectId) ?? null,
  recent: [],
  highlights: {},
  nav: null,
});

/**
 * The viewer side of the Workspace (AM12): which document is open, which
 * recent ones stay mounted, the highlight per document, and the "source 1 of
 * N" navigation. Replaces DocumentManager, whose eager all-or-nothing fetch is
 * now `documentFiles` (per document, prefetched within a budget).
 *
 * Jumping to a source switches to its document; the document the user left
 * keeps its place, because view state is saved per document and the last
 * KEEP_MOUNTED documents stay mounted.
 */
export function useDocumentWorkspace(projectId: string, documents: ProjectDocument[]) {
  const [state, setState] = useState<State>(() => initial(projectId));
  // A different project: start over (render-time reset, no effect needed).
  const current = state.projectId === projectId ? state : initial(projectId);
  if (current !== state) setState(current);

  const nonce = useRef(0);
  const ids = useMemo(() => documents.map((d) => d.id), [documents]);
  const activeId = current.chosen && ids.includes(current.chosen) ? current.chosen : (ids[0] ?? null);

  const mountedIds = useMemo(() => {
    const alive = current.recent.filter((id) => ids.includes(id));
    return activeId ? touchRecent(alive, activeId, KEEP_MOUNTED) : alive;
  }, [current.recent, ids, activeId]);

  // ---- fetching -----------------------------------------------------------
  useEffect(() => {
    documentFiles.focusProject(projectId);
  }, [projectId]);

  useEffect(() => {
    const active = documents.find((d) => d.id === activeId);
    if (active) documentFiles.ensure(projectId, active);
    documentFiles.prefetch(projectId, documents);
  }, [projectId, documents, activeId]);

  // ---- selection ----------------------------------------------------------
  const select = useCallback(
    (id: string) => {
      projectDataStore.setActiveDocument(projectId, id);
      setState((s) => ({ ...s, chosen: id, recent: touchRecent(mountedIds, id, KEEP_MOUNTED) }));
    },
    [projectId, mountedIds],
  );

  // ---- sources ------------------------------------------------------------
  const goTo = useCallback(
    (nav: SourceNav) => {
      const anchor = nav.anchors[nav.index];
      const source = anchor?.source;
      if (!source) return;
      // No document id (older rows): highlight whatever is open, as before.
      const target = source.documentId ? (ids.includes(source.documentId) ? source.documentId : null) : activeId;
      const next: SourceNav = { ...nav, missingDocument: target === null };
      if (target && target !== activeId) select(target);
      nonce.current += 1;
      const n = nonce.current;
      setState((s) => ({
        ...s,
        nav: next,
        highlights: target ? { ...s.highlights, [target]: { source, nonce: n, value: anchor.value } } : s.highlights,
      }));
    },
    [ids, activeId, select],
  );

  const jump = useCallback(
    (source: SpecificationSource, field?: InputField) => {
      let anchors = field ? fieldAnchors(field) : [];
      const key = anchorKey(source);
      let index = anchors.findIndex((a) => a.key === key);
      if (index === -1) {
        anchors = [{ key, source, specId: '', selected: false, value: null }, ...anchors];
        index = 0;
      }
      goTo({ fieldId: field?.id ?? null, label: field?.label ?? null, anchors, index, missingDocument: false });
    },
    [goTo],
  );

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const nav = current.nav;
      if (!nav || nav.anchors.length < 2) return;
      goTo({ ...nav, index: (nav.index + dir + nav.anchors.length) % nav.anchors.length });
    },
    [current.nav, goTo],
  );

  const clearSource = useCallback(() => setState((s) => ({ ...s, nav: null, highlights: {} })), []);

  /**
   * Moves to the next or previous matching cell of the open document's
   * highlight (Excel tables, where the backend names no cell). Same nonce: it
   * is the same jump, so the viewer only moves the selection.
   */
  const stepMatch = useCallback(
    (dir: 1 | -1, count: number) => {
      if (!activeId || count < 2) return;
      setState((s) => {
        const h = s.highlights[activeId];
        if (!h) return s;
        return { ...s, highlights: { ...s.highlights, [activeId]: { ...h, matchIndex: stepIndex(h.matchIndex ?? 0, dir, count) } } };
      });
    },
    [activeId],
  );

  return {
    activeId,
    mountedIds,
    highlights: current.highlights,
    nav: current.nav,
    select,
    jump,
    cycle,
    clearSource,
    stepMatch,
  };
}
