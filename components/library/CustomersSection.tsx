'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import { TextField } from '@mui/material';
import { FormDialog } from '@/components/ui/FormDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { useCustomers } from '@/hooks/Customers';
import { CustomerDetail } from './CustomerDetail';

/** Library > Customers: the list, "New customer", and one customer's settings (`?customer=<id>`). No delete (the backend has none, B12). */
export function CustomersSection() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get('customer');
  const { customers, isLoading, error, loadCustomers, createNewCustomer } = useCustomers();
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void loadCustomers().finally(() => setLoaded(true));
  }, [loadCustomers]);

  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?tab=customers&customer=${encodeURIComponent(id)}` : `${pathname}?tab=customers`, { scroll: false });

  const close = () => {
    setCreating(false);
    setAlias('');
    setCreateError(null);
  };

  const create = async () => {
    setBusy(true);
    setCreateError(null);
    try {
      const created = await createNewCustomer(alias.trim());
      close();
      if (created) open(created.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create the customer.');
    } finally {
      setBusy(false);
    }
  };

  if (openId) return <CustomerDetail key={openId} customerId={openId} onBack={() => open(null)} />;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
          Each customer can have a default template and its own versions of the category prompts.
        </Typography>
        <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setCreating(true)}>New customer</Button>
      </Stack>

      {error && customers.length === 0 ? (
        <ErrorState title="Could not load customers" description={error} onRetry={() => void loadCustomers()} />
      ) : !loaded || (isLoading && customers.length === 0) ? (
        <div aria-busy="true"><SkeletonRows count={5} columns={2} /></div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={PeopleOutlineIcon} title="No customers yet"
          description="Add a customer to give it a default template and its own prompts."
          action={{ label: 'New customer', onClick: () => setCreating(true) }}
        />
      ) : (
        <Box component="ul" aria-label="Customers" sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: 900, border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel', overflow: 'hidden' }}>
          {[...customers].sort((a, b) => a.alias_name.localeCompare(b.alias_name)).map((c, i) => (
            <Box component="li" key={c.id} sx={{ borderTop: i === 0 ? 0 : 1, borderColor: 'border.subtle' }}>
              <Button
                fullWidth color="inherit" onClick={() => open(c.id)} endIcon={<ChevronRightIcon />}
                sx={{ justifyContent: 'space-between', textAlign: 'left', px: 2, py: 1.25, borderRadius: 0, textTransform: 'none' }}
              >
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{c.alias_name}</Typography>
                  {c.name && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c.name}</Typography>}
                </Box>
              </Button>
            </Box>
          ))}
        </Box>
      )}

      {creating && (
        <FormDialog
          open onClose={close} title="New customer" error={createError} submitLabel="Create customer"
          submitDisabled={alias.trim() === ''} busy={busy} onSubmit={() => void create()}
        >
          <TextField autoFocus required label="Customer name" value={alias} onChange={(e) => setAlias(e.target.value)} fullWidth helperText="Shown when you create a project." />
        </FormDialog>
      )}
    </Box>
  );
}
