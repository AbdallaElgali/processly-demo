'use client';

import '@/hooks/url-polyfill';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  CssBaseline,
  CircularProgress,
  IconButton,
  ThemeProvider,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import FlagIcon from '@mui/icons-material/Flag';

import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { MemoizedSidebar } from '@/components/Sidebar';
import { ProjectBar } from '@/components/ProjectBar';
import dynamic from 'next/dynamic';

const SIDEBAR_WIDTH = 260;
const TOOLBAR_WIDTH = 56;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((mod) => mod.MemoizedDocumentRouter),
  { ssr: false, loading: () => <p>Loading document viewer...</p> }
);

export default function ReviewPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { projects, currentProject, isLoading: projectsLoading, loadProjectDetails } = useProject();
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const activeProjectId = currentProject?.id || null;
  const prevProjectIdRef = useRef<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { viewerWidth, startResizing } = useResizer(isSidebarOpen);
  const {
    fields, handleFlag, hydrateFieldsFromDB, resetFields,
    handleFieldChange, handleRemoveField, handleSwitchSpecification,
  } = useParameterManager();
  const {
    activeFileId, activeDoc, activeSource, hydrateFiles,
    handleSelectFile, handleJumpToSource, clearFiles,
  } = useDocumentManager(activeProjectId);

  // 1. Auth Guard
  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [user, authLoading, router, hasMounted]);

  // 2. Auto-load First Project
  useEffect(() => {
    if (hasMounted && projects.length > 0 && !currentProject && !projectsLoading) {
      loadProjectDetails(projects[0].id);
    }
  }, [hasMounted, projects, currentProject, projectsLoading, loadProjectDetails]);

  // 3. Handle Project Switching & Hydration
  useEffect(() => {
    if (!currentProject) return;
    const isNewProject = currentProject.id !== prevProjectIdRef.current;
    if (isNewProject) {
      clearFiles();
      resetFields();
      prevProjectIdRef.current = currentProject.id;
      if (currentProject.documents && currentProject.documents.length > 0) {
        hydrateFiles(currentProject.documents);
      }
      if (currentProject.parameters) {
        hydrateFieldsFromDB(currentProject.parameters);
      }
    }
  }, [currentProject, clearFiles, resetFields, hydrateFiles, hydrateFieldsFromDB]);

  if (!hasMounted) return null;

  if (authLoading || projectsLoading || !user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: colors.background }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  if (projects.length === 0) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.background }}>
          <LayoutHeader />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
              <Typography variant="h6" gutterBottom>No Projects to Review</Typography>
              <Typography variant="body2" color="text.secondary">
                There are no projects available. Switch to Editor mode to create one.
              </Typography>
            </Paper>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  const projectName = currentProject?.alias_id || currentProject?.title || currentProject?.name || '';

  // Count flagged fields for the toolbar badge
  const flaggedCount = fields.filter(f => f.isFlagged).length;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar */}
          <Box sx={{
            width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
            transition: 'width 0.3s ease',
            borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none',
            bgcolor: colors.surface,
            overflow: 'hidden',
          }}>
            <MemoizedSidebar currentFileId={activeFileId} onSelectFile={handleSelectFile} />
          </Box>

          {/* Minimal toolbar — review mode has no upload/analyze/save/export */}
          <Box sx={{
            width: TOOLBAR_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 2,
            borderRight: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
          }}>
            <Tooltip title={flaggedCount > 0 ? `${flaggedCount} parameter${flaggedCount > 1 ? 's' : ''} flagged` : 'No flags yet'} placement="right">
              <Box sx={{ position: 'relative' }}>
                <FlagIcon sx={{ color: flaggedCount > 0 ? colors.warning : colors.border, fontSize: 20, mt: 0.5 }} />
                {flaggedCount > 0 && (
                  <Box sx={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    bgcolor: colors.warning,
                    color: '#000',
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                  }}>
                    {flaggedCount}
                  </Box>
                )}
              </Box>
            </Tooltip>

            <Box sx={{ flex: 1 }} />

            <Tooltip title={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} placement="right">
              <IconButton onClick={() => setIsSidebarOpen(prev => !prev)}>
                {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Parameter Panel — read-only */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <ProjectBar
              projectName={projectName}
              username={user?.username}
              onLogout={logout}
              mode="review"
            />
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              <MemoizedInputFieldsList
                fields={fields}
                onFieldChange={handleFieldChange}
                onRemoveField={handleRemoveField}
                onShowSource={handleJumpToSource}
                onSwitchSpecification={handleSwitchSpecification}
                onFlag={handleFlag}
                readOnly
              />
            </Box>
          </Box>

          {/* Resize handle */}
          <Box
            onMouseDown={startResizing}
            sx={{ width: '6px', cursor: 'col-resize', transition: '0.2s', '&:hover': { bgcolor: colors.primary } }}
          />

          {/* Document Viewer */}
          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#f4f4f5' }}>
            <DocumentRouter
              fileUrl={activeDoc?.fileUrl || null}
              fileType={activeDoc?.fileType || null}
              activeHighlight={activeSource}
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
