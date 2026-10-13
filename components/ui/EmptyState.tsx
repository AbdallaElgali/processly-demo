'use client';

import { Button, Stack, Typography, type SvgIconProps } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

/**
 * Icon, title, one sentence, primary action (CLAUDE.md 8.4: every empty state
 * has a next action). Used for "nothing here yet" — a genuine absence of data,
 * as opposed to `ErrorState`, which is a failure to load it.
 */
export function EmptyState({
  icon: Icon = InboxOutlinedIcon,
  title,
  description,
  action,
  secondaryAction,
}: {
  icon?: React.ComponentType<SvgIconProps>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 8, px: 2, textAlign: 'center' }}>
      <Icon sx={{ fontSize: 40, color: 'text.muted' }} />
      <Typography variant="h6" sx={{ color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {(action || secondaryAction) && (
        <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
          {action && (
            <Button variant="contained" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button color="inherit" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
