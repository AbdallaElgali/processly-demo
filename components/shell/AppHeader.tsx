'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Box, Chip, Divider, IconButton, ListItemIcon, Menu, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { layout } from '@/theme/layout';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { JobTray } from '@/components/jobs/JobTray';

/**
 * The app shell's header: wordmark, breadcrumb, browser-wide job tray, theme
 * toggle and user menu. Mounted once by the project layout and the projects
 * list, replacing the old per-page LayoutHeader + ProjectBar pair.
 */
export function AppHeader({ breadcrumb }: { breadcrumb?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <Box
      component="header"
      sx={{
        height: layout.headerHeight,
        flexShrink: 0,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: 1,
        borderColor: 'border.subtle',
        bgcolor: 'surface.panel',
      }}
    >
      <Typography
        component={Link}
        href="/projects"
        variant="h6"
        sx={{
          color: 'text.primary',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { color: 'accent.text' },
        }}
      >
        Voltavision{' '}
        <Box component="span" sx={{ color: 'accent.text' }}>BDA</Box>
      </Typography>

      <Box sx={{ minWidth: 0, flex: 1 }}>{breadcrumb}</Box>

      <Stack direction="row" spacing={0.5} alignItems="center">
        <JobTray />
        <ThemeToggle />
        <Tooltip title={user?.username ?? 'Account'}>
          <IconButton
            size="small"
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            sx={{ color: 'text.secondary' }}
          >
            <AccountCircleOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Escape closes it and focus returns to the button: MUI Menu default. */}
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={600}>{user?.username}</Typography>
          <Typography variant="caption" sx={{ color: 'text.muted' }}>
            {user?.department}
          </Typography>
        </Box>
        <Divider />
        <MenuItem component={Link} href="/register" onClick={() => setAnchor(null)}>
          <ListItemIcon><PersonAddAltOutlinedIcon fontSize="small" /></ListItemIcon>
          Register a user
        </MenuItem>
        <MenuItem component={Link} href="/admin" onClick={() => setAnchor(null)}>
          <ListItemIcon><AdminPanelSettingsOutlinedIcon fontSize="small" /></ListItemIcon>
          Admin
          {/* A2: there is no real auth, and the UI must not imply otherwise. */}
          <Chip size="small" label="no auth" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); logout(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );
}
