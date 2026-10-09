'use client';

import Link from 'next/link';
import { Breadcrumbs, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

/**
 * `Projects › Customer › Project` (RFC section 2, decision D6).
 *
 * The customer is resolved by the caller: the project payload's `customer` is
 * always null today (Task B item B2), so D6 falls back to joining
 * GET /customers/ by customer_id, and shows the project alone if neither
 * resolves. Nothing is invented to fill the slot.
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
