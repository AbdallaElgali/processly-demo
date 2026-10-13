import type { UserSettings } from '@/api/user';

export type StoredThemeMode = 'light' | 'dark' | 'system';

/** The stored `user_settings.theme` as a colour-scheme mode, or null when it is unset or unknown. */
export function storedThemeMode(theme: string | null | undefined): StoredThemeMode | null {
  return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : null;
}

interface SettingsOwner {
  id: string;
  template_id: string | null;
  theme: string | null;
  lang: string | null;
}

/**
 * The body of `PUT /auth/update-user-settings`: exactly the schema's four
 * fields (`user_id`, `template_id`, `theme`, `lang`), the stored values with
 * the change laid over them. The route rewrites all four columns, so what is
 * not being changed must be the latest known value.
 */
export function settingsPayload(user: SettingsOwner, change: Partial<UserSettings>): UserSettings {
  return {
    user_id: user.id,
    template_id: change.template_id !== undefined ? change.template_id : user.template_id,
    theme: change.theme !== undefined ? change.theme : user.theme,
    lang: change.lang !== undefined ? change.lang : user.lang,
  };
}
