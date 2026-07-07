import { config } from '@/api/config';

const API_URL = config.api;
// Make sure this points to the router prefix where your endpoints live
const API_BASE_URL = API_URL + '/audit'; 

export interface FeedbackItem {
    id: string;
    project_id: string;
    user_id: string;
    document_id?: string;
    feedback_type: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    updated_at?: string;
}

export interface FeedbackFilters {
    project_id?: string;
    user_id?: string;
    status?: string;
    limit?: number;  // Default 100
    offset?: number; // Default 0 
}

interface FeedbackResponse {
    feedbacks: FeedbackItem[];
    total: number;
}

export const fetch_feedback = async(filters: FeedbackFilters): Promise<FeedbackResponse> => {
    try{
        const response = await fetch(`${API_BASE_URL}/feedback-list?${new URLSearchParams(filters as Record<string, string>).toString()}`);
        if (response.status === 200) {
            const data = await response.json();
            const feedbacks = data.feedbacks;
            const total = data.feedbacks.length;

            const feedback_response: FeedbackResponse = {
                feedbacks: feedbacks,
                total: total
            };
            console.log('Feedback response:', feedback_response);
            return feedback_response;
        }
        else {
            console.error(response);
            throw new Error('Response status ' + response.status + ' returned but no error.');
        }
    } catch (err){
        console.error(err);
        throw new Error('Failed to fetch feedbacks: ' + err);
    }
}