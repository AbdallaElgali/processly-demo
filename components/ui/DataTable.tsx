'use client';

import { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import { SkeletonRows } from './Skeletons';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  sortable?: boolean;
  /** Used for sorting when `sortable` is set; also the fallback render. */
  value?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
}

/**
 * The shared shell for the runs, pins, templates and members tables (steps
 * 7/11/13): sortable header, skeleton rows while loading, and an empty/error
 * state in place of the body rather than an empty `<table>`.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  defaultSortKey,
  defaultSortDirection = 'asc',
  onRowClick,
  dense = false,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  dense?: boolean;
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.value) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = column.value!(a);
      const bv = column.value!(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortKey, sortDirection]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <TableContainer sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel' }}>
      <Table size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'surface.sunken', color: 'text.secondary', fontWeight: 600 } }}>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align} width={col.width}>
                {col.sortable ? (
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDirection : 'asc'}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0, py: 2 }}>
                <SkeletonRows count={5} columns={columns.length} />
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                <ErrorState description={error} onRetry={onRetry} />
              </TableCell>
            </TableRow>
          ) : sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                sx={onRowClick ? { cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.focus', outlineOffset: '-2px' } } : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {col.render ? col.render(row) : col.value ? String(col.value(row)) : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
