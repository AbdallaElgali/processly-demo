'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProjectData } from '@/lib/jobs/hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * Warns before unsaved parameter edits are put at risk (step 10 gap).
 *
 * - **Reload, close tab, type another address:** the browser's own
 *   `beforeunload` prompt (its text cannot be customised). A full page load
 *   empties the in-memory store, so this is the one case where edits are
 *   really lost.
 * - **Leaving the Workspace inside the app:** a click on any in-app link that
 *   goes somewhere else is held back and the reviewer is asked first. The
 *   edits would survive in memory while the app stays open, but the Save
 *   button only exists on the Workspace, so they would sit unsaved out of
 *   sight. Next's App Router has no route-blocking hook, so this listens for
 *   link clicks in the capture phase. The browser Back/Forward buttons cannot
 *   be intercepted this way and are covered only by the reload warning.
 *
 * Mounted once by the project layout; renders nothing but its dialog.
 */
export function UnsavedChangesGuard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const unsaved = useProjectData(projectId)?.dirty.length ?? 0;
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const onWorkspace = pathname.endsWith('/workspace');

  useEffect(() => {
    if (unsaved === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a return value to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  useEffect(() => {
    if (unsaved === 0 || !onWorkspace) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [unsaved, onWorkspace]);

  const leave = () => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  };

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      title="Leave with unsaved changes?"
      description={
        <>
          {unsaved === 1 ? '1 parameter has' : `${unsaved} parameters have`} edits that are not saved. They are kept while this
          tab stays open, but only Save on the Workspace writes them, and reloading or closing the tab loses them.
        </>
      }
      confirmLabel="Leave"
      cancelLabel="Stay and review"
      destructive
      onConfirm={leave}
      onClose={() => setPendingHref(null)}
    />
  );
}
