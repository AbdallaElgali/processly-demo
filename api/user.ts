import { config } from './config';

const API_URL = config.api;
// Note: Adjusted to match your FastAPI router prefix, assuming API_URL points to the base domain
const API_BASE_URL = API_URL + '/auth';

export interface UserSettings {
    user_id: string;
    template_id: string | null;
    theme: string | null; // e.g., 'light' or 'dark'
    lang: string | null; // e.g., 'en', 'es', etc.
    // Add other settings fields as needed
}

export const update_user_settings = async (userId: string, settings: UserSettings): Promise<Boolean> => {
    const response = await fetch(`${API_BASE_URL}/update-user-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    })
    if (!response.ok) throw new Error(`Failed to update user settings: ${response.statusText}`);
    return true;
}
