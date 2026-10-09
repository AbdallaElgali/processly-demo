'use client';

import { useEffect, useRef } from 'react';
import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

/**
 * A debounced-by-the-caller search input (the caller owns `value`/`onChange`;
 * this component owns focus and clearing). `Esc` clears when it has a value,
 * and the global `/` shortcut focuses it as long as no other field is
 * focused, so a list screen's search is reachable without a mouse.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  shortcut = true,
  sx,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Set false on a page that already has its own `/` binding. */
  shortcut?: boolean;
} & Omit<TextFieldProps, 'value' | 'onChange' | 'placeholder'>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcut]);

  return (
    <TextField
      {...rest}
      inputRef={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.stopPropagation();
          onChange('');
        }
      }}
      placeholder={placeholder}
      size="small"
      sx={{ maxWidth: 420, width: '100%', ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.muted' }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear search" onClick={() => onChange('')} edge="end">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}
