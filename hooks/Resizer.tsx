import { useState, useCallback, useEffect, useRef } from 'react';

const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

export const useResizer = (isSidebarOpen: boolean) => {
  const [viewerWidth, setViewerWidth] = useState(600); 
  const isResizing = useRef(false);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > MIN_VIEWER_WIDTH && (window.innerWidth - newWidth - (isSidebarOpen ? SIDEBAR_WIDTH : 0)) > MIN_MAIN_WIDTH) {
      setViewerWidth(newWidth);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return { viewerWidth, setViewerWidth, startResizing };
};
