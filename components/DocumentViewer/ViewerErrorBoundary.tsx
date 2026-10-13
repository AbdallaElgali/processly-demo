'use client';

import { Component, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { ErrorState } from '@/components/ui/ErrorState';

/**
 * Keeps a viewer crash inside its own document. pdf.js and SheetJS run on
 * customer files of every shape; without this, one bad file takes down the
 * whole Workspace (Next's "Application error" page) along with the parameter
 * table the engineer was working in.
 */
export class ViewerErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box sx={{ height: '100%', bgcolor: 'surface.canvas' }}>
        <ErrorState
          title="The viewer stopped"
          description={`${this.props.name} could not be displayed. The parameters are unaffected.`}
          onRetry={() => this.setState({ failed: false })}
        />
      </Box>
    );
  }
}
