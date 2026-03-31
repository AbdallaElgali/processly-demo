import { useState, useCallback, useEffect, useRef } from 'react';

const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

export const useResizer = (isSidebarOpen: boolean) => {
  const [viewerWidth, setViewerWidth] = useState(600); 
  const isResizing = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingWidthRef.current = null;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const flushPendingWidth = useCallback(() => {
    rafRef.current = null;
    if (pendingWidthRef.current === null) return;

    const nextWidth = pendingWidthRef.current;
    pendingWidthRef.current = null;

    setViewerWidth((prevWidth) => (Math.abs(prevWidth - nextWidth) >= 1 ? nextWidth : prevWidth));
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > MIN_VIEWER_WIDTH && (window.innerWidth - newWidth - (isSidebarOpen ? SIDEBAR_WIDTH : 0)) > MIN_MAIN_WIDTH) {
      pendingWidthRef.current = newWidth;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPendingWidth);
      }
    }
  }, [flushPendingWidth, isSidebarOpen]);

  useEffect(() => {
    window.addEventListener('mousemove', resize, { passive: true });
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [resize, stopResizing]);

  return { viewerWidth, setViewerWidth, startResizing };
};
