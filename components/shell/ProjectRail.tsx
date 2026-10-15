'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { layout } from '@/theme/layout';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { JobBadge, activityBadge } from '@/components/jobs/JobBadge';

/** RFC section 2's project-scoped navigation, in display order. Extract and
 *  Review are one Workspace since AM11. */
const NAV = [
  { slug: 'overview', label: 'Overview', Icon: DashboardOutlinedIcon },
  { slug: 'workspace', label: 'Workspace', Icon: FactCheckOutlinedIcon },
  { slug: 'parameters', label: 'Parameters', Icon: TuneOutlinedIcon },
  { slug: 'prompts', label: 'Prompts', Icon: SmartToyOutlinedIcon },
  { slug: 'audit', label: 'Audit', Icon: HistoryOutlinedIcon },
  { slug: 'settings', label: 'Settings', Icon: SettingsOutlinedIcon },
] as const;

/** Which nav items carry this project's background-work badge. */
const BADGE_ON: Record<string, boolean> = { workspace: true };

interface ProjectRailProps {
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ProjectRail({ projectId, collapsed, onToggleCollapsed }: ProjectRailProps) {
  const pathname = usePathname();
  const activity = useProjectActivity(projectId);
  const badge = activityBadge(activity);
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * Arrow keys move between items and Home/End jump to the ends, which is what
   * a navigation list is expected to do (8.4). Tab still leaves the rail, so
   * the whole nav is one stop rather than seven.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-rail-item]') ?? [],
    );
    if (items.length === 0) return;
    const current = items.findIndex((el) => el === document.activeElement);
    event.preventDefault();
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? Math.min(current + 1, items.length - 1)
      : Math.max(current - 1, 0);
    items[next < 0 ? 0 : next]?.focus();
  };

  return (
    <Box
      component="nav"
      aria-label="Project sections"
      sx={{
        width: collapsed ? layout.railWidthCollapsed : layout.railWidth,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'border.subtle',
        bgcolor: 'surface.panel',
        display: 'flex',
        flexDirection: 'column',
        transition: (t) => t.transitions.create('width'),
        overflow: 'hidden',
      }}
    >
      <List ref={listRef} onKeyDown={onKeyDown} sx={{ py: 1, flex: 1 }}>
        {NAV.map(({ slug, label, Icon }) => {
          const href = `/projects/${projectId}/${slug}`;
          const selected = pathname === href;
          const showBadge = BADGE_ON[slug] && badge;

          const item = (
            <ListItemButton
              key={slug}
              component={Link}
              href={href}
              data-rail-item
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1,
                minHeight: 40,
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                '&.Mui-selected': {
                  bgcolor: 'accent.tint',
                  // A 3px bar as well as the tint, so selection does not rest
                  // on colour alone.
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0, top: 8, bottom: 8,
                    width: 3,
                    borderRadius: 2,
                    bgcolor: 'accent.fill',
                  },
                  '& .MuiListItemText-primary': { color: 'accent.text', fontWeight: 600 },
                  '& .MuiListItemIcon-root': { color: 'accent.text' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'text.secondary' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2' }} />
              )}
              {showBadge && (
                <Box sx={{ position: collapsed ? 'absolute' : 'static', top: 6, right: 10 }}>
                  <JobBadge kind={badge} />
                </Box>
              )}
            </ListItemButton>
          );

          // Collapsed to icons, the label has to come from somewhere.
          return collapsed ? (
            <Tooltip key={slug} title={label} placement="right">
              {item}
            </Tooltip>
          ) : (
            item
          );
        })}
      </List>

      <Divider />
      <Box sx={{ p: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton size="small" onClick={onToggleCollapsed} aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
