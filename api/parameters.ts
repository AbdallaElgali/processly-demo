// api/parameters.ts
import { config } from './config';

const API_URL = config.api;
// Make sure this points to the router prefix where your endpoints live
const API_BASE_URL = API_URL + '/flagging'; 

/**
 * POST /flagging/ai-flag-parameter.
 *
 * `ai_metric_candidate_id` is REQUIRED by AIFlagRequest, so it is typed as a
 * non-null string here. Passing null produced a 422 that the old caller
 * swallowed, losing the flag (contract fix H1). Callers with no candidate must
 * use `raiseHumanFlag` in lib/review/flagging.ts, which persists the flag on
 * the parameter row instead.
 */
export const flagParameter = async (
    user_id: string,
    parameter_id: string,
    ai_metric_candidate_id: string,
    parent_flag_id: string | null = null,
    flag_reason: string | null = null
): Promise<string> => {
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

/** POST /flagging/ai-unflag-parameter. `user_id` (AIUnflagRequest) is who removed or resolved the flag. */
/** `AIUnflagRequest.status`: the only three values the backend accepts (422 otherwise). */
export type FlagStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export const unFlagParameter = async (
    flag_id: string, 
    resolved_by: string | null = null, 
    status: FlagStatus = "DISMISSED",
    user_id: string | null = null
): Promise<void> => {
   const response = await fetch(`${API_BASE_URL}/ai-unflag-parameter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_id, resolved_by, status, user_id }),
    });
    
    if (!response.ok) throw new Error(await response.text());
}

export const updateResolvedBy = async (
    flag_id: string, 
    resolved_by: string | null = null
): Promise<void> => {
   const response = await fetch(`${API_BASE_URL}/select-correct-ai-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_id, resolved_by }),
    });
    
    if (!response.ok) throw new Error(await response.text());
}

