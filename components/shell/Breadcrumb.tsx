'use client';

import Link from 'next/link';
import { Breadcrumbs, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

/**
 * `Projects › Customer › Project` (RFC section 2, decision D6).
 *
 * The customer is the project payload's `customer` (the alias, populated by
 * the backend since step 3.5). With none, the project is shown alone; nothing
 * is invented to fill the slot.
 */
export function Breadcrumb({
  customer,
  project,
}: {
  customer?: string | null;
  project?: string | null;
}) {
  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="Breadcrumb"
      sx={{
        minWidth: 0,
        '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
        '& .MuiBreadcrumbs-li': { minWidth: 0 },
      }}
    >
      <Typography
        component={Link}
        href="/projects"
        variant="body2"
        sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'accent.text' } }}
      >
        Projects
      </Typography>

      {customer && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
          {customer}
        </Typography>
      )}

      {project && (
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }} noWrap title={project}>
          {project}
        </Typography>
      )}
    </Breadcrumbs>
  );
}
