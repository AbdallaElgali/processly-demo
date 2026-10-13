import { describe, expect, it } from 'vitest';
import { settingsPayload, storedThemeMode } from './settings';

const user = {
  id: 'u-1', username: 'ada', department: 'Zelle', template_id: 't-1', lang: 'en',
  theme: 'dark', settings_last_updated_at: '2026-10-10T00:00:00Z',
};

describe('settingsPayload (S2)', () => {
  it('sends exactly the four fields of the schema, nothing from the cached user', () => {
    expect(Object.keys(settingsPayload(user, {})).sort()).toEqual(['lang', 'template_id', 'theme', 'user_id']);
  });

  it('keeps the stored values for what was not changed', () => {
    expect(settingsPayload(user, { theme: 'light' })).toEqual({ user_id: 'u-1', template_id: 't-1', theme: 'light', lang: 'en' });
  });

  it('lets a change set a value to null', () => {
    expect(settingsPayload(user, { template_id: null }).template_id).toBeNull();
  });

  it('ignores a user_id inside the change', () => {
    expect(settingsPayload(user, { user_id: 'other', theme: 'light' }).user_id).toBe('u-1');
  });
});

describe('storedThemeMode (S1)', () => {
  it('accepts light, dark and system', () => {
    expect(storedThemeMode('light')).toBe('light');
    expect(storedThemeMode('dark')).toBe('dark');
    expect(storedThemeMode('system')).toBe('system');
  });

  it('returns null for nothing or something else, so the local choice stays', () => {
    expect(storedThemeMode(null)).toBeNull();
    expect(storedThemeMode(undefined)).toBeNull();
    expect(storedThemeMode('solarized')).toBeNull();
  });
});
