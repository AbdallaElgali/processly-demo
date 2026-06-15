// api/parameters.ts
import { config } from './config';

const API_URL = config.api;
// Make sure this points to the router prefix where your endpoints live
const API_BASE_URL = API_URL + '/flagging'; 

export const flagParameter = async (
    user_id: string, 
    parameter_id: string, 
    ai_metric_candidate_id: string, 
    parent_flag_id: string | null = null, 
    flag_reason: string | null = null
): Promise<string> => {
    console.log(`Flagging candidate ${ai_metric_candidate_id} for user ${user_id}`);
    
    const response = await fetch(`${API_BASE_URL}/ai-flag-parameter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id, 
            parameter_id, 
            ai_metric_candidate_id, 
            parent_flag_id, 
            flag_reason 
        }),
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    return data.flag_id; // Return the new ticket ID for the React state
}

export const unFlagParameter = async (
    flag_id: string, 
    resolved_by: string | null = null, 
    status: string = "DISMISSED"
): Promise<void> => {
   const response = await fetch(`${API_BASE_URL}/ai-unflag-parameter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_id, resolved_by, status }),
    });
    
    if (!response.ok) throw new Error(await response.text());
}