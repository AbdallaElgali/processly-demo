'use client';

import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

/**
 * A debounced-by-the-caller search input (the caller owns `value`/`onChange`;
 * this component owns clearing). `Esc` clears when it has a value. There is
 * no global key that focuses it: the app has no custom shortcuts (AM19), so
 * it is reached with Tab like any other field.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  sx,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
} & Omit<TextFieldProps, 'value' | 'onChange' | 'placeholder'>) {
  return (
    <TextField
      {...rest}
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
