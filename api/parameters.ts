
const API_BASE_URL = 'http://localhost:8000/projects';

export const flagParameter = async (user_id: string, parameter_id: string, reason: string | null = null): Promise<void> => {
    console.log(`Flagging parameter ${parameter_id} for user ${user_id} with reason: ${reason}`);
    const response = await fetch(`${API_BASE_URL}/flag-parameter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, parameter_id, reason }),
    });
    if (!response.ok) throw new Error(await response.text());
}

export const unFlagParameter = async (user_id: string, parameter_id: string): Promise<void> => {
   const response = await fetch(`${API_BASE_URL}/unflag-parameter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, parameter_id }),
    });
    if (!response.ok) throw new Error(await response.text());
}   
